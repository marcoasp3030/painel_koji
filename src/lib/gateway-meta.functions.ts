/** META1-a: credenciais do app (plataforma) e conferência do canal. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa, idRecurso } from "./gateway/esquemas";
import {
  mensagemErroMeta,
  type ConferenciaMetaCanal,
  type CredenciaisMeta,
} from "./meta";

export type ErroMetaPainel = { ok: false; mensagem: string; motivo?: string };

async function erroDe(e: unknown): Promise<ErroMetaPainel> {
  const { GatewayErro } = await import("./gateway/erros");
  if (e instanceof GatewayErro) {
    return {
      ok: false,
      mensagem: mensagemErroMeta({
        mensagem: e.message,
        status: e.status,
        detalhes: e.detalhes,
      }),
      ...(typeof e.detalhes["motivo"] === "string" ? { motivo: e.detalhes["motivo"] } : {}),
    };
  }
  throw e;
}

/** Plataforma: status das credenciais do app (nunca devolve segredo nem token). */
export const lerCredenciaisMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CredenciaisMeta | ErroMetaPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      try {
        const { dados } = await plataforma.chamar<CredenciaisMeta>("GET", ["meta", "credenciais"]);
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/**
 * Plataforma: grava app_id, app_secret e verify_token (testados na Meta antes).
 * Exige GATEWAY_PLATFORM_KEY no servidor.
 */
export const gravarCredenciaisMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        app_id: z.string().trim().regex(/^[0-9]{5,30}$/),
        app_secret: z.string().regex(/^[A-Za-z0-9]{16,100}$/),
        verify_token: z.string().regex(/^[A-Za-z0-9_-]{16,200}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CredenciaisMeta | ErroMetaPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      try {
        const { dados } = await plataforma.chamar<CredenciaisMeta>("PUT", ["meta", "credenciais"], {
          corpo: {
            app_id: data.app_id.trim(),
            app_secret: data.app_secret,
            verify_token: data.verify_token,
          },
        });
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Gestor+: confere agora o número do canal na Meta. */
export const conferirCanalMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, canal: idRecurso }).parse(d))
  .handler(async ({ data, context }): Promise<ConferenciaMetaCanal | ErroMetaPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<ConferenciaMetaCanal>("GET", [
          "canais",
          data.canal,
          "meta",
        ]);
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });
