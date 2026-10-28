-- Ajustes do USUARIOS1 antes da publicação.
-- Não altera senha nem papel de admin@luxtia.local.

CREATE TABLE public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id uuid NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL,
  usado_em timestamptz,
  revogado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX convites_vinculo_idx ON public.convites (tenant_user_id);

GRANT ALL ON public.convites TO service_role;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conta_seguranca
  ADD COLUMN emergencia boolean NOT NULL DEFAULT false,
  ADD COLUMN ultimo_login_auditado timestamptz;

-- Apaga o token de uso único que o GoTrue gera no convite.
-- O painel mostra o próprio link e não entrega o do GoTrue.
CREATE OR REPLACE FUNCTION public.revogar_tokens_de_convite(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  DELETE FROM auth.one_time_tokens WHERE user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.revogar_tokens_de_convite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revogar_tokens_de_convite(uuid) TO service_role;

-- Marca a conta de emergência no cadastro. A senha e o papel ficam como estão.
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"conta":"emergencia"}'::jsonb
WHERE email = 'admin@luxtia.local';

INSERT INTO public.conta_seguranca (user_id, emergencia, prazo_ate)
SELECT id, true, NULL
FROM auth.users
WHERE email = 'admin@luxtia.local'
ON CONFLICT (user_id) DO UPDATE
SET emergencia = true,
    atualizado_em = now();
