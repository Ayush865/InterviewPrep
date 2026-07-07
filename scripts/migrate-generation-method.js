/**
 * scripts/migrate-generation-method.js
 *
 * Adds interviews.generation_method ('form' | 'call'). Idempotent.
 * Usage: node scripts/migrate-generation-method.js
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
         AND COLUMN_NAME = 'generation_method'`
    );

    if (cols.length === 0) {
      await connection.query(
        `ALTER TABLE interviews
         ADD COLUMN generation_method VARCHAR(10) NOT NULL DEFAULT 'form'
         COMMENT 'How the interview was generated: form | call'`
      );
      console.log("✓ added interviews.generation_method");
    } else {
      console.log("· generation_method column already exists");
    }

    const [idx] = await connection.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'interviews'
         AND INDEX_NAME = 'idx_interviews_user_method'`
    );
    if (idx.length === 0) {
      await connection.query(
        `CREATE INDEX idx_interviews_user_method
         ON interviews (user_id, generation_method)`
      );
      console.log("✓ added idx_interviews_user_method index");
    } else {
      console.log("· index already exists");
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
