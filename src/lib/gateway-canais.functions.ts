/** Canais do gateway. Criar, ativar e rotacionar são do admin da plataforma. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import type { CanalGateway, Pagina } from "./gateway/tipos";

export const listarCanais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<Pagina<CanalGateway>>("GET", ["canais"], {
        query: { limite: 99 },
      });
      const o = await import("./gateway/ocultos");
      return { ...dados, itens: o.filtrarCanais(t.papel, dados.itens, await o.agentesOcultos(t)) };
    });
  });

export const criarCanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        // Só api e uazapi recebem mensagens nesta etapa.
        tipo: z.enum(["api", "uazapi"]),
        nome: z.string().trim().min(1).max(200),
        agente_id: idRecurso,
        publico: z.enum(["clientes", "interno"]),
        ativo: z.boolean(),
        credenciais: z
          .object({ base_url: z.string().url().max(500), token: z.string().min(1).max(500) })
          .nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { empresa: _empresa, credenciais, ...corpo } = data;
      // A resposta traz webhook_url com o segredo: vai só para quem criou, uma vez.
      const { dados } = await t.chamar<CanalGateway & { webhook_url: string }>("POST", ["canais"], {
        corpo: credenciais ? { ...corpo, credenciais } : corpo,
      });
      return dados;
    });
  });

export const alterarCanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        canal: idRecurso,
        dados: z
          .object({ ativo: z.boolean(), nome: z.string().trim().min(1).max(200) })
          .partial()
          .strict(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<CanalGateway>("PATCH", ["canais", data.canal], {
        corpo: data.dados,
      });
      return dados;
    });
  });

export const rotacionarSegredoCanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, canal: idRecurso }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<{
        id: string;
        webhook_url: string;
        webhook_uazapi?: import("./gateway/tipos").WebhookUazapi;
      }>("POST", ["canais", data.canal, "rotacionar-segredo"]);
      return dados;
    });
  });

/** Refaz o cadastro do webhook na instância uazapi (não devolve a URL). */
export const refazerWebhookCanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, canal: idRecurso }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      const { dados } = await t.chamar<{
        id: string;
        webhook_uazapi: import("./gateway/tipos").WebhookUazapi;
      }>("POST", ["canais", data.canal, "webhook"], { corpo: {} });
      return dados;
    });
  });

export const MOTIVO_WEBHOOK_UAZAPI: Record<string, string> = {
  sem_credenciais: "Faltam o endereço e o token da instância.",
  provedor_recusou: "A uazapi recusou o cadastro do webhook.",
  provedor_inacessivel: "Não foi possível falar com a uazapi.",
  endereco_publico_ausente: "O gateway não tem endereço público para o webhook.",
};

export function textoWebhookUazapi(w: import("./gateway/tipos").WebhookUazapi | undefined) {
  if (!w) return null;
  if (w.registrado) return "Webhook cadastrado na instância uazapi.";
  const motivo = w.motivo ? (MOTIVO_WEBHOOK_UAZAPI[w.motivo] ?? w.motivo) : "Motivo não informado.";
  return `Webhook não cadastrado: ${motivo}`;
}
