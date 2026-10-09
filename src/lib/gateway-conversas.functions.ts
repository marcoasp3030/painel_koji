import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import type { Pagina } from "./gateway/tipos";
import {
  avancarCursor,
  chaveNovidades,
  desdeDoCursor,
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
      const resultado = await avancarCursor(
        async (desde, limite) =>
          (await t.chamar<Eventos>("GET", ["eventos"], { query: { desde, limite } })).dados,
        data.desde,
      );
      // Os eventos brutos (inclusive de agentes ocultos) nunca chegam ao navegador.
      return { ...resultado, chaveLocal: chaveNovidades(sessao.perfil.userId, t.id) };
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
