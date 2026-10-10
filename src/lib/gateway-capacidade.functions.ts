import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { idRecurso } from "./gateway/esquemas";
const alvo = z.object({
  empresa: z.string().regex(/^[a-z0-9_]{3,40}$/),
  agente: idRecurso.optional(),
});
export const obterCapacidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => alvo.parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { capacidade } = await import("./gateway/capacidade.server");
    return g.executar(context, (s) => capacidade(s, data.empresa, data.agente));
  });
export const salvarCapacidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => alvo.extend({ valor: z.number().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { capacidade } = await import("./gateway/capacidade.server");
    return g.executar(context, (s) =>
      capacidade(s, data.empresa, data.agente, { valor: data.valor }),
    );
  });
