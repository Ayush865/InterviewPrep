/**
 * scripts/migrate-used-resume.js
 *
 * Adds interviews.used_resume (privacy flag for resume-tailored
 * interviews). Idempotent.
 * Usage: node scripts/migrate-used-resume.js
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
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'interviews'
         AND COLUMN_NAME = 'used_resume'`
    );

    if (cols.length === 0) {
      await connection.query(
        `ALTER TABLE interviews
         ADD COLUMN used_resume BOOLEAN NOT NULL DEFAULT false
         COMMENT 'Generated with the creator''s resume context — private to creator'`
      );
      console.log("✓ added interviews.used_resume");
    } else {
      console.log("· used_resume column already exists");
    }

    console.log("✓ migration complete");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
