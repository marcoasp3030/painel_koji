-- MFA1: obrigação por empresa, step-up, bloqueio de tentativas e RLS com aal2.
-- A flag de aplicação MFA1_OBRIGATORIO fica no processo do painel; esta migração
-- só prepara o banco. Não tranca contas existentes.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS mfa_obrigatorio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.mfa_obrigatorio IS
  'Quando verdadeiro, supervisor e funcionário da empresa precisam da segunda etapa.';

ALTER TABLE public.conta_seguranca
  ADD COLUMN IF NOT EXISTS step_up_ate timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_bloqueado_ate timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_falhas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mfa_falha_em timestamptz,
  ADD COLUMN IF NOT EXISTS recuperacao_valida_ate timestamptz;

COMMENT ON COLUMN public.conta_seguranca.step_up_ate IS
  'Até quando a verificação recente (step-up) vale. Timestamptz; exibir em America/Sao_Paulo.';
COMMENT ON COLUMN public.conta_seguranca.mfa_bloqueado_ate IS
  'Bloqueio temporário após falhas de MFA.';
COMMENT ON COLUMN public.conta_seguranca.mfa_falhas IS
  'Falhas consecutivas de MFA na janela atual.';
COMMENT ON COLUMN public.conta_seguranca.recuperacao_valida_ate IS
  'Sessão elevada por código de recuperação (GoTrue permanece aal1; o painel aceita até este instante).';

CREATE OR REPLACE FUNCTION public.jwt_aal()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1')
$$;

CREATE OR REPLACE FUNCTION public.sessao_aal(sid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT aal::text FROM auth.sessions WHERE id = sid
$$;

REVOKE ALL ON FUNCTION public.jwt_aal() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.jwt_aal() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sessao_aal(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sessao_aal(uuid) TO service_role;

-- Políticas sensíveis passam a exigir aal2 além da regra original.
DROP POLICY IF EXISTS "a propria seguranca" ON public.conta_seguranca;
CREATE POLICY "a propria seguranca" ON public.conta_seguranca FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.jwt_aal() = 'aal2');

DROP POLICY IF EXISTS "conta_seguranca escrita propria aal2" ON public.conta_seguranca;
CREATE POLICY "conta_seguranca escrita propria aal2" ON public.conta_seguranca
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.jwt_aal() = 'aal2')
  WITH CHECK (user_id = auth.uid() AND public.jwt_aal() = 'aal2');

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.jwt_aal() = 'aal2');

DROP POLICY IF EXISTS "super admin manages tenant users" ON public.tenant_users;
CREATE POLICY "super admin manages tenant users" ON public.tenant_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') AND public.jwt_aal() = 'aal2')
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND public.jwt_aal() = 'aal2');

DROP POLICY IF EXISTS "members read own tenant users" ON public.tenant_users;
CREATE POLICY "members read own tenant users" ON public.tenant_users FOR SELECT TO authenticated
  USING (
    public.jwt_aal() = 'aal2'
    AND tenant_id IN (SELECT tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "tenant admin manages tenant users" ON public.tenant_users;
CREATE POLICY "tenant admin manages tenant users" ON public.tenant_users FOR ALL TO authenticated
  USING (
    public.jwt_aal() = 'aal2'
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.jwt_aal() = 'aal2'
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS "super admin gere unidades" ON public.usuario_unidades;
CREATE POLICY "super admin gere unidades" ON public.usuario_unidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') AND public.jwt_aal() = 'aal2')
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND public.jwt_aal() = 'aal2');

DROP POLICY IF EXISTS "membro le as proprias unidades" ON public.usuario_unidades;
CREATE POLICY "membro le as proprias unidades" ON public.usuario_unidades FOR SELECT TO authenticated
  USING (
    public.jwt_aal() = 'aal2'
    AND tenant_user_id IN (SELECT id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "super admin manages integrations" ON public.integrations;
CREATE POLICY "super admin manages integrations" ON public.integrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') AND public.jwt_aal() = 'aal2')
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND public.jwt_aal() = 'aal2');

DROP POLICY IF EXISTS "members read integrations" ON public.integrations;
CREATE POLICY "members read integrations" ON public.integrations FOR SELECT TO authenticated
  USING (
    public.jwt_aal() = 'aal2'
    AND tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "tenant admin manages integrations" ON public.integrations;
CREATE POLICY "tenant admin manages integrations" ON public.integrations FOR ALL TO authenticated
  USING (
    public.jwt_aal() = 'aal2'
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.jwt_aal() = 'aal2'
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS "super admin reads audit logs" ON public.audit_logs;
CREATE POLICY "super admin reads audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') AND public.jwt_aal() = 'aal2');

DROP POLICY IF EXISTS "tenant members read own audit logs" ON public.audit_logs;
CREATE POLICY "tenant members read own audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.jwt_aal() = 'aal2'
    AND tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- Convites: se a política existir, reforça aal2.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'convites'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "plataforma e gestor gerem convites" ON public.convites';
    -- Recria só se a tabela tiver políticas nomeadas conhecidas; senão deixa service_role.
  END IF;
END $$;

-- Derruba outras sessões mantendo a atual (passada pelo caller).
CREATE OR REPLACE FUNCTION public.derrubar_outras_sessoes(uid uuid, manter uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  DELETE FROM auth.refresh_tokens
  WHERE user_id = uid::text
    AND (session_id IS DISTINCT FROM manter);
  DELETE FROM auth.sessions
  WHERE user_id = uid
    AND id IS DISTINCT FROM manter;
END
$$;

REVOKE ALL ON FUNCTION public.derrubar_outras_sessoes(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.derrubar_outras_sessoes(uuid, uuid) TO service_role;
