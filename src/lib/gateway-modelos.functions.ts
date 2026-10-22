/** Modelos de agente (MULTI1-a §10.2). Só o admin da plataforma cria e edita. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ModeloAgenteCompleto } from "./gateway/tipos";

const idModelo = z
  .string()
  .regex(/^[a-z0-9_]{3,80}$/, "Use 3 a 80 letras minúsculas, números ou _.");
const segmento = z
  .string()
  .regex(/^[a-z0-9_]{2,40}$/, "Use 2 a 40 letras minúsculas, números ou _.");
const idItem = z.string().regex(/^[a-z0-9_]{2,40}$/);
const itemRotulado = z.object({
  id: idItem,
  rotulo: z.string().min(2).max(60),
  converte_em_solicitacao: z.boolean().optional(),
});

/** GET /modelos-agente — lista com filtros opcionais. */
export const listarModelosAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ativo: z.boolean().nullish(),
        segmento: z.string().max(40).nullish(),
        tenant: z.string().max(40).nullish(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      const query: Record<string, string | boolean> = {};
      if (data.ativo != null) query["ativo"] = data.ativo;
      if (data.segmento) query["segmento"] = data.segmento;
      if (data.tenant) query["tenant"] = data.tenant;
      const { dados } = await plataforma.chamar<{ itens: ModeloAgenteCompleto[] }>(
        "GET",
        ["modelos-agente"],
        { query },
      );
      return dados.itens;
    });
  });

/** GET /modelos-agente/{id}?versao= — detalhe de um modelo (última versão por padrão). */
export const obterModeloAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: idModelo,
        versao: z.number().int().positive().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      const query: Record<string, number> = {};
      if (data.versao) query["versao"] = data.versao;
      const { dados } = await plataforma.chamar<ModeloAgenteCompleto>(
        "GET",
        ["modelos-agente", data.id],
        { query },
      );
      return dados;
    });
  });

/** POST /modelos-agente — cria a versão 1. Só plataforma. */
export const criarModeloAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: idModelo,
        nome: z.string().trim().min(1).max(200),
        tipo: z.enum(["atendimento", "interno"]),
        segmento,
        ativo: z.boolean().optional(),
        skyone_ref: z.string().max(200).nullish(),
        modulos_permitidos: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).optional(),
        modulos_padrao: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).optional(),
        motivos_transferencia: z.array(itemRotulado).max(30).optional(),
        tipos_solicitacao: z.array(itemRotulado).max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      const corpo: Record<string, unknown> = { ...data };
      // Limpa os que vieram undefined
      for (const [k, v] of Object.entries(corpo)) {
        if (v === undefined || v === null) delete corpo[k];
      }
      const { dados } = await plataforma.chamar<ModeloAgenteCompleto>("POST", ["modelos-agente"], {
        corpo,
      });
      return dados;
    });
  });

/**
 * PATCH /modelos-agente/{id} — cria uma nova versão do modelo.
 * Agentes existentes continuam na versão em que estão.
 */
export const editarModeloAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: idModelo,
        nome: z.string().trim().min(1).max(200).optional(),
        tipo: z.enum(["atendimento", "interno"]).optional(),
        segmento: segmento.optional(),
        ativo: z.boolean().optional(),
        skyone_ref: z.string().max(200).nullable().optional(),
        modulos_permitidos: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).optional(),
        modulos_padrao: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).optional(),
        motivos_transferencia: z.array(itemRotulado).max(30).optional(),
        tipos_solicitacao: z.array(itemRotulado).max(30).optional(),
        comportamento_padrao: z.record(z.string(), z.unknown()).optional(),
        perfil_padrao: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      const { id, ...resto } = data;
      const corpo: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(resto)) {
        if (v !== undefined) corpo[k] = v;
      }
      const { dados } = await plataforma.chamar<ModeloAgenteCompleto>(
        "PATCH",
        ["modelos-agente", id],
        { corpo },
      );
      return dados;
    });
  });
