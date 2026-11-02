import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AparenciaCardapio } from "./cardapio-tema";
import { empresa } from "./gateway/esquemas";

export type AparenciaSalva = AparenciaCardapio & {
  logo_id: string | null;
  banner_id: string | null;
  atualizado_em: string;
};

const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const idImagem = z
  .string()
  .regex(/^[0-9a-f]{32}$/)
  .nullable();

export const lerAparencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      return (
        await t.chamar<{ aparencia: AparenciaSalva | null }>("GET", ["cardapio", "aparencia"])
      ).dados;
    });
  });

export const salvarAparencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        nome_exibicao: z.string().max(60).nullable(),
        slogan: z.string().max(120).nullable(),
        cor_primaria: cor,
        cor_destaque: cor,
        cor_fundo: cor,
        cantos: z.enum(["retos", "suave", "arredondado"]),
        titulos: z.enum(["classica", "moderna"]),
        logo_id: idImagem,
        banner_id: idImagem,
        banner_foco: z.number().int().min(0).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { empresa: alvo, ...corpo } = data;
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(alvo);
      const { GatewayErro } = await import("./gateway/erros");
      try {
        return (
          await t.chamar<{ aparencia: AparenciaSalva }>("PUT", ["cardapio", "aparencia"], { corpo })
        ).dados;
      } catch (e) {
        const campo = e instanceof GatewayErro ? e.detalhes["campo"] : null;
        if (campo === "logo_id" || campo === "banner_id") return { imagem_ausente: campo };
        throw e;
      }
    });
  });

export const restaurarAparencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      await t.chamar("DELETE", ["cardapio", "aparencia"]);
      return { ok: true };
    });
  });

export const enviarImagemAparencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        tipo: z.enum(["logo", "banner"]),
        conteudo: z.string().min(8).max(2_800_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    return g.executar(context, async (sessao) => {
      const t = await sessao.tenant(data.empresa);
      return (
        await t.chamar<{ id: string; url: string }>("POST", ["cardapio", "aparencia", "imagem"], {
          corpo: { tipo: data.tipo, conteudo: data.conteudo },
        })
      ).dados;
    });
  });
