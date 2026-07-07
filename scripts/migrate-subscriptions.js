/**
 * scripts/migrate-subscriptions.js
 *
 * Creates the user_subscriptions table (idempotent).
 * Usage: node scripts/migrate-subscriptions.js
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Load DATABASE_URL from .env.local if not already set
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

  const sqlPath = path.join(
    __dirname,
    "..",
    "db",
    "migrations",
    "001-user-subscriptions.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.query(sql);
    const [rows] = await connection.query(
      "SHOW TABLES LIKE 'user_subscriptions'"
    );
    if (rows.length === 1) {
      console.log("✓ user_subscriptions table is in place");
    } else {
      console.error("✗ user_subscriptions table was not created");
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
