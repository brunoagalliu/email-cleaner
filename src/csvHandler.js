const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');
const fs = require('fs');
const path = require('path');

const OUTPUT_COLUMNS = ['original', 'email', 'score', 'status', 'reasons', 'suggestion'];

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const emails = [];
    const columnName = { index: null, name: null, noHeaders: false };

    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
      .on('data', (row) => {
        if (columnName.index === null) {
          const keys = Object.keys(row);
          const emailKey = keys.find(k =>
            /email/i.test(k) || /e-mail/i.test(k) || /mail/i.test(k)
          ) || keys[0];
          columnName.name = emailKey;
          columnName.index = 0;

          // If the detected column name is itself an email, the file has no
          // headers — the first row was consumed as the header. Add it back.
          if (emailKey.includes('@')) {
            columnName.noHeaders = true;
            emails.push({ email: emailKey, row: null });
          }
        }
        const val = row[columnName.name];
        if (val) emails.push({ email: val, row: columnName.noHeaders ? null : row });
      })
      .on('end', () => resolve({ emails, columnName: columnName.noHeaders ? null : columnName.name }))
      .on('error', reject);
  });
}

async function readPlainText(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const emails = text
    .split(/[\r\n,;]+/)
    .map(e => e.trim())
    .filter(Boolean)
    .map(email => ({ email, row: null }));
  return { emails, columnName: null };
}

function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.txt') return 'txt';
  return 'csv'; // default
}

async function loadFile(filePath) {
  const format = detectFormat(filePath);
  if (format === 'txt') return readPlainText(filePath);
  return readCSV(filePath);
}

async function writeResults(results, outputPath, originalRows) {
  return new Promise((resolve, reject) => {
    const rows = results.map((r, i) => {
      const base = originalRows && originalRows[i] ? { ...originalRows[i] } : {};
      return {
        ...base,
        original_email: r.original,
        cleaned_email: r.email,
        score: r.score,
        status: r.status,
        reasons: r.reasons,
        suggestion: r.suggestion,
        smtp_status: r.smtp_status || 'skipped',
      };
    });

    stringify(rows, { header: true }, (err, output) => {
      if (err) return reject(err);
      fs.writeFileSync(outputPath, output);
      resolve(outputPath);
    });
  });
}

module.exports = { loadFile, writeResults };
