import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RedeAdmin, TipoRede } from "./cardapio-redes";
import { empresa } from "./gateway/esquemas";

const tipoRede = z.enum(["instagram", "facebook", "telefone"]);

const itemEnvio = z.object({
  tipo: tipoRede,
  valor: z.string().min(1).max(200),
  ativo: z.boolean(),
});

export type RedesSalvas = { itens: RedeAdmin[] };

export type ErroSalvarRedes = {
  ok: false;
  linha: number | null;
  tipo: TipoRede | null;
  motivo: string | null;
  mensagem: string;
};

export const lerRedes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      return (await t.chamar<RedesSalvas>("GET", ["cardapio", "redes"])).dados;
    });
  });

export const salvarRedes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        itens: z.array(itemEnvio).max(3),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<RedesSalvas | ErroSalvarRedes> => {
    const g = await import("./gateway/painel.server");
    const { mensagemParaUsuario, GatewayErro } = await import("./gateway/erros");
    const { mensagemErroRede, tipoDaLinhaErro } = await import("./cardapio-redes");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      try {
        return (
          await t.chamar<RedesSalvas>("PUT", ["cardapio", "redes"], {
            corpo: { itens: data.itens },
          })
        ).dados;
      } catch (e) {
        if (!(e instanceof GatewayErro) || e.status !== 400) throw e;
        const motivo = typeof e.detalhes["motivo"] === "string" ? e.detalhes["motivo"] : null;
        const linha = typeof e.detalhes["linha"] === "number" ? e.detalhes["linha"] : null;
        return {
          ok: false,
          linha,
          tipo: tipoDaLinhaErro(data.itens, linha),
          motivo,
          mensagem: mensagemErroRede(motivo, mensagemParaUsuario(e)),
        };
      }
    });
  });
