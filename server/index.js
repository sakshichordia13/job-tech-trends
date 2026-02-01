const path = require('path');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');

const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'data.db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Initialize tables on startup.
async function initDb() {
  await run(
    `CREATE TABLE IF NOT EXISTS job_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      captured_at TEXT
    )`
  );
  await run(
    `CREATE TABLE IF NOT EXISTS tech_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_post_id INTEGER,
      tech TEXT,
      count INTEGER,
      FOREIGN KEY(job_post_id) REFERENCES job_posts(id)
    )`
  );
}

// Basic payload validation.
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTechArray(value) {
  return Array.isArray(value) && value.every((item) => {
    return item && isNonEmptyString(item.name) && Number.isFinite(item.count);
  });
}

app.post('/ingest', async (req, res) => {
  const { url, capturedAt, tech } = req.body || {};

  if (!isNonEmptyString(url) || !isNonEmptyString(capturedAt) || !isValidTechArray(tech)) {
    return res.status(400).json({ ok: false, error: 'Invalid payload.' });
  }

  try {
    const jobPost = await run(
      'INSERT INTO job_posts (url, captured_at) VALUES (?, ?)',
      [url.trim(), capturedAt]
    );

    const jobPostId = jobPost.lastID;

    for (const entry of tech) {
      await run(
        'INSERT INTO tech_counts (job_post_id, tech, count) VALUES (?, ?, ?)',
        [jobPostId, entry.name.trim(), entry.count]
      );
    }

    return res.json({ ok: true, jobPostId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to ingest.' });
  }
});

app.get('/trends', async (req, res) => {
  const daysRaw = Number.parseInt(req.query.days, 10);
  const limitRaw = Number.parseInt(req.query.limit, 10);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 7;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20;

  // Filter to recent captures.
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const rows = await all(
      `SELECT tech_counts.tech AS tech, SUM(tech_counts.count) AS total
       FROM tech_counts
       INNER JOIN job_posts ON job_posts.id = tech_counts.job_post_id
       WHERE job_posts.captured_at >= ?
       GROUP BY tech_counts.tech
       ORDER BY total DESC
       LIMIT ?`,
      [cutoff, limit]
    );

    return res.json({ top: rows.map((row) => ({ tech: row.tech, total: row.total })) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to load trends.' });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });
