/** Chaves de API do gateway: só o admin da plataforma (o módulo recusa as demais). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import type { ChaveGateway, Pagina } from "./gateway/tipos";

export const ESCOPOS = [
  "conversar",
  "eventos:ler",
  "notificar",
  "ferramentas:catalogo",
  "callback",
  "documentos:enviar",
] as const;

export const listarChaves = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<Pagina<ChaveGateway>>("GET", ["api-keys"], {
        query: { limite: 99 },
      });
      return dados;
    });
  });

export const criarChave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        nome: z.string().trim().min(1).max(200),
        escopos: z.array(z.enum(ESCOPOS)).min(1),
        agente_id: idRecurso.nullish(),
        expira_em: z.string().datetime({ offset: true }).nullish(),
        ips_permitidos: z.array(z.string().min(3).max(64)).max(50).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const corpo: Record<string, unknown> = { nome: data.nome, escopos: data.escopos };
      if (data.agente_id) corpo["agente_id"] = data.agente_id;
      if (data.expira_em) corpo["expira_em"] = data.expira_em;
      if (data.ips_permitidos?.length) corpo["ips_permitidos"] = data.ips_permitidos;
      // A resposta traz a chave em texto: vai só para quem criou, uma vez.
      const { dados } = await t.chamar<ChaveGateway & { chave: string }>("POST", ["api-keys"], {
        corpo,
      });
      return dados;
    });
  });

export const revogarChave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, chave: idRecurso }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<{ ok: boolean }>("DELETE", ["api-keys", data.chave]);
      return dados;
    });
  });
