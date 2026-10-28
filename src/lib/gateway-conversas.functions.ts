import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buscaRestrita, telefoneParaPapel } from "@/lib/acesso/papeis";
import { empresa, idRecurso } from "./gateway/esquemas";
import type { Pagina } from "./gateway/tipos";
import {
  avancarCursor,
  chaveNovidades,
  desdeDoCursor,
  ordenarConversas,
  contarEsperasVisiveis,
  ESTADOS_CONVERSA,
  MOTIVO_NOME,
  validarNomeCadastro,
  type ContatoPainel,
  type Conversa,
  type EstadoConversa,
  type Eventos,
} from "./gateway/conversas";

const conversa = z.string().min(3).max(300);
const ESTADOS = ESTADOS_CONVERSA as [EstadoConversa, ...EstadoConversa[]];
export const listarConversas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        agente: idRecurso.optional(),
        canal: idRecurso.optional(),
        aguardando: z.boolean().optional(),
        status: z.enum(["ativa", "pausada"]).optional(),
        estado: z.array(z.enum(ESTADOS)).min(1).max(4).optional(),
        ordem: z.enum(["id", "recentes"]).optional(),
        busca: z.string().max(200).optional(),
        desde: z.string().datetime({ offset: true }).optional(),
        cursor: z.string().max(300).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      if (buscaRestrita(t.papel, data.busca)) {
        const { GatewayErro } = await import("./gateway/erros");
        throw new GatewayErro({
          codigo: "VALIDATION_ERROR",
          status: 400,
          mensagem: "A busca do funcionário aceita nome ou só os 4 últimos dígitos do telefone.",
        });
      }
      const { agentesOcultos, exigirAgenteVisivel } = await import("./gateway/ocultos");
      if (data.agente) await exigirAgenteVisivel(t, data.agente);
      const ocultos = await agentesOcultos(t);
      const { empresa: _, estado, ...resto } = data;
      const query = { ...resto, ...(estado ? { estado: [...new Set(estado)].join(",") } : {}) };
      if (data.aguardando === true) {
        // A API ordena por ID; reúne a fila de espera para ordenar globalmente por idade.
        const itens: Conversa[] = [];
        let cursor: string | null = null;
        for (let pagina = 0; pagina < 20; pagina++) {
          const { dados }: { dados: Pagina<Conversa> } = await t.chamar("GET", ["conversas"], {
            query: { ...query, aguardando: true, cursor, limite: 100 },
          });
          itens.push(
            ...dados.itens
              .filter((c) => !ocultos.has(c.agente_id))
              .map((c) => mascararConversa(t.papel, c)),
          );
          if (!dados.proximo_cursor)
            return { itens: ordenarConversas(itens), proximo_cursor: null };
          if (dados.proximo_cursor === cursor) break;
          cursor = dados.proximo_cursor;
        }
        const { GatewayErro } = await import("./gateway/erros");
        throw new GatewayErro({
          codigo: "VALIDATION_ERROR",
          status: 400,
          mensagem: "Há muitas conversas aguardando. Restrinja os filtros por agente ou canal.",
        });
      }
      const { dados } = await t.chamar<Pagina<Conversa>>("GET", ["conversas"], {
        query: { ...query, limite: 100 },
      });
      return {
        ...dados,
        itens: dados.itens
          .filter((c) => !ocultos.has(c.agente_id))
          .map((c) => mascararConversa(t.papel, c)),
      };
    });
  });
export const obterCursorEventos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      // Uma leitura, antes da lista: não cria evento e não devolve histórico.
      const { dados } = await t.chamar<{ ultimo_id: number }>("GET", ["eventos", "cursor"]);
      return {
        ultimo_id: desdeDoCursor(dados.ultimo_id),
        chaveLocal: chaveNovidades(sessao.perfil.userId, t.id),
      };
    });
  });
export const acompanharConversas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ empresa, desde: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { exigirConversaVisivel } = await import("./gateway/ocultos");
      let novosAguardando = 0;
      const resultado = await avancarCursor(async (desde, limite) => {
        const p = (await t.chamar<Eventos>("GET", ["eventos"], { query: { desde, limite } })).dados;
        novosAguardando += await contarEsperasVisiveis(p.itens ?? [], (alvo) =>
          exigirConversaVisivel(t, alvo),
        );
        return p;
      }, data.desde);
      // Os eventos brutos (inclusive de agentes ocultos) nunca chegam ao navegador.
      return {
        ...resultado,
        novosAguardando,
        chaveLocal: chaveNovidades(sessao.perfil.userId, t.id),
      };
    });
  });
export const atenderConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        conversa,
        acao: z.enum(["assumir", "devolver", "mensagens"]),
        minutos: z.number().int().min(1).max(1440).optional(),
        texto: z.string().trim().min(1).max(20000).optional(),
      })
      .superRefine((d, c) => {
        if (d.acao === "mensagens" && !d.texto)
          c.addIssue({ code: "custom", path: ["texto"], message: "Escreva a mensagem." });
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      await (await import("./gateway/ocultos")).exigirConversaVisivel(t, data.conversa);
      return (
        await t.chamar<{ ok: boolean; send_mode?: string }>(
          "POST",
          ["conversas", data.conversa, data.acao],
          {
            corpo:
              data.acao === "mensagens"
                ? { texto: data.texto }
                : data.acao === "assumir"
                  ? { minutos: data.minutos ?? 60 }
                  : {},
          },
        )
      ).dados;
    });
  });
/**
 * Nome de cadastro do contato da conversa (PED1-c). Qualquer papel; o gateway audita pelo X-Actor.
 * Vazio vira null: apaga o cadastro e volta a valer o próximo nome da prioridade.
 */
export const editarNomeContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ empresa, conversa, contato: idRecurso, nome: z.string().max(200).nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { GatewayErro } = await import("./gateway/erros");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      await (await import("./gateway/ocultos")).exigirConversaVisivel(t, data.conversa);
      // O contato precisa ser o desta conversa: não deixa renomear contato de outra conversa pelo ID.
      const identificador = data.conversa.split(":").slice(2).join(":");
      const { dados: pagina } = await t.chamar<Pagina<Conversa>>("GET", ["conversas"], {
        query: { busca: identificador.slice(0, 200), limite: 100 },
      });
      const alvo = pagina.itens.find((c) => c.conversation_id === data.conversa);
      if (!alvo || alvo.contato_id !== data.contato) {
        throw new GatewayErro({
          codigo: "NOT_FOUND",
          status: 404,
          mensagem: "Contato não encontrado nesta conversa.",
        });
      }
      const validado = validarNomeCadastro(data.nome ?? "");
      if (!validado.ok) {
        throw new GatewayErro({
          codigo: "VALIDATION_ERROR",
          status: 400,
          mensagem: MOTIVO_NOME[validado.motivo] ?? "Nome inválido.",
          detalhes: { campo: "nome", motivo: validado.motivo },
        });
      }
      try {
        const { dados } = await t.chamar<ContatoPainel>("PATCH", ["contatos", data.contato], {
          corpo: { nome: validado.nome },
        });
        (await import("./gateway/pedidos.server")).esquecerNomesRecentes(t.id);
        return dados;
      } catch (e) {
        if (!(e instanceof GatewayErro)) throw e;
        const motivo = e.detalhes["motivo"];
        const texto = typeof motivo === "string" ? MOTIVO_NOME[motivo] : undefined;
        if (e.status === 400 && texto) {
          throw new GatewayErro({
            codigo: "VALIDATION_ERROR",
            status: 400,
            mensagem: texto,
            detalhes: { campo: "nome", motivo },
          });
        }
        if (e.status === 409) {
          throw new GatewayErro({
            codigo: "CONFLICT",
            status: 409,
            mensagem: "Este contato foi anonimizado; o nome não pode ser alterado.",
          });
        }
        throw e;
      }
    });
  });

function mascararConversa(papel: ConversaPapel, c: Conversa): Conversa {
  if (papel !== "funcionario") return c;
  return {
    ...c,
    telefone: telefoneParaPapel(papel, c.telefone),
    telefone_formatado: telefoneParaPapel(papel, c.telefone_formatado ?? null),
    telefone_e164: telefoneParaPapel(papel, c.telefone_e164),
  };
}
type ConversaPapel = Parameters<typeof telefoneParaPapel>[0];
