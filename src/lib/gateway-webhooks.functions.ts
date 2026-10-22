/** Webhooks de saída da empresa. O segredo aparece uma vez, na criação. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EntregaWebhook, WebhookSaida } from "./gateway/webhooks";

async function webhook<T>(context: unknown, data: unknown): Promise<T> {
  const g = await import("./gateway/painel.server");
  const { executarWebhook } = await import("./gateway/webhooks.server");
  return g.executar(context as Parameters<typeof g.executar>[0], (s) =>
    executarWebhook(s, data),
  ) as Promise<T>;
}

export const listarWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => webhook<{ itens: WebhookSaida[] }>(context, data));

export const criarWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => webhook<WebhookSaida>(context, data));

export const editarWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => webhook<WebhookSaida>(context, data));

export const desativarWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => webhook<WebhookSaida>(context, data));

export const testarWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => webhook<{ entrega_id: number; status: string }>(context, data));

export const entregasWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => webhook<{ itens: EntregaWebhook[] }>(context, data));
