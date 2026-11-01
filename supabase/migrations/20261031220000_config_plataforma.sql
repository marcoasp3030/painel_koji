-- Configurações globais da plataforma (só service_role / super admin via API).

CREATE TABLE IF NOT EXISTS public.config_plataforma (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mfa_desativado boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

COMMENT ON TABLE public.config_plataforma IS
  'Uma linha: ajustes globais. mfa_desativado desliga a obrigação e a exigência de aal2 em todo o painel.';

INSERT INTO public.config_plataforma (id, mfa_desativado)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

GRANT ALL ON public.config_plataforma TO service_role;
ALTER TABLE public.config_plataforma ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: só service_role.

-- PostgREST precisa recarregar o schema após criar a tabela.
NOTIFY pgrst, 'reload schema';
