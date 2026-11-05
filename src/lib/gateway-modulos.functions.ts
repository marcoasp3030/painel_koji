/** Leitura e escrita de módulos da empresa e do agente (MULTI1-a). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import {
  MODULOS_PAINEL,
  ehModuloPainel,
  type ModuloPainel,
  type ModulosAgente,
  type ModulosEmpresa,
} from "./gateway/modulos";

const idModulo = z.string().regex(/^[a-z0-9_]{2,40}$/);

export const obterModulosEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      // Supervisor e funcionário só precisam saber quais telas a empresa usa: sem isso o menu
      // esconderia Pedidos e Cardápio. O catálogo de módulos continua com gestor e plataforma.
      const gere = t.papel === "plataforma" || t.papel === "gestor";
      const { dados } = gere
        ? await t.chamar<ModulosEmpresa>("GET", ["modulos"])
        : await t.leituraDeApoio<ModulosEmpresa>(["modulos"]);
      return {
        itens: gere && Array.isArray(dados.itens) ? dados.itens : [],
        em_uso: Array.isArray(dados.em_uso) ? dados.em_uso : [],
        telas: Array.isArray(dados.telas) ? dados.telas : [],
        // Todos os papéis recebem: o menu e as telas da empresa dependem disso.
        bloqueadas: Array.isArray(dados.bloqueadas) ? dados.bloqueadas.filter(ehModuloPainel) : [],
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

const idModuloPainel = z.enum(MODULOS_PAINEL.map((m) => m.id) as [ModuloPainel, ...ModuloPainel[]]);

/** TELAS1: só o super admin define quais módulos do painel a empresa usa. */
export const alterarModulosPainelEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ empresa, bloqueadas: z.array(idModuloPainel).max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      if (!sessao.perfil.superAdmin) {
        const { AcessoNegado } = await import("./gateway/modulo.server");
        throw new AcessoNegado("Só o super admin libera ou bloqueia módulos da empresa.");
      }
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<{ bloqueadas: string[] }>("PUT", ["telas"], {
        corpo: { bloqueadas: data.bloqueadas },
      });
      return { bloqueadas: (dados.bloqueadas ?? []).filter(ehModuloPainel) };
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
