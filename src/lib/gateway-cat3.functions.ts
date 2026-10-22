import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const gerirCat3 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarCat3 } = await import("./gateway/cat3.server");
    return g.executar(context, (s) => executarCat3(s, data));
  });
