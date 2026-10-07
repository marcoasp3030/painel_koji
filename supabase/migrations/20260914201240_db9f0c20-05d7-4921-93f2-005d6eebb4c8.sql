CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform text NOT NULL,
  shop_id text,
  order_id text,
  event_type text,
  status_original text,
  event_time timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_original jsonb NOT NULL
);

CREATE INDEX webhook_events_tenant_idx ON public.webhook_events (tenant_id, received_at DESC);
CREATE INDEX webhook_events_order_idx ON public.webhook_events (platform, order_id, received_at DESC);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read own webhook events"
ON public.webhook_events FOR SELECT TO authenticated
USING (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Super admins read all webhook events"
ON public.webhook_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));