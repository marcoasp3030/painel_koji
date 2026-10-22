import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const cardapio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { executarCardapio } = await import("./gateway/cardapio.server");
    return g.executar(context, (s) => executarCardapio(s, data));
  });
