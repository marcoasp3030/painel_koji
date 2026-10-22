/** Simulação de conversa (mock/dry) e histórico. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import type { MensagemGateway, ResultadoSimulacao } from "./gateway/tipos";

export const simularMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        agente: idRecurso,
        canal_id: idRecurso,
        identificador: z.string().trim().min(1).max(100),
        texto: z.string().trim().min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      await (await import("./gateway/ocultos")).exigirAgenteVisivel(t, data.agente);
      const { dados } = await t.chamar<ResultadoSimulacao>(
        "POST",
        ["agentes", data.agente, "simular"],
        {
          corpo: {
            canal_id: data.canal_id,
            identificador: data.identificador,
            texto: data.texto,
          },
        },
      );
      return dados;
    });
  });

export const historicoConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        conversa: z.string().min(3).max(300),
        atendimento: z
          .string()
          .regex(/^at_[a-z0-9]+$/)
          .optional(),
        antes: z.number().int().positive().nullish(),
        limite: z.number().int().min(1).max(100).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      await (await import("./gateway/ocultos")).exigirConversaVisivel(t, data.conversa);
      const { dados } = await t.chamar<{ itens: MensagemGateway[]; tem_mais: boolean }>(
        "GET",
        ["conversas", data.conversa, "mensagens"],
        { query: { antes: data.antes, limite: data.limite ?? 50, atendimento: data.atendimento } },
      );
      return dados;
    });
  });
