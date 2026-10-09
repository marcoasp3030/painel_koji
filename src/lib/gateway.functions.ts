/**
 * Funções de servidor que o navegador chama para falar com o gateway.
 * Este arquivo também vai para o bundle do navegador: o módulo do gateway
 * só é importado dentro dos handlers, que rodam no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** O que o usuário logado pode ver no gateway. */
export const obterAcessoGateway = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const g = await import("./gateway/painel.server");
    return g.comGateway(async () => {
      const sessao = await g.sessaoGateway(context);
      return {
        superAdmin: sessao.perfil.superAdmin,
        tenants: sessao.perfil.vinculos.filter((v) => v.ativo).map((v) => v.gatewayTenantId),
      };
    });
  });
