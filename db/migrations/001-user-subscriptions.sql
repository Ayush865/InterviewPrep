-- ============================================
-- USER SUBSCRIPTIONS TABLE (Stripe)
-- Tracks Pro plan subscriptions: status, billing period, expiration.
-- users.premium_user stays as a fast denormalized flag kept in sync
-- by the Stripe webhook; this table is the source of truth.
-- ============================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID',
  user_id VARCHAR(255) NOT NULL UNIQUE COMMENT 'Clerk user ID',
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL COMMENT 'Stripe status: active, trialing, past_due, canceled, incomplete, unpaid',
  plan VARCHAR(50) NOT NULL DEFAULT 'pro',
  current_period_start DATETIME NULL COMMENT 'Start of current billing period (UTC)',
  current_period_end DATETIME NULL COMMENT 'Expiration / renewal of current period (UTC)',
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_sub_user (user_id),
  INDEX idx_sub_stripe_customer (stripe_customer_id),
  INDEX idx_sub_status (status),
  INDEX idx_sub_period_end (current_period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stripe Pro subscriptions per user';
