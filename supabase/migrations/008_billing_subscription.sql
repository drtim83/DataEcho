-- Tracks the recurring subscription created once a payment method is on file:
-- one licensed item (per-connector count) and one metered item (GB overage).
ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS connector_item_id TEXT,
  ADD COLUMN IF NOT EXISTS usage_item_id TEXT;
