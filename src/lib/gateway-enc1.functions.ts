import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const gerirAtendimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarEnc1 } = await import("./gateway/enc1.server");
    return g.executar(context, (s) => executarEnc1(s, data));
  });
