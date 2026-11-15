/** 99FOOD1-a: credenciais (plataforma) e lojas por unidade (gestor+). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa } from "./gateway/esquemas";
import {
  mensagemErroFood99,
  type CredenciaisFood99,
  type ListaLojasFood99,
  type LojaFood99,
  type ResultadoConectarFood99,
} from "./food99";

export type ErroFood99Painel = { ok: false; mensagem: string; motivo?: string };

const lojaId = z.string().regex(/^nn[a-f0-9]{16}$/);
const codigoUnidade = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_]{0,39}$/);

async function erroDe(e: unknown): Promise<ErroFood99Painel> {
  const { GatewayErro } = await import("./gateway/erros");
  if (e instanceof GatewayErro) {
    return {
      ok: false,
      mensagem: mensagemErroFood99({
        mensagem: e.message,
        status: e.status,
        detalhes: e.detalhes,
      }),
      ...(typeof e.detalhes["motivo"] === "string" ? { motivo: e.detalhes["motivo"] } : {}),
    };
  }
  throw e;
}

/** Plataforma: status das credenciais (nunca devolve o Secret). */
export const lerCredenciaisFood99 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CredenciaisFood99 | ErroFood99Painel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      try {
        const { dados } = await plataforma.chamar<CredenciaisFood99>("GET", [
          "99food",
          "credenciais",
        ]);
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/**
 * Plataforma: grava App ID + Secret (App ID conferido na 99Food antes).
 * Exige GATEWAY_PLATFORM_KEY no servidor.
 */
export const gravarCredenciaisFood99 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        app_id: z
          .string()
          .trim()
          .regex(/^[0-9]{1,25}$/),
        app_secret: z
          .string()
          .min(8)
          .max(200)
          .regex(/^[\x21-\x7e]+$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CredenciaisFood99 | ErroFood99Painel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      try {
        const { dados } = await plataforma.chamar<CredenciaisFood99>(
          "PUT",
          ["99food", "credenciais"],
          {
            corpo: {
              app_id: data.app_id.trim(),
              app_secret: data.app_secret,
            },
          },
        );
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Gestor+: lista lojas 99Food da empresa. */
export const listarLojasFood99 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }): Promise<ListaLojasFood99 | ErroFood99Painel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<ListaLojasFood99>("GET", ["99food", "lojas"]);
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Gestor+: inicia conexão da unidade → url_autorizacao. */
export const conectarLojaFood99 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ empresa, unidade: codigoUnidade }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ResultadoConectarFood99 | ErroFood99Painel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<ResultadoConectarFood99>("POST", ["99food", "lojas"], {
          corpo: { unidade: data.unidade },
        });
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Gestor+: confere autorização / token da loja. */
export const conferirLojaFood99 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, loja: lojaId }).parse(d))
  .handler(async ({ data, context }): Promise<LojaFood99 | ErroFood99Painel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<LojaFood99>("POST", [
          "99food",
          "lojas",
          data.loja,
          "conferir",
        ]);
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Gestor+: desconecta (unbind na 99 ou só no gateway). */
export const desconectarLojaFood99 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        loja: lojaId,
        confirmacao: z.string().trim().min(1).max(255),
        so_no_gateway: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; desvinculada_na_99: boolean } | ErroFood99Painel> => {
      const g = await import("./gateway/painel.server");
      return g.executar(context, async (sessao) => {
        const t = await sessao.tenant(data.empresa);
        try {
          const { dados } = await t.chamar<{ ok: true; desvinculada_na_99: boolean }>(
            "DELETE",
            ["99food", "lojas", data.loja],
            {
              corpo: {
                confirmacao: data.confirmacao.trim(),
                ...(data.so_no_gateway ? { so_no_gateway: true } : {}),
              },
            },
          );
          return dados;
        } catch (e) {
          return await erroDe(e);
        }
      });
    },
  );
