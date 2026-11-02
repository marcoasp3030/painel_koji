/** Números da operação: fila de agora e tempos do período. A partir de supervisor. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa } from "./gateway/esquemas";

export type PessoaOperacao = {
  atendente: string;
  mensagens: number;
  conversas: number;
  resposta_p50_s: number | null;
  esperas_assumidas: number;
  abertas_agora: number;
};
export type Operacao = {
  dias: number;
  agora: { fila: number; mais_antiga: string | null; com_atendente: number };
  periodo: {
    mensagens: number;
    conversas: number;
    resposta_p50_s: number | null;
    resposta_p95_s: number | null;
    esperas: number;
    espera_p50_s: number | null;
    espera_p95_s: number | null;
  };
  por_atendente: PessoaOperacao[];
};

export const lerOperacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ empresa, dias: z.union([z.literal(1), z.literal(7), z.literal(30)]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      return (await t.chamar<Operacao>("GET", ["operacao"], { query: { dias: data.dias } })).dados;
    });
  });
