/**
 * scripts/migrate-drop-email-unique.js
 *
 * Drops the UNIQUE constraint on users.email — see
 * db/migrations/006-drop-users-email-unique.sql for why. Finds the
 * constraint's actual (auto-generated) index name rather than assuming
 * one, and leaves the non-unique idx_email lookup index untouched.
 * Idempotent — safe to re-run.
 * Usage: node scripts/migrate-drop-email-unique.js
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
    const [indexes] = await connection.query(
      `SELECT INDEX_NAME, NON_UNIQUE FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'email' AND NON_UNIQUE = 0
         AND INDEX_NAME != 'PRIMARY'`
    );

    if (indexes.length === 0) {
      console.log("· No unique index on users.email — nothing to drop");
      return;
    }

    for (const { INDEX_NAME } of indexes) {
      await connection.query(`ALTER TABLE users DROP INDEX \`${INDEX_NAME}\``);
      console.log(`✓ Dropped unique index '${INDEX_NAME}' on users.email`);
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
