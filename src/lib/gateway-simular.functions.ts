/** Simulação de conversa (mock/dry), histórico e envio de documento. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import type { DocumentoResumo } from "./gateway/documentos";
import type { MensagemGateway } from "./gateway/tipos";
import type { ResultadoDocumentoSimulado } from "./gateway/simular.server";

const idAnexo = z.string().regex(/^anx_[0-9a-f]{24}$/);

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
    const { executarMensagemSimulada } = await import("./gateway/simular.server");
    return g.executar(context, (sessao) => executarMensagemSimulada(sessao, data));
  });

export const simularDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarEnvioDocumento } = await import("./gateway/simular.server");
    return g.executar(context, (sessao) =>
      executarEnvioDocumento(sessao, data),
    ) as Promise<ResultadoDocumentoSimulado>;
  });

export const capacidadeDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, agente: idRecurso }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarCapacidadeDocumentos } = await import("./gateway/simular.server");
    return g.executar(context, (sessao) =>
      executarCapacidadeDocumentos(sessao, data.empresa, data.agente),
    );
  });

export const anexosDaConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ empresa, conversa: z.string().min(3).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarAnexosDaConversa } = await import("./gateway/simular.server");
    return g.executar(context, (sessao) =>
      executarAnexosDaConversa(sessao, data.empresa, data.conversa),
    ) as Promise<{ itens: DocumentoResumo[] }>;
  });

export const anexoDoSimulador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, anexo: idAnexo }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarAnexo } = await import("./gateway/simular.server");
    return g.executar(context, (sessao) => executarAnexo(sessao, data.empresa, data.anexo));
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
