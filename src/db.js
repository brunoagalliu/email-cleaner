const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      total       INTEGER,
      valid       INTEGER,
      risky       INTEGER,
      invalid     INTEGER,
      typos       INTEGER,
      output_rows INTEGER,
      csv_content TEXT
    )
  `);
}

async function saveJob(id, filename, stats, csvContent) {
  await pool.query(
    `INSERT INTO jobs (id, filename, total, valid, risky, invalid, typos, output_rows, csv_content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING`,
    [id, filename, stats.total, stats.valid, stats.risky, stats.invalid, stats.typos, stats.outputRows, csvContent]
  );
}

async function listJobs() {
  const { rows } = await pool.query(
    `SELECT id, filename, created_at, total, valid, risky, invalid, typos, output_rows
     FROM jobs ORDER BY created_at DESC LIMIT 100`
  );
  return rows;
}

async function getJobCSV(id) {
  const { rows } = await pool.query(
    `SELECT csv_content, filename FROM jobs WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function deleteJob(id) {
  await pool.query(`DELETE FROM jobs WHERE id = $1`, [id]);
}

module.exports = { init, saveJob, listJobs, getJobCSV, deleteJob };
