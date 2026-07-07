-- ============================================
-- Make user_subscriptions provider-agnostic
-- (support Razorpay alongside Stripe)
-- ============================================
ALTER TABLE user_subscriptions
  ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'stripe' AFTER user_id;

ALTER TABLE user_subscriptions
  RENAME COLUMN stripe_customer_id TO provider_customer_id;

ALTER TABLE user_subscriptions
  RENAME COLUMN stripe_subscription_id TO provider_subscription_id;
