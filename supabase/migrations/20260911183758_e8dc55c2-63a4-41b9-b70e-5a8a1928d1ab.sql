ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS last_test_ok boolean,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_message text;