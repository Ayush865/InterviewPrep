/**
 * scripts/migrate-transcripts-reviews.js
 *
 * Adds feedbacks.transcript and the resume_reviews table. Idempotent.
 * Usage: node scripts/migrate-transcripts-reviews.js
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^DATABASE_URL=(.+)$/);
      if (match) process.env.DATABASE_URL = match[1].trim();
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (env or .env.local)");
    process.exit(1);
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feedbacks'
         AND COLUMN_NAME = 'transcript'`
    );
    if (cols.length === 0) {
      await connection.query(
        `ALTER TABLE feedbacks ADD COLUMN transcript JSON NULL
         COMMENT 'Full session transcript: [{role, content}, ...]'`
      );
      console.log("✓ added feedbacks.transcript");
    } else {
      console.log("· feedbacks.transcript already exists");
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS resume_reviews (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        target_role VARCHAR(255) NULL,
        ats_score INT NOT NULL,
        summary TEXT NOT NULL,
        strengths JSON NOT NULL,
        issues JSON NOT NULL,
        bullet_rewrites JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_resume_reviews_user (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    console.log("✓ resume_reviews table is in place");

    console.log("✓ migration complete");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
