/**
 * Segunda etapa (TOTP). Obrigatória para plataforma, com 7 dias a partir do
 * primeiro login desta versão. A conta de emergência não tem esses 7 dias:
 * bloqueia no primeiro login depois da publicação até existir um fator.
 * Opcional para o gestor. O prazo das outras contas de plataforma só começa
 * quando esta função roda no próximo login.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizarCodigo } from "@/lib/acesso/codigos-recuperacao";
import { contaEmergencia, decidirSegundaEtapa } from "@/lib/acesso/segunda-etapa";

export type EstadoSeguranca = {
  obrigatorio: boolean;
  fatores: number;
  bloqueado: boolean;
  prazo_ate: string | null;
};

const vazio: EstadoSeguranca = {
  obrigatorio: false,
  fatores: 0,
  bloqueado: false,
  prazo_ate: null,
};

export const estadoSeguranca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EstadoSeguranca> => {
    let email: string | null = null;
    try {
      const g = await import("./gateway/painel.server");
      const sessao = await g.sessaoGateway(context);
      email = sessao.perfil.email;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: conta } = await supabaseAdmin
        .from("conta_seguranca")
        .select("prazo_ate, emergencia, ultimo_login_auditado")
        .eq("user_id", sessao.perfil.userId)
        .maybeSingle();
      const emergencia = contaEmergencia(email, Boolean(conta?.emergencia));
      if (!sessao.perfil.superAdmin && !emergencia) return vazio;
      const { data: fatores, error } = await supabaseAdmin.rpc("fatores_verificados", {
        uid: sessao.perfil.userId,
      });
      if (error) {
        if (emergencia) {
          await registrarAlertaLogin(supabaseAdmin, sessao.perfil.userId, email);
          return { obrigatorio: true, fatores: 0, bloqueado: true, prazo_ate: null };
        }
        return vazio;
      }
      const total = fatores ?? 0;
      if (emergencia) {
        await registrarAlertaLogin(supabaseAdmin, sessao.perfil.userId, email);
        const decisao = decidirSegundaEtapa({
          plataforma: true,
          emergencia: true,
          fatores: total,
          prazoAte: null,
          agora: new Date(),
        });
        return {
          obrigatorio: decisao.obrigatorio,
          fatores: total,
          bloqueado: decisao.bloqueado,
          prazo_ate: null,
        };
      }
      const decisao = decidirSegundaEtapa({
        plataforma: true,
        emergencia: false,
        fatores: total,
        prazoAte: conta?.prazo_ate ?? null,
        agora: new Date(),
      });
      if (decisao.gravarPrazo) {
        if (conta) {
          await supabaseAdmin
            .from("conta_seguranca")
            .update({ prazo_ate: decisao.gravarPrazo })
            .eq("user_id", sessao.perfil.userId);
        } else {
          await supabaseAdmin.from("conta_seguranca").insert({
            user_id: sessao.perfil.userId,
            prazo_ate: decisao.gravarPrazo,
          });
        }
      }
      return {
        obrigatorio: decisao.obrigatorio,
        fatores: total,
        bloqueado: decisao.bloqueado,
        prazo_ate: decisao.prazo_ate,
      };
    } catch {
      if (contaEmergencia(email, false)) {
        return { obrigatorio: true, fatores: 0, bloqueado: true, prazo_ate: null };
      }
      return vazio;
    }
  });

async function registrarAlertaLogin(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  userId: string,
  email: string | null,
) {
  try {
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(userId);
    const marco = auth.user?.last_sign_in_at ?? null;
    if (!marco) return;
    const { data: conta } = await supabaseAdmin
      .from("conta_seguranca")
      .select("ultimo_login_auditado")
      .eq("user_id", userId)
      .maybeSingle();
    if (
      conta?.ultimo_login_auditado &&
      new Date(conta.ultimo_login_auditado).getTime() >= new Date(marco).getTime()
    ) {
      return;
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: userId,
      actor_email: email,
      action: "Login da conta de emergência",
      target: email,
      status: "alerta",
      detail: "Conta de emergência entrou no painel.",
    });
    if (conta) {
      await supabaseAdmin
        .from("conta_seguranca")
        .update({ ultimo_login_auditado: marco, emergencia: true })
        .eq("user_id", userId);
    } else {
      await supabaseAdmin.from("conta_seguranca").insert({
        user_id: userId,
        emergencia: true,
        prazo_ate: null,
        ultimo_login_auditado: marco,
      });
    }
  } catch {
    console.error("[painel] não foi possível registrar o login da conta de emergência");
  }
}

function hashCodigo(codigo: string) {
  return createHash("sha256").update(normalizarCodigo(codigo)).digest("hex");
}

function hashesIguais(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

const codigosSchema = z.object({
  codigos: z.array(z.string().trim().min(8).max(32)).length(8),
});

/** Guarda só o hash. O texto fica na tela, uma vez, para a pessoa copiar. */
export const guardarCodigosRecuperacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codigosSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hashes = data.codigos.map(hashCodigo);
    const { data: conta } = await supabaseAdmin
      .from("conta_seguranca")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const escrita = conta
      ? await supabaseAdmin
          .from("conta_seguranca")
          .update({ codigos_recuperacao: hashes })
          .eq("user_id", context.userId)
      : await supabaseAdmin
          .from("conta_seguranca")
          .insert({ user_id: context.userId, codigos_recuperacao: hashes });
    if (escrita.error) throw new Error("Não foi possível guardar os códigos de recuperação.");
    return { ok: true as const };
  });

type AdminFatores = {
  _listFactors(params: { userId: string }): Promise<{
    data: { factors: { id: string }[] } | null;
    error: { message: string } | null;
  }>;
  _deleteFactor(params: {
    userId: string;
    id: string;
  }): Promise<{ error: { message: string } | null }>;
};

/** Um código de recuperação desliga o aplicativo. A obrigatoriedade da plataforma continua. */
export const usarCodigoRecuperacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ codigo: z.string().trim().min(8).max(32) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = hashCodigo(data.codigo);
    const { data: conta } = await supabaseAdmin
      .from("conta_seguranca")
      .select("codigos_recuperacao")
      .eq("user_id", context.userId)
      .maybeSingle();
    const guardados = conta?.codigos_recuperacao ?? [];
    if (!guardados.some((item) => hashesIguais(item, hash))) {
      throw new Error("Código de recuperação não conferiu.");
    }
    const admin = supabaseAdmin.auth.admin as unknown as AdminFatores;
    const lista = await admin._listFactors({ userId: context.userId });
    if (lista.error) throw new Error("Não foi possível conferir a segunda etapa.");
    for (const fator of lista.data?.factors ?? []) {
      const apagou = await admin._deleteFactor({ userId: context.userId, id: fator.id });
      if (apagou.error) throw new Error("Não foi possível usar o código de recuperação.");
    }
    const restante = guardados.filter((item) => !hashesIguais(item, hash));
    const { error } = await supabaseAdmin
      .from("conta_seguranca")
      .update({ codigos_recuperacao: restante })
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível usar o código de recuperação.");
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      action: "Código de recuperação usado",
      target: context.userId,
      status: "alerta",
      detail: "A segunda etapa foi desligada com um código de recuperação.",
    });
    return { ok: true as const };
  });
