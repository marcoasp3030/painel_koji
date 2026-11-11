/**
 * Usuários da plataforma (super_admin). Só quem já é super admin.
 */
import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SENHA_MAX, SENHA_MIN, validarSenhaNova } from "@/lib/acesso/senha";
import { EMAIL_CONTA_EMERGENCIA } from "@/lib/acesso/segunda-etapa";
import {
  ehContaEmergencia,
  flagsUsuarioPlataforma,
  type UsuarioPlataformaLinha,
} from "@/lib/plataforma-usuarios";

type Ctx = {
  supabase: unknown;
  userId: string;
  claims: Record<string, unknown>;
};

async function exigirSuperAdmin(context: Ctx) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const ok = (roles ?? []).some((r: { role: string }) => r.role === "super_admin");
  if (!ok) throw new Error("Acesso restrito ao Super Admin.");
  const { exigirAalDaSessao } = await import("@/lib/acesso/mfa.server");
  const email = (context.claims["email"] as string) ?? null;
  await exigirAalDaSessao({
    userId: context.userId,
    email,
    claims: context.claims,
    superAdmin: true,
    gatewayTenantId: null,
  });
  return { supabaseAdmin, email };
}

async function auditar(
  supabaseAdmin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"]>,
  me: { userId: string; email: string | null },
  action: string,
  target: string,
  detail?: string,
) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: me.userId,
      actor_email: me.email,
      action,
      target,
      status: "success",
      detail: detail ?? null,
    });
  } catch {
    console.error("[plataforma-usuarios] auditoria falhou", action);
  }
}

function sitePublico() {
  return process.env["SITE_URL"]?.trim() || "https://painel.luxbrain.com.br";
}

function linkRedefinicao(token: string) {
  return `${sitePublico().replace(/\/+$/, "")}/#redefinir=${encodeURIComponent(token)}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const listarUsuariosPlataforma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ usuarios: UsuarioPlataformaLinha[] }> => {
    const ctx = context as Ctx;
    const { supabaseAdmin } = await exigirSuperAdmin(ctx);
    const { data: papeis, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    if (error) throw new Error("Não foi possível listar os usuários da plataforma.");
    const ids = [...new Set((papeis ?? []).map((p) => p.user_id as string))];
    const total = ids.length;
    const usuarios: UsuarioPlataformaLinha[] = [];
    for (const id of ids) {
      const { data: auth } = await supabaseAdmin.auth.admin.getUserById(id);
      const u = auth.user;
      if (!u?.email) continue;
      const flags = flagsUsuarioPlataforma({
        user_id: id,
        email: u.email,
        euId: ctx.userId,
        totalPlataforma: total,
      });
      const meta = (u.user_metadata ?? {}) as { full_name?: string | null };
      usuarios.push({
        user_id: id,
        email: u.email,
        nome: meta.full_name ?? null,
        ultimo_acesso: u.last_sign_in_at ?? null,
        criado_em: u.created_at ?? null,
        ...flags,
      });
    }
    usuarios.sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));
    return { usuarios };
  });

export const criarUsuarioPlataforma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        nome: z.string().trim().max(120).optional(),
        senha: z.string().min(SENHA_MIN).max(SENHA_MAX),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { supabaseAdmin, email: ator } = await exigirSuperAdmin(ctx);
    const erro = validarSenhaNova(data.senha);
    if (erro) throw new Error(erro);
    const email = data.email.trim().toLowerCase();
    if (email === EMAIL_CONTA_EMERGENCIA) {
      throw new Error("A conta de emergência já existe e não se cria por aqui.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { full_name: data.nome ?? null },
    });

    if (!error && created?.user) {
      const { error: papelErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: created.user.id,
        role: "super_admin",
      });
      if (papelErr) {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        throw new Error("Conta criada, mas o papel de plataforma falhou. Tente de novo.");
      }
      await auditar(
        supabaseAdmin,
        { userId: ctx.userId, email: ator },
        "plataforma.usuario_criado",
        email,
        "super_admin",
      );
      return { ok: true as const, user_id: created.user.id, criado: true };
    }

    // Conta já existia: promove a plataforma e atualiza senha/nome.
    const msg = (error?.message ?? "").toLowerCase();
    if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
      throw new Error(error?.message ?? "Não foi possível criar a conta.");
    }
    const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existente = (lista?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (!existente) throw new Error("Esta conta já existe, mas não foi possível localizá-la.");
    const { data: papel } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", existente.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (papel) throw new Error("Esta pessoa já é da plataforma.");
    const { error: up } = await supabaseAdmin.from("user_roles").insert({
      user_id: existente.id,
      role: "super_admin",
    });
    if (up) throw new Error("Não foi possível conceder o acesso de plataforma.");
    await supabaseAdmin.auth.admin.updateUserById(existente.id, {
      password: data.senha,
      ...(data.nome ? { user_metadata: { full_name: data.nome } } : {}),
    });
    await auditar(
      supabaseAdmin,
      { userId: ctx.userId, email: ator },
      "plataforma.usuario_promovido",
      email,
      "super_admin",
    );
    return { ok: true as const, user_id: existente.id, criado: false };
  });

export const removerUsuarioPlataforma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { supabaseAdmin, email: ator } = await exigirSuperAdmin(ctx);
    if (data.user_id === ctx.userId) {
      throw new Error("Você não pode remover o próprio acesso.");
    }
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = auth.user?.email ?? null;
    if (!email) throw new Error("Usuário não encontrado.");
    if (ehContaEmergencia(email)) {
      throw new Error("A conta de emergência não pode ser removida.");
    }
    const { data: papeis } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const total = (papeis ?? []).length;
    if (total <= 1) throw new Error("Não dá para remover o último usuário da plataforma.");
    const ehPlataforma = (papeis ?? []).some((p) => p.user_id === data.user_id);
    if (!ehPlataforma) throw new Error("Esta pessoa não é da plataforma.");

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "super_admin");

    const { count } = await supabaseAdmin
      .from("tenant_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user_id);
    // Sem vínculo de empresa: a conta só existia para a plataforma.
    if ((count ?? 0) === 0) {
      await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    }

    await auditar(
      supabaseAdmin,
      { userId: ctx.userId, email: ator },
      "plataforma.usuario_removido",
      email,
    );
    return { ok: true as const };
  });

export const linkNovaSenhaPlataforma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { supabaseAdmin, email: ator } = await exigirSuperAdmin(ctx);
    const { data: papel } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.user_id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!papel) throw new Error("Usuário da plataforma não encontrado.");
    const { data: auth } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (!auth.user) throw new Error("Usuário não encontrado.");

    const agora = new Date().toISOString();
    await supabaseAdmin
      .from("redefinicoes_senha")
      .update({ revogado_em: agora })
      .eq("user_id", data.user_id)
      .is("usado_em", null)
      .is("revogado_em", null);
    const token = randomBytes(32).toString("base64url");
    const { error } = await supabaseAdmin.from("redefinicoes_senha").insert({
      user_id: data.user_id,
      token_hash: hashToken(token),
      expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      criado_por: ctx.userId,
    });
    if (error) throw new Error("Não foi possível gerar o link.");
    await auditar(
      supabaseAdmin,
      { userId: ctx.userId, email: ator },
      "plataforma.redefinicao_link",
      auth.user.email ?? data.user_id,
    );
    return {
      ok: true as const,
      link: linkRedefinicao(token),
      aviso: "Envie este link só para a pessoa. Vale 24 horas e uma vez.",
    };
  });
