-- Vínculo de cada cliente do painel com o tenant do gateway de agentes.
-- Só o admin da plataforma grava esta coluna. As políticas de tenants já
-- restringem a escrita ao super_admin; o gatilho protege a coluna mesmo que
-- alguma política futura libere a edição de outros campos.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS gateway_tenant_id text
    CONSTRAINT tenants_gateway_tenant_id_formato CHECK (gateway_tenant_id ~ '^[a-z0-9_]{3,40}$');

CREATE UNIQUE INDEX IF NOT EXISTS tenants_gateway_tenant_id_key
  ON public.tenants (gateway_tenant_id);

CREATE OR REPLACE FUNCTION public.proteger_gateway_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.gateway_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.gateway_tenant_id IS NOT DISTINCT FROM OLD.gateway_tenant_id THEN
    RETURN NEW;
  END IF;

  -- Servidor do painel (service_role) e acesso direto ao banco sem sessão.
  IF current_user = 'service_role'
     OR (auth.uid() IS NULL AND current_user NOT IN ('anon', 'authenticated')) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Somente o admin da plataforma altera o vínculo com o gateway.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tenants_proteger_gateway_tenant_id ON public.tenants;
CREATE TRIGGER tenants_proteger_gateway_tenant_id
  BEFORE INSERT OR UPDATE OF gateway_tenant_id ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.proteger_gateway_tenant_id();

-- Vínculo inicial combinado com o Marco: cliente koji → tenant bykoji.
UPDATE public.tenants
   SET gateway_tenant_id = 'bykoji'
 WHERE slug = 'koji' AND gateway_tenant_id IS NULL;
