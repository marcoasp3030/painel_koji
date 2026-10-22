/** Leitura e escrita de módulos da empresa e do agente (MULTI1-a). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import type { ModulosAgente, ModulosEmpresa } from "./gateway/modulos";

const idModulo = z.string().regex(/^[a-z0-9_]{2,40}$/);

export const obterModulosEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<ModulosEmpresa>("GET", ["modulos"]);
      return {
        itens: Array.isArray(dados.itens) ? dados.itens : [],
        em_uso: Array.isArray(dados.em_uso) ? dados.em_uso : [],
        telas: Array.isArray(dados.telas) ? dados.telas : [],
      } satisfies ModulosEmpresa;
    });
  });

/** Só plataforma liga/desliga o módulo na empresa. */
export const alterarModuloEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ empresa, modulo: idModulo, ativo: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      // PUT de módulo da empresa é só plataforma (sessao.plataforma + caminho global? Não:
      // a rota é /tenants/{t}/modulos/{m}. A REGRAS não inclui PUT modulos para admin —
      // plataforma passa por autorizar sem tabela. Garantimos super_admin aqui.
      if (!sessao.perfil.superAdmin) {
        const { AcessoNegado } = await import("./gateway/modulo.server");
        throw new AcessoNegado("Só a plataforma liga ou desliga módulos da empresa.");
      }
      const t = await sessao.tenant(data.empresa);
      await t.chamar("PUT", ["modulos", data.modulo], {
        corpo: { ativo: data.ativo },
      });
      return { ok: true as const };
    });
  });

export const obterModulosAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, agente: idRecurso }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { exigirAgenteVisivel } = await import("./gateway/ocultos");
      await exigirAgenteVisivel(t, data.agente);
      const { dados } = await t.chamar<ModulosAgente>("GET", ["agentes", data.agente, "modulos"]);
      return dados;
    });
  });

/** Admin/plataforma: lista ou null (= padrão do modelo). */
export const alterarModulosAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        agente: idRecurso,
        modulos_ligados: z.array(idModulo).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { exigirAgenteVisivel } = await import("./gateway/ocultos");
      await exigirAgenteVisivel(t, data.agente);
      await t.chamar("PATCH", ["agentes", data.agente], {
        corpo: { modulos_ligados: data.modulos_ligados },
      });
      return { ok: true as const };
    });
  });
