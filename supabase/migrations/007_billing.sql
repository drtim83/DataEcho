-- Stores only Stripe references (customer id, payment method id, and the
-- non-sensitive card display fields Stripe returns) — never raw card numbers.
-- Single shared workspace, so this is expected to hold at most one row.

CREATE TABLE billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT NOT NULL,
  default_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view billing status"
  ON billing_accounts FOR SELECT
  TO authenticated
  USING (true);

-- Managing payment methods is treated like connector management: admin-only.
CREATE POLICY "Admins can insert billing accounts"
  ON billing_accounts FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update billing accounts"
  ON billing_accounts FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
