/**
 * Configurações globais da plataforma — só super admin.
 * Imports *.server só nos handlers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function exigirSuperAdmin(context: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: papeis } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (!(papeis ?? []).some((p) => p.role === "super_admin")) {
    throw new Error("Acesso restrito ao Super Admin.");
  }
  return supabaseAdmin;
}

/** Leitura autenticada (login e telas). Qualquer sessão autenticada. */
export const lerConfigPlataforma = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("config_plataforma")
      .select("mfa_desativado, atualizado_em")
      .eq("id", 1)
      .maybeSingle();
    return {
      mfa_desativado: Boolean(data?.mfa_desativado),
      atualizado_em: data?.atualizado_em ?? null,
    };
  });

/** Liga/desliga MFA em toda a plataforma. */
export const definirMfaDesativado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ desativado: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await exigirSuperAdmin(context);
    const agora = new Date().toISOString();
    const patch = {
      mfa_desativado: data.desativado,
      atualizado_em: agora,
      atualizado_por: context.userId,
    };
    // Update da linha única; se ainda não existir, cria.
    let { data: row, error } = await supabaseAdmin
      .from("config_plataforma")
      .update(patch)
      .eq("id", 1)
      .select("mfa_desativado")
      .maybeSingle();
    if (!error && !row) {
      const ins = await supabaseAdmin
        .from("config_plataforma")
        .insert({ id: 1, ...patch })
        .select("mfa_desativado")
        .maybeSingle();
      row = ins.data;
      error = ins.error;
    }
    if (error) {
      console.error("[config] falha ao gravar mfa_desativado:", error.message, error.code);
      throw new Error(
        error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message)
          ? "A configuração ainda não está disponível no banco. Peça para recarregar a API (PostgREST) e tente de novo."
          : `Não foi possível salvar a configuração. (${error.message})`,
      );
    }

    // Com MFA desligado em tudo, zera a flag por empresa para não reaparecer depois.
    if (data.desativado) {
      await supabaseAdmin.from("tenants").update({ mfa_obrigatorio: false }).eq("mfa_obrigatorio", true);
    }

    try {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: context.userId,
        actor_email: user.user?.email ?? null,
        action: data.desativado ? "config.mfa_desativado" : "config.mfa_reativado",
        target: "plataforma",
        status: "alerta",
        detail: data.desativado
          ? "MFA desativado em toda a plataforma."
          : "MFA reativado na plataforma (regras MFA1 voltam a valer).",
      });
    } catch {
      console.error("[config] auditoria MFA global falhou");
    }

    return { ok: true as const, mfa_desativado: data.desativado, atualizado_em: agora };
  });
