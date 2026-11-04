/** PED-BI: GET pedidos/indicadores — visão de vendas (gestor e acima). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa } from "./gateway/esquemas";
import type { IndicadoresPedidos } from "./pedidos-visao-vendas";
import { MAX_DIAS_PERIODO, ORIGEM_COM_TESTE, ORIGEM_SO_REAL } from "./pedidos-visao-vendas";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const lerIndicadoresPedidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        de: dia,
        ate: dia,
        unidade: z.string().max(80).optional(),
        incluir_teste_piloto: z.boolean().optional(),
        sumido_dias: z.number().int().min(7).max(365).optional(),
        agrupar: z.enum(["dia", "semana", "mes"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const origem = data.incluir_teste_piloto ? ORIGEM_COM_TESTE : ORIGEM_SO_REAL;
      return (
        await t.chamar<IndicadoresPedidos>("GET", ["pedidos", "indicadores"], {
          query: {
            de: data.de,
            ate: data.ate,
            origem,
            ...(data.unidade ? { unidade: data.unidade } : {}),
            ...(data.sumido_dias != null ? { sumido_dias: data.sumido_dias } : {}),
            ...(data.agrupar ? { agrupar: data.agrupar } : {}),
          },
        })
      ).dados;
    });
  });

export { MAX_DIAS_PERIODO };
