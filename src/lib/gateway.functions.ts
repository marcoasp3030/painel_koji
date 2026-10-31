/**
 * Funções de servidor que o navegador chama para falar com o gateway.
 * Este arquivo também vai para o bundle do navegador: o módulo do gateway
 * só é importado dentro dos handlers, que rodam no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Papel do usuário logado no gateway. Para usuários de empresa o tenant
 * vinculado não é devolvido: o servidor decide em cada chamada.
 * Não exige aal2: o menu e o seletor precisam do papel já em aal1
 * (cadastro MFA / conta de emergência sem fator). As ações de negócio
 * continuam passando por sessaoGatewayMfa.
 */
export const obterAcessoGateway = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const g = await import("./gateway/painel.server");
    return g.comGateway(async () => g.papelDaSessao(await g.sessaoGateway(context)));
  });
