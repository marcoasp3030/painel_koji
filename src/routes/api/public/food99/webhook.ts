import { createFileRoute } from "@tanstack/react-router";

/**
 * Recebe os eventos da 99Food. Guarda o evento inteiro, sem interpretar nomes
 * de status: o mapeamento interno é feito depois, com os payloads reais.
 */
export const Route = createFileRoute("/api/public/food99/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
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

        // Descobre o cliente dono da loja pelo Shop ID ou pelo APP Shop ID salvos.
        let tenantId: string | null = null;
        const { data: rows } = await supabaseAdmin
          .from("integrations")
          .select("tenant_id, credentials")
          .eq("provider", "food99");
        for (const row of rows ?? []) {
          const creds = (row.credentials ?? {}) as Record<string, string>;
          const matches =
            (shopId && (creds["shop_id"] === shopId || creds["store_id"] === shopId)) ||
            (appShopId && creds["app_shop_id"] === appShopId);
          if (matches) {
            tenantId = row.tenant_id;
            break;
          }
        }

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
