-- BRavo 0.3B: Partners foundation. Additive only; no billing or public enrollment enabled.
CREATE TABLE IF NOT EXISTS bravo_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  website_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','approved','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bravo_partner_members (
  partner_id uuid NOT NULL REFERENCES bravo_partners(id) ON DELETE CASCADE,
  auth_user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(partner_id,auth_user_id)
);
CREATE TABLE IF NOT EXISTS bravo_partner_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES bravo_partners(id) ON DELETE CASCADE,
  hostname text NOT NULL UNIQUE,
  verification_token_hash text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bravo_partner_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES bravo_partners(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bravo_partner_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  monthly_price_mxn integer CHECK (monthly_price_mxn IS NULL OR monthly_price_mxn >= 0)
);
CREATE TABLE IF NOT EXISTS bravo_partner_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES bravo_partners(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES bravo_partner_plans(code),
  provider text,
  provider_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','trialing','active','past_due','canceled')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bravo_partner_services_category_idx ON bravo_partner_services(category) WHERE active=true;
CREATE INDEX IF NOT EXISTS bravo_partner_subscriptions_partner_idx ON bravo_partner_subscriptions(partner_id);
-- Partner rows must never be directly writable by anonymous web clients.
-- Future endpoints must enforce verified identity, membership and approved status.
