-- Isolamento entre empresas.
-- As telas passam pelo servidor do painel, que confere a empresa e a sessão. O navegador não escreve em
-- tenant_users nem em integrations: pela API direta, um admin de empresa criava acesso com papel Plataforma,
-- vinculava usuário de outra empresa e cadastrava a loja de outra empresa.

-- Quem consulta só pode perguntar por si. Sem sessão de usuário (servidor e gatilhos), segue valendo.
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM public.tenant_users WHERE user_id = _user_id AND tenant_id = _tenant_id)
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM public.tenant_users WHERE user_id = _user_id AND tenant_id = _tenant_id AND is_tenant_admin)
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- A subconsulta em tenant_users dentro da política de tenant_users causava recursão infinita.
DROP POLICY IF EXISTS "members read own tenant users" ON public.tenant_users;
CREATE POLICY "members read own tenant users" ON public.tenant_users FOR SELECT TO authenticated
  USING (public.jwt_aal() = 'aal2' AND public.is_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "tenant admin manages tenant users" ON public.tenant_users;

-- Credenciais não vão ao navegador, nem para leitura.
DROP POLICY IF EXISTS "members read integrations" ON public.integrations;
DROP POLICY IF EXISTS "tenant admin manages integrations" ON public.integrations;

DROP POLICY IF EXISTS "tenant members read own audit logs" ON public.audit_logs;
CREATE POLICY "tenant members read own audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.jwt_aal() = 'aal2' AND public.is_tenant_member(auth.uid(), tenant_id));

-- Leituras que ficaram sem a exigência de MFA.
DROP POLICY IF EXISTS "members read own tenant" ON public.tenants;
CREATE POLICY "members read own tenant" ON public.tenants FOR SELECT TO authenticated
  USING (public.jwt_aal() = 'aal2' AND public.is_tenant_member(auth.uid(), id));
DROP POLICY IF EXISTS "super admin manages tenants" ON public.tenants;
CREATE POLICY "super admin manages tenants" ON public.tenants FOR ALL TO authenticated
  USING (public.jwt_aal() = 'aal2' AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.jwt_aal() = 'aal2' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins read all webhook events" ON public.webhook_events;
CREATE POLICY "Super admins read all webhook events" ON public.webhook_events FOR SELECT TO authenticated
  USING (public.jwt_aal() = 'aal2' AND public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "Tenant members read own webhook events" ON public.webhook_events;
CREATE POLICY "Tenant members read own webhook events" ON public.webhook_events FOR SELECT TO authenticated
  USING (public.jwt_aal() = 'aal2' AND tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "super admin reads integration logs" ON public.integration_request_logs;
CREATE POLICY "super admin reads integration logs" ON public.integration_request_logs FOR SELECT TO authenticated
  USING (public.jwt_aal() = 'aal2' AND public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "tenant members read own integration logs" ON public.integration_request_logs;
CREATE POLICY "tenant members read own integration logs" ON public.integration_request_logs FOR SELECT TO authenticated
  USING (public.jwt_aal() = 'aal2' AND public.is_tenant_member(auth.uid(), tenant_id));

-- Plataforma é da equipe da Luxtia (user_roles), nunca um vínculo de empresa, por qualquer caminho.
CREATE OR REPLACE FUNCTION public.recusar_papel_plataforma() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.papel_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.papeis WHERE id = NEW.papel_id AND papel_gateway = 'plataforma') THEN
    RAISE EXCEPTION 'O papel Plataforma não pode ser dado em uma empresa.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tenant_users_sem_plataforma ON public.tenant_users;
CREATE TRIGGER tenant_users_sem_plataforma BEFORE INSERT OR UPDATE OF papel_id ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.recusar_papel_plataforma();

-- Webhook da 99Food: a empresa sai de uma chave própria do endereço, não do que vem no corpo.
UPDATE public.integrations
  SET credentials = coalesce(credentials, '{}'::jsonb)
    || jsonb_build_object('webhook_token', encode(gen_random_bytes(24), 'hex'))
  WHERE provider = 'food99' AND coalesce(credentials->>'webhook_token', '') = '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_food99_webhook_token ON public.integrations ((credentials->>'webhook_token'))
  WHERE provider = 'food99';
-- Uma loja só pode estar em uma empresa. Se já houver repetição, a migração para: resolver antes de seguir.
CREATE UNIQUE INDEX IF NOT EXISTS ux_food99_shop_id ON public.integrations ((credentials->>'shop_id'))
  WHERE provider = 'food99' AND coalesce(credentials->>'shop_id', '') <> '';
CREATE UNIQUE INDEX IF NOT EXISTS ux_food99_app_shop_id ON public.integrations ((credentials->>'app_shop_id'))
  WHERE provider = 'food99' AND coalesce(credentials->>'app_shop_id', '') <> '';
