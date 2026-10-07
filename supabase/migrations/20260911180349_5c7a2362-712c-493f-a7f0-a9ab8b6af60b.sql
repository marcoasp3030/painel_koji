CREATE TABLE public.integration_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  action text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  url text NOT NULL,
  request_payload jsonb,
  response_body text,
  http_status integer,
  duration_ms integer,
  ok boolean NOT NULL DEFAULT false,
  error_detail text,
  actor_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integration_request_logs TO authenticated;
GRANT ALL ON public.integration_request_logs TO service_role;

ALTER TABLE public.integration_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads integration logs"
ON public.integration_request_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tenant members read own integration logs"
ON public.integration_request_logs FOR SELECT TO authenticated
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX idx_integration_logs_tenant_created
ON public.integration_request_logs (tenant_id, created_at DESC);

CREATE INDEX idx_integration_logs_provider
ON public.integration_request_logs (provider, created_at DESC);