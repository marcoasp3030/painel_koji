/** Agentes do gateway. O módulo do servidor confere o papel em cada chamada. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso as idAgente, json } from "./gateway/esquemas";
import type {
  AgenteDetalhe,
  AgenteGateway,
  CircuitoAgente,
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
    const a = await import("./gateway/agentes");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const corpo = a.normalizarPatchAgente(data.dados);
      // Só o admin da plataforma chega aqui com campos de IA; para os demais o
      // módulo recusa o PATCH logo abaixo.
      // Piloto ligado sem contatos deixaria o agente mudo: vale para todos os papéis.
      if (a.tocaPiloto(corpo)) {
        const { dados: atual } = await t.chamar<AgenteDetalhe>("GET", ["agentes", data.agente]);
        a.conferirPiloto(atual.configuracao_efetiva ?? {}, corpo);
      }
      if (t.papel === "plataforma" && a.tocaIaReal(corpo)) {
        const [{ dados: atual }, { dados: empresa }] = await Promise.all([
          t.chamar<AgenteDetalhe>("GET", ["agentes", data.agente]),
          t.chamar<{ tenant_teste: boolean }>("GET"),
        ]);
        const efetivo = atual.configuracao_efetiva?.["agente_mode"];
        a.conferirIaReal(
          {
            ...atual,
            agente_mode_efetivo: typeof efetivo === "string" ? efetivo : null,
          },
          corpo,
          empresa.tenant_teste,
        );
      }
      try {
        const { dados } = await t.chamar<AgenteGateway>("PATCH", ["agentes", data.agente], {
          corpo,
        });
        return dados;
      } catch (erro) {
        throw a.explicarConflitoAgente(erro);
      }
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

export const obterCircuito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, agente: idAgente }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<CircuitoAgente>("GET", ["agentes", data.agente, "circuito"]);
      return dados;
    });
  });

/** Testa a conexão com o Skyone sem mudar o modo do agente (só admin da plataforma). */
export const testarConexaoSkyone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, agente: idAgente }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { GatewayErro } = await import("./gateway/erros");
    const { PARAMETRO_TESTE_REAL } = await import("./gateway/recursos");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      if (t.papel !== "plataforma") {
        throw new GatewayErro({
          codigo: "FORBIDDEN",
          status: 403,
          mensagem: "O teste de conexão é restrito ao admin da plataforma.",
        });
      }
      if (!PARAMETRO_TESTE_REAL) {
        throw new GatewayErro({
          codigo: "NOT_IMPLEMENTED",
          status: 501,
          mensagem: "O teste de conexão depende de uma atualização do gateway.",
        });
      }
      try {
        const { dados } = await t.chamar<ResultadoTeste>(
          "POST",
          ["agentes", data.agente, "testar"],
          {
            corpo: { [PARAMETRO_TESTE_REAL]: true },
            tempoLimiteMs: 620_000,
          },
        );
        return dados;
      } catch (erro) {
        if (erro instanceof GatewayErro && erro.codigo === "CREDENTIAL_REJECTED") {
          throw new GatewayErro({
            codigo: erro.codigo,
            status: erro.status,
            mensagem: "O Skyone recusou o usuário ou a senha. Confira no fluxo e salve de novo.",
          });
        }
        if (erro instanceof GatewayErro && erro.codigo === "UPSTREAM_ERROR") {
          throw new GatewayErro({
            codigo: erro.codigo,
            status: erro.status,
            mensagem:
              "O Skyone não respondeu ou respondeu com erro. Confira a URL do fluxo e tente de novo em instantes.",
          });
        }
        throw erro;
      }
    });
  });
