CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  tenant_name text,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  target text,
  status text NOT NULL DEFAULT 'success',
  detail text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "tenant members read own audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX audit_logs_tenant_created_idx ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);