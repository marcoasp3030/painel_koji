import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Comportamento do agente (CFG1-a): todas as ações passam por aqui; a chave fica no servidor. */
export const atendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarAtendimento } = await import("./gateway/atendimento.server");
    return g.executar(context, (s) => executarAtendimento(s, data));
  });
