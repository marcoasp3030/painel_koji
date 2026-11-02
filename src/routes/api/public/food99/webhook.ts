import { createFileRoute } from "@tanstack/react-router";

const MAX_CORPO = 256 * 1024;

function recusa(status: number, errmsg: string) {
  return new Response(JSON.stringify({ errno: 1, errmsg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Recebe os eventos da 99Food. Guarda o evento inteiro, sem interpretar nomes
 * de status: o mapeamento interno é feito depois, com os payloads reais.
 */
export const Route = createFileRoute("/api/public/food99/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t") ?? "";
        if (!/^[0-9a-f]{32,64}$/.test(token)) return recusa(401, "unauthorized");
        const raw = await request.text();
        if (raw.length > MAX_CORPO) return recusa(413, "payload too large");
        let payload: any = null;
        try {
          payload = raw ? JSON.parse(raw) : null;
        } catch {
          payload = { raw };
        }

        const pick = (...keys: string[]) => {
          for (const key of keys) {
            const value = payload?.[key] ?? payload?.data?.[key] ?? payload?.body?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== "") {
              return String(value);
            }
          }
          return null;
        };

        const shopId = pick("shop_id", "shopId", "store_id", "storeId");
        const appShopId = pick("app_shop_id", "appShopId");
        const orderId = pick("order_id", "orderId", "id");
        const eventType = pick("event_type", "eventType", "type", "event");
        const statusOriginal = pick("status", "order_status", "orderStatus", "status_code");
        const eventTimeRaw = pick("event_time", "eventTime", "timestamp", "time", "created_at");

        let eventTime: string | null = null;
        if (eventTimeRaw) {
          const asNumber = Number(eventTimeRaw);
          const date = Number.isFinite(asNumber)
            ? new Date(asNumber > 1e12 ? asNumber : asNumber * 1000)
            : new Date(eventTimeRaw);
          if (!Number.isNaN(date.getTime())) eventTime = date.toISOString();
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // A empresa sai da chave do endereço. O corpo não prova nada: quem envia o escreve.
        const { data: integracao } = await supabaseAdmin
          .from("integrations")
          .select("tenant_id")
          .eq("provider", "food99")
          .eq("credentials->>webhook_token", token)
          .maybeSingle();
        if (!integracao) return recusa(401, "unauthorized");
        const tenantId = integracao.tenant_id;

        const { error } = await supabaseAdmin.from("webhook_events").insert({
          tenant_id: tenantId,
          platform: "99food",
          shop_id: shopId,
          order_id: orderId,
          event_type: eventType,
          status_original: statusOriginal,
          event_time: eventTime,
          payload_original: payload ?? {},
        });
        if (error) {
          return new Response(JSON.stringify({ errno: 1, errmsg: "storage error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ errno: 0, errmsg: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(JSON.stringify({ errno: 0, errmsg: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
