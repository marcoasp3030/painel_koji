/** IFOOD1-a/b1: lojas e pedidos do iFood no gateway (plataforma liga; gestor vê). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { empresa } from "./gateway/esquemas";
import type {
  CredenciaisIfood,
  ListaLojasEmpresaIfood,
  LojaAutorizadaIfood,
  LojaEmpresaIfood,
} from "./ifood-lojas";
import { mensagemErroIfood } from "./ifood-lojas";
import type {
  ListaPedidosIfood,
  PedidoIfoodDetalhe,
  ResultadoAtualizarIfood,
} from "./ifood-pedidos";
import { filtrosListaIfood } from "./ifood-pedidos";

const merchant = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);

export type ErroIfoodPainel = { ok: false; mensagem: string; motivo?: string };

async function erroDe(e: unknown): Promise<ErroIfoodPainel> {
  const { GatewayErro } = await import("./gateway/erros");
  if (e instanceof GatewayErro) {
    return {
      ok: false,
      mensagem: mensagemErroIfood({
        mensagem: e.message,
        status: e.status,
        detalhes: e.detalhes,
      }),
      ...(typeof e.detalhes["motivo"] === "string" ? { motivo: e.detalhes["motivo"] } : {}),
    };
  }
  throw e;
}

/** Plataforma: status das credenciais do aplicativo (nunca devolve o segredo). */
export const lerCredenciaisIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CredenciaisIfood | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      try {
        const { dados } = await plataforma.chamar<CredenciaisIfood>("GET", ["ifood", "credenciais"]);
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/**
 * Plataforma: grava Client ID/Secret (testados no iFood antes).
 * Exige GATEWAY_PLATFORM_KEY no servidor (= PANEL_PLATFORM_KEY do gateway).
 */
export const gravarCredenciaisIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        client_id: z.string().trim().min(8).max(200),
        client_secret: z.string().min(8).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CredenciaisIfood | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      try {
        const { dados } = await plataforma.chamar<CredenciaisIfood>("PUT", ["ifood", "credenciais"], {
          corpo: {
            client_id: data.client_id.trim(),
            client_secret: data.client_secret.trim(),
          },
        });
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Plataforma: lojas que autorizaram o aplicativo e a quem estão ligadas. */
export const listarLojasAutorizadasIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ itens: LojaAutorizadaIfood[] } | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const plataforma = await sessao.plataforma();
      try {
        const { dados } = await plataforma.chamar<{ itens: LojaAutorizadaIfood[] }>(
          "GET",
          ["ifood", "lojas-autorizadas"],
        );
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Plataforma: liga a loja à empresa (unidade opcional). */
export const ligarLojaIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa: z.string().min(3).max(40),
        merchant_id: merchant,
        unidade: z.string().max(80).nullable().optional(),
        ativo: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<LojaEmpresaIfood | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    const { AcessoNegado } = await import("./gateway/modulo.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      if (t.papel !== "plataforma") {
        throw new AcessoNegado("Só a plataforma pode ligar uma loja do iFood.");
      }
      try {
        const { dados } = await t.chamar<LojaEmpresaIfood>("PUT", ["ifood", "lojas", data.merchant_id], {
          corpo: {
            unidade: data.unidade ?? null,
            ativo: data.ativo ?? true,
          },
        });
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Plataforma: desliga com o nome da loja como confirmação. */
export const desligarLojaIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa: z.string().min(3).max(40),
        merchant_id: merchant,
        confirmacao: z.string().trim().min(1).max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    const { AcessoNegado } = await import("./gateway/modulo.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      if (t.papel !== "plataforma") {
        throw new AcessoNegado("Só a plataforma pode desligar uma loja do iFood.");
      }
      try {
        await t.chamar("DELETE", ["ifood", "lojas", data.merchant_id], {
          corpo: { confirmacao: data.confirmacao },
        });
        return { ok: true };
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Gestor e acima: lojas ligadas à empresa. */
export const listarLojasIfoodEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }): Promise<ListaLojasEmpresaIfood | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<ListaLojasEmpresaIfood>("GET", ["ifood", "lojas"]);
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** Gestor e acima: pergunta ao iFood se a loja ainda dá acesso. */
export const conferirLojaIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ empresa, merchant_id: merchant }).parse(d),
  )
  .handler(async ({ data, context }): Promise<LojaEmpresaIfood | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<LojaEmpresaIfood>(
          "POST",
          ["ifood", "lojas", data.merchant_id, "conferir"],
        );
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const orderId = z.string().regex(/^[A-Za-z0-9-]{8,80}$/);

/** IFOOD1-b1: lista de pedidos do iFood (gestor+). */
export const listarPedidosIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        de: dia.optional(),
        ate: dia.optional(),
        status: z.array(z.string().min(1).max(40)).max(12).optional(),
        loja: z.string().max(80).optional(),
        teste: z.boolean().nullable().optional(),
        limite: z.number().int().min(1).max(100).optional(),
        antes: z.string().min(1).max(40).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ListaPedidosIfood | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<ListaPedidosIfood>("GET", ["ifood", "pedidos"], {
          query: filtrosListaIfood({
            de: data.de,
            ate: data.ate,
            status: data.status,
            loja: data.loja,
            teste: data.teste,
            limite: data.limite,
            antes: data.antes,
          }),
        });
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** IFOOD1-b1: detalhe de um pedido do iFood. */
export const lerPedidoIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, order_id: orderId }).parse(d))
  .handler(async ({ data, context }): Promise<PedidoIfoodDetalhe | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<PedidoIfoodDetalhe>("GET", [
          "ifood",
          "pedidos",
          data.order_id,
        ]);
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });

/** IFOOD1-b1: busca detalhes pendentes (até 20). */
export const atualizarPedidosIfood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }): Promise<ResultadoAtualizarIfood | ErroIfoodPainel> => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        const { dados } = await t.chamar<ResultadoAtualizarIfood>(
          "POST",
          ["ifood", "pedidos", "atualizar"],
        );
        return dados;
      } catch (e) {
        return await erroDe(e);
      }
    });
  });
