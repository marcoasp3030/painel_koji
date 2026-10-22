/** Follow-ups da conversa e reativação do contato. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ListaFollowUp, OptOutFollowUp } from "./gateway/followup";

async function follow<T>(context: unknown, data: unknown): Promise<T> {
  const g = await import("./gateway/painel.server");
  const { executarFollowUp } = await import("./gateway/followup.server");
  return g.executar(context as Parameters<typeof g.executar>[0], (s) =>
    executarFollowUp(s, data),
  ) as Promise<T>;
}

export const listarFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => follow<ListaFollowUp>(context, data));

export const cancelarFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => follow<{ ok: boolean; cancelados: number }>(context, data));

export const reativarOptOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => follow<OptOutFollowUp>(context, data));
