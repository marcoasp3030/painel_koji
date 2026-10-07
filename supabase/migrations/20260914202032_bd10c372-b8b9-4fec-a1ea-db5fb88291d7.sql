ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS auth_token text,
  ADD COLUMN IF NOT EXISTS auth_token_obtained_at timestamptz,
  ADD COLUMN IF NOT EXISTS auth_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_partner_call_at timestamptz;