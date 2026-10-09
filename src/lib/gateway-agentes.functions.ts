/** Agentes do gateway. O módulo do servidor confere o papel em cada chamada. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso as idAgente, json } from "./gateway/esquemas";
import type {
  AgenteDetalhe,
  AgenteGateway,
  ModeloAgente,
  Pagina,
  ResultadoTeste,
} from "./gateway/tipos";

export const listarAgentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<Pagina<AgenteGateway>>("GET", ["agentes"], {
        query: { limite: 99 },
      });
      return dados;
    });
  });

export const obterAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, agente: idAgente }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<AgenteDetalhe>("GET", ["agentes", data.agente]);
      return dados;
    });
  });

export const listarModelos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await (
        await sessao.plataforma()
      ).chamar<{ itens: ModeloAgente[] }>("GET", ["modelos-agente"], { query: { tenant: t.id } });
      // Mostra só a última versão de cada modelo.
      const ultimas = new Map<string, ModeloAgente>();
      for (const m of dados.itens) {
        const atual = ultimas.get(m.id);
        if (!atual || m.versao > atual.versao) ultimas.set(m.id, m);
      }
      return [...ultimas.values()];
    });
  });

export const criarAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        modelo_id: z.string().regex(/^[a-z0-9_]{3,80}$/),
        nome: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<AgenteGateway>("POST", ["agentes"], {
        corpo: { modelo_id: data.modelo_id, nome: data.nome },
      });
      return dados;
    });
  });

export const alterarAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        agente: idAgente,
        // Os campos aceitos dependem do papel; o módulo do servidor decide.
        dados: z.record(z.string(), json),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<AgenteGateway>("PATCH", ["agentes", data.agente], {
        corpo: data.dados,
      });
      return dados;
    });
  });

export const testarAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, agente: idAgente }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      // timeout_s do agente vai até 600 s; o gateway responde dentro desse prazo.
      const { dados } = await t.chamar<ResultadoTeste>("POST", ["agentes", data.agente, "testar"], {
        tempoLimiteMs: 620_000,
      });
      return dados;
    });
  });
