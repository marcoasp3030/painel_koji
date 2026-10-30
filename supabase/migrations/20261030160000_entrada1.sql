-- ENTRADA1: limite de tentativas de login/MFA e links de redefinição de senha.

CREATE TABLE IF NOT EXISTS public.entrada_tentativas (
  chave text PRIMARY KEY,
  falhas integer NOT NULL DEFAULT 0,
  falha_em timestamptz,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.entrada_tentativas IS
  'Contador de falhas de login/MFA por e-mail (e IP quando houver). Sem senha.';

CREATE TABLE IF NOT EXISTS public.redefinicoes_senha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL,
  usado_em timestamptz,
  revogado_em timestamptz,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS redefinicoes_senha_user_idx
  ON public.redefinicoes_senha (user_id);

COMMENT ON TABLE public.redefinicoes_senha IS
  'Link de redefinição de uso único (24 h), gerado por gestor/plataforma sem SMTP.';

GRANT ALL ON public.entrada_tentativas, public.redefinicoes_senha TO service_role;
ALTER TABLE public.entrada_tentativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redefinicoes_senha ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: só service_role.
