/**
 * scripts/migrate-payment-provider.js
 *
 * Makes user_subscriptions provider-agnostic (Razorpay + Stripe).
 * Idempotent: checks current columns before altering.
 * Usage: node scripts/migrate-payment-provider.js
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
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_subscriptions'`
    );
    const names = cols.map((c) => c.COLUMN_NAME);

    if (!names.includes("provider")) {
      await connection.query(
        `ALTER TABLE user_subscriptions
         ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'stripe' AFTER user_id`
      );
      console.log("✓ added provider column");
    } else {
      console.log("· provider column already exists");
    }

    if (names.includes("stripe_customer_id")) {
      await connection.query(
        `ALTER TABLE user_subscriptions
         RENAME COLUMN stripe_customer_id TO provider_customer_id`
      );
      console.log("✓ renamed stripe_customer_id -> provider_customer_id");
    } else {
      console.log("· provider_customer_id already in place");
    }

    if (names.includes("stripe_subscription_id")) {
      await connection.query(
        `ALTER TABLE user_subscriptions
         RENAME COLUMN stripe_subscription_id TO provider_subscription_id`
      );
      console.log("✓ renamed stripe_subscription_id -> provider_subscription_id");
    } else {
      console.log("· provider_subscription_id already in place");
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
