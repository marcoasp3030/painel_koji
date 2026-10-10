import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import type { Pagina } from "./gateway/tipos";
import {
  avancarCursor,
  chaveNovidades,
  desdeDoCursor,
  ordenarConversas,
  contarEsperasVisiveis,
  type Conversa,
  type Eventos,
} from "./gateway/conversas";

const conversa = z.string().min(3).max(300);
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
      const { agentesOcultos, exigirAgenteVisivel } = await import("./gateway/ocultos");
      if (data.agente) await exigirAgenteVisivel(t, data.agente);
      const ocultos = await agentesOcultos(t);
      const { empresa: _, ...query } = data;
      if (data.aguardando === true) {
        // A API ordena por ID; reúne a fila de espera para ordenar globalmente por idade.
        const itens: Conversa[] = [];
        let cursor: string | null = null;
        for (let pagina = 0; pagina < 20; pagina++) {
          const { dados }: { dados: Pagina<Conversa> } = await t.chamar("GET", ["conversas"], {
            query: { ...query, aguardando: true, cursor, limite: 100 },
          });
          itens.push(...dados.itens.filter((c) => !ocultos.has(c.agente_id)));
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
      return { ...dados, itens: dados.itens.filter((c) => !ocultos.has(c.agente_id)) };
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
