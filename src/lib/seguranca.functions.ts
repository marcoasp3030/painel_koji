/**
 * Segunda etapa (TOTP). Obrigatória para plataforma, com 7 dias a partir do
 * primeiro login desta versão. A conta de emergência não tem esses 7 dias:
 * bloqueia no primeiro login depois da publicação até existir um fator.
 * Opcional para o gestor. O prazo das outras contas de plataforma só começa
 * quando esta função roda no próximo login.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
