/**
 * scripts/fix-paypal-cover-casing.js
 *
 * Data fix: interviews created before the /PayPal.svg -> /Paypal.svg
 * constant fix have the wrong-case path baked into their cover_image
 * column. macOS (dev) resolves it case-insensitively; Vercel (Linux)
 * 404s. Corrects existing rows to match the actual file on disk.
 * Idempotent — safe to re-run.
 * Usage: node scripts/fix-paypal-cover-casing.js
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
    const [result] = await connection.execute(
      `UPDATE interviews
       SET cover_image = '/covers/Paypal.svg'
       WHERE cover_image = '/covers/PayPal.svg'`
    );
    console.log(`✓ Fixed ${result.affectedRows} interview row(s)`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Fix failed:", err.message);
  process.exit(1);
});
