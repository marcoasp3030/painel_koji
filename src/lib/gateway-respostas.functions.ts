/** Respostas rápidas do atendimento. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ListaRespostas, RespostaRapida } from "./gateway/respostas-rapidas";

async function respostas<T>(context: unknown, data: unknown): Promise<T> {
  const g = await import("./gateway/painel.server");
  const { executarRespostas } = await import("./gateway/respostas-rapidas.server");
  return g.executar(context as Parameters<typeof g.executar>[0], (s) =>
    executarRespostas(s, data),
  ) as Promise<T>;
}

export const listarRespostas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => respostas<ListaRespostas>(context, data));

export const gravarResposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => respostas<RespostaRapida>(context, data));

export const removerOuContarResposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => respostas<{ ok: boolean }>(context, data));
