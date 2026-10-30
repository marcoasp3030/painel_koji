-- Hashes dos códigos de recuperação da segunda etapa.
-- A política existente de conta_seguranca continua só de leitura para a sessão.
-- O texto do código não é guardado.

ALTER TABLE public.conta_seguranca
  ADD COLUMN IF NOT EXISTS codigos_recuperacao text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.conta_seguranca.codigos_recuperacao IS
  'Hashes SHA-256 dos códigos de recuperação. O texto do código não é guardado.';
