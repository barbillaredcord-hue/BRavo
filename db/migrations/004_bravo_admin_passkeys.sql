-- BRavo Admin passkeys: preparation only. Do not expose public enrollment.
-- Registration must require a pre-authorized admin identity and one-time bootstrap.
CREATE TABLE IF NOT EXISTS bravo_admin_passkeys (
  credential_id text PRIMARY KEY,
  admin_email text NOT NULL,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS bravo_admin_passkeys_email_idx ON bravo_admin_passkeys(admin_email);
CREATE TABLE IF NOT EXISTS bravo_admin_passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_hash text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('register','authenticate')),
  admin_email text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bravo_admin_passkey_challenges_exp_idx ON bravo_admin_passkey_challenges(expires_at);
CREATE TABLE IF NOT EXISTS bravo_admin_sessions (
  token_hash text PRIMARY KEY,
  admin_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- The passkey verifier must enforce origin, RP ID, user verification,
-- challenge one-time use, signature and counter checks server-side.
-- Never allow an unauthenticated client to create an admin passkey.
