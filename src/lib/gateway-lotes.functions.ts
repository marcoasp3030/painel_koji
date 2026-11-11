/** Lotes de notas (LOTE1-a). */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ArquivoLoteResumo,
  LoteProgresso,
  NotaLote,
  RespostaEnvioArquivoLote,
} from "./gateway/lotes";

type Pagina<T> = { itens: T[]; proximo_cursor: string | null };

async function lotes<T>(context: unknown, data: unknown): Promise<T> {
  const g = await import("./gateway/painel.server");
  const { executarLotes } = await import("./gateway/lotes.server");
  return g.executar(context as Parameters<typeof g.executar>[0], (s) =>
    executarLotes(s, data),
  ) as Promise<T>;
}

export const listarLotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => lotes<Pagina<LoteProgresso>>(context, data));

export const criarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => lotes<LoteProgresso>(context, data));

export const obterLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => lotes<LoteProgresso>(context, data));

export const enviarArquivoLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => lotes<RespostaEnvioArquivoLote>(context, data));

export const listarArquivosLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => lotes<Pagina<ArquivoLoteResumo>>(context, data));

export const listarNotasLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) =>
    lotes<{ lote_id: string; estado: string; total: number; itens: NotaLote[] }>(context, data),
  );

export const fecharLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => lotes<LoteProgresso>(context, data));

export const apagarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(({ data, context }) => lotes<LoteProgresso>(context, data));
