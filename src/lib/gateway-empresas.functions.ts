/** Empresas (tenants) do gateway: só o admin da plataforma. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EmpresaGateway, EmpresaPainel, Pagina } from "./gateway/tipos";

const idTenant = z.string().regex(/^[a-z0-9_]{3,40}$/, "Use 3 a 40 letras minúsculas, números ou _.");
const fuso = z.string().min(3).max(64);

export const listarEmpresasGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cursor: z.string().max(40).nullish() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      const { dados } = await plataforma.chamar<Pagina<EmpresaGateway>>("GET", ["tenants"], {
        query: { limite: 100, cursor: data.cursor },
      });
      const painel: EmpresaPainel[] = await g.empresasDoPainel(sessao);
      return { ...dados, empresasPainel: painel };
    });
  });

export const criarEmpresaGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: idTenant,
        nome: z.string().trim().min(1).max(200),
        plano: z.string().trim().max(60).nullish(),
        limite_turnos_mes: z.number().int().min(0).nullish(),
        timezone: fuso,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const corpo = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && v !== ""));
      const { dados } = await (await sessao.plataforma()).chamar<EmpresaGateway>("POST", ["tenants"], {
        corpo,
      });
      return dados;
    });
  });

export const alterarEmpresaGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: idTenant,
        dados: z
          .object({
            nome: z.string().trim().min(1).max(200),
            plano: z.string().trim().max(60).nullable(),
            limite_turnos_mes: z.number().int().min(0).nullable(),
            timezone: fuso,
            retencao_dias: z.number().int().positive(),
            tenant_teste: z.boolean(),
            status: z.enum(["ativo", "suspenso"]),
          })
          .partial()
          .strict(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      // O admin da plataforma passa pela regra do módulo; empresa é recusada lá.
      const tenant = await sessao.tenant(data.id);
      const { dados } = await tenant.chamar<EmpresaGateway>("PATCH", [], { corpo: data.dados });
      return dados;
    });
  });

export const vincularEmpresaGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ gatewayTenantId: idTenant, painelTenantId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, (sessao) =>
      g.definirVinculo(sessao, data.gatewayTenantId, data.painelTenantId),
    );
  });
