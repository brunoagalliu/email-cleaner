const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadFile, writeResults } = require('./src/csvHandler');
const { processEmails } = require('./src/processor');

const app = express();
const PORT = process.env.PORT || 3000;

const LOGIN_USER = process.env.LOGIN_USER || 'admin';
const LOGIN_PASS = process.env.LOGIN_PASS || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }, // 8 hours
}));

// Auth middleware — allow login page assets through
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.redirect('/login');
}

// Serve login page (unauthenticated)
app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === LOGIN_USER && password === LOGIN_PASS) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  res.send(`
    <!DOCTYPE html><html><head><meta http-equiv="refresh" content="2;url=/login">
    <style>body{background:#0f1117;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#fca5a5;}</style>
    </head><body>Invalid credentials. Redirecting...</body></html>
  `);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// All routes below require authentication
app.use(requireAuth);

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.txt'].includes(ext)) return cb(null, true);
    cb(new Error('Only .csv and .txt files are allowed'));
  },
});

app.use(express.static(path.join(__dirname, 'public')));

// In-memory job store (sufficient for single-user tool)
const jobs = new Map();

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const jobId = Date.now().toString();
  const minScore = parseInt(req.body.minScore || '50', 10);
  const filterOnly = req.body.filterOnly === 'true';
  const concurrency = parseInt(req.body.concurrency || '20', 10);

  jobs.set(jobId, {
    status: 'running',
    progress: 0,
    total: 0,
    results: null,
    error: null,
    filename: req.file.originalname,
  });

  res.json({ jobId });

  // Process async in background
  setImmediate(async () => {
    try {
      const { emails } = await loadFile(req.file.path);
      const job = jobs.get(jobId);
      job.total = emails.length;

      const results = await processEmails(
        emails.map(e => e.email),
        {
          concurrency,
          onProgress(done, total) {
            job.progress = done;
            job.total = total;
          },
        }
      );

      const outputRows = filterOnly
        ? results.filter(r => r.score >= minScore)
        : results;

      const outputPath = path.join(os.tmpdir(), `cleaned_${jobId}.csv`);
      await writeResults(outputRows, outputPath, null);

      job.status = 'done';
      job.results = {
        total: results.length,
        valid: results.filter(r => r.status === 'valid').length,
        risky: results.filter(r => r.status === 'risky').length,
        invalid: results.filter(r => r.status === 'invalid').length,
        typos: results.filter(r => r.suggestion).length,
        outputRows: outputRows.length,
        outputPath,
      };

      fs.unlinkSync(req.file.path);
    } catch (err) {
      const job = jobs.get(jobId);
      job.status = 'error';
      job.error = err.message;
    }
  });
});

app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    status: job.status,
    progress: job.progress,
    total: job.total,
    results: job.results,
    error: job.error,
    filename: job.filename,
  });
});

app.get('/api/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'done') {
    return res.status(404).json({ error: 'Result not ready' });
  }

  const outputName = job.filename.replace(/(\.[^.]+)$/, '_cleaned.csv');
  res.download(job.results.outputPath, outputName, (err) => {
    if (!err) {
      try { fs.unlinkSync(job.results.outputPath); } catch {}
      jobs.delete(req.params.jobId);
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n  Email Cleaner running at http://localhost:${PORT}\n`);
});
