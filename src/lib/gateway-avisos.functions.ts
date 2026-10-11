import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const avisos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarAvisos } = await import("./gateway/avisos.server");
    return g.executar(context, (s) => executarAvisos(s, data));
  });
