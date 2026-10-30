/**
 * ENTRADA1 — tentativas, esqueci senha e redefinição.
 * Imports *.server só dentro dos handlers.
 */
import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  chaveTentativa,
  mensagemBloqueio,
  MSG_ESQUECI,
  MSG_ESQUECI_SEM_SMTP,
  MSG_LOGIN_ERRO,
  registrarFalhaEntrada,
} from "@/lib/acesso/entrada";
import { convitePorEmail } from "@/lib/acesso/convite";
import { validarSenhaNova, SENHA_MAX, SENHA_MIN } from "@/lib/acesso/senha";

const EMAIL = z.string().trim().email().max(200);

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sitePublico() {
  return process.env["SITE_URL"]?.trim() || "https://painel.luxbrain.com.br";
}

function linkRedefinicao(token: string) {
  return `${sitePublico().replace(/\/+$/, "")}/#redefinir=${encodeURIComponent(token)}`;
}

async function ipDaRequisicao() {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const h = req?.headers;
    if (!h) return null;
    const xf = h.get("x-forwarded-for");
    if (xf) return xf.split(",")[0]?.trim() || null;
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

async function lerTentativa(chave: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("entrada_tentativas")
    .select("falhas, falha_em, bloqueado_ate")
    .eq("chave", chave)
    .maybeSingle();
  return data;
}

async function gravarTentativa(
  chave: string,
  patch: {
    falhas: number;
    falha_em: string | null;
    bloqueado_ate: string | null;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existe } = await supabaseAdmin
    .from("entrada_tentativas")
    .select("chave")
    .eq("chave", chave)
    .maybeSingle();
  if (existe) {
    await supabaseAdmin
      .from("entrada_tentativas")
      .update({ ...patch, atualizado_em: new Date().toISOString() })
      .eq("chave", chave);
  } else {
    await supabaseAdmin.from("entrada_tentativas").insert({ chave, ...patch });
  }
}

async function auditar(
  action: string,
  opts: {
    email?: string | null;
    userId?: string | null;
    status?: string;
    detail?: string;
  },
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: opts.userId ?? null,
      actor_email: opts.email ?? null,
      action,
      target: opts.email ?? opts.userId ?? null,
      status: opts.status ?? "success",
      detail: opts.detail ?? null,
    });
  } catch {
    console.error("[entrada] auditoria falhou", action);
  }
}

/** Antes do signIn: confere bloqueio. */
export const checarBloqueioEntrada = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().min(3).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.includes("@")
      ? data.email.trim().toLowerCase()
      : `${data.email.trim().toLowerCase()}@luxtia.local`;
    const chave = chaveTentativa(email, await ipDaRequisicao());
    const row = await lerTentativa(chave);
    const agora = new Date();
    if (row?.bloqueado_ate && new Date(row.bloqueado_ate).getTime() > agora.getTime()) {
      return { bloqueado: true as const, mensagem: mensagemBloqueio(row.bloqueado_ate, agora) };
    }
    return { bloqueado: false as const };
  });

/** Depois de falha de senha ou MFA. */
export const registrarFalhaLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().min(3).max(200),
        motivo: z.enum(["senha", "mfa"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.includes("@")
      ? data.email.trim().toLowerCase()
      : `${data.email.trim().toLowerCase()}@luxtia.local`;
    const chave = chaveTentativa(email, await ipDaRequisicao());
    const row = await lerTentativa(chave);
    const agora = new Date();
    if (row?.bloqueado_ate && new Date(row.bloqueado_ate).getTime() > agora.getTime()) {
      return { bloqueado: true as const, mensagem: mensagemBloqueio(row.bloqueado_ate, agora) };
    }
    const r = registrarFalhaEntrada({
      falhas: row?.falhas ?? 0,
      falhaEm: row?.falha_em ?? null,
      agora,
    });
    await gravarTentativa(chave, {
      falhas: r.falhas,
      falha_em: agora.toISOString(),
      bloqueado_ate: r.bloqueadoAte,
    });
    await auditar(data.motivo === "mfa" ? "entrada.mfa_falhou" : "entrada.login_falhou", {
      email,
      status: "alerta",
      ...(r.bloqueadoAte ? { detail: "Bloqueio por tentativas." } : {}),
    });
    if (r.bloqueadoAte) {
      await auditar("entrada.bloqueado", {
        email,
        status: "alerta",
        detail: mensagemBloqueio(r.bloqueadoAte, agora),
      });
      return { bloqueado: true as const, mensagem: mensagemBloqueio(r.bloqueadoAte, agora) };
    }
    return {
      bloqueado: false as const,
      mensagem: data.motivo === "mfa" ? "Código incorreto. Tente de novo." : MSG_LOGIN_ERRO,
    };
  });

export const registrarLoginOk = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().min(3).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.includes("@")
      ? data.email.trim().toLowerCase()
      : `${data.email.trim().toLowerCase()}@luxtia.local`;
    const chave = chaveTentativa(email, await ipDaRequisicao());
    await gravarTentativa(chave, { falhas: 0, falha_em: null, bloqueado_ate: null });
    await auditar("entrada.login_ok", { email, status: "success" });
    return { ok: true as const };
  });

/** Sempre a mesma resposta ao cliente. */
export const pedirRedefinicaoSenha = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: EMAIL }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const comSmtp = convitePorEmail(process.env["SMTP_HOST"]);
    if (!comSmtp) {
      return { ok: true as const, mensagem: MSG_ESQUECI_SEM_SMTP };
    }
    // Com SMTP: tenta generateLink recovery; não revela se existe.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
      });
    } catch {
      /* silêncio */
    }
    await auditar("entrada.redefinicao_pedida", { email, status: "success" });
    return { ok: true as const, mensagem: MSG_ESQUECI };
  });

const TOKEN = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);

export const verRedefinicao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: TOKEN }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("redefinicoes_senha")
      .select("user_id, expira_em, usado_em, revogado_em")
      .eq("token_hash", hashToken(data.token))
      .maybeSingle();
    if (!row || row.usado_em || row.revogado_em || new Date(row.expira_em) <= new Date()) {
      throw new Error("Este link não vale mais.");
    }
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = user.user?.email;
    if (!email) throw new Error("Este link não vale mais.");
    return { email };
  });

export const concluirRedefinicao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: TOKEN,
        senha: z.string().min(SENHA_MIN).max(SENHA_MAX),
        confirma: z.string().min(SENHA_MIN).max(SENHA_MAX),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const erro = validarSenhaNova(data.senha, data.confirma);
    if (erro) throw new Error(erro);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const agora = new Date().toISOString();
    const hash = hashToken(data.token);
    const { data: row } = await supabaseAdmin
      .from("redefinicoes_senha")
      .update({ usado_em: agora })
      .eq("token_hash", hash)
      .is("usado_em", null)
      .is("revogado_em", null)
      .gt("expira_em", agora)
      .select("user_id")
      .maybeSingle();
    if (!row) throw new Error("Este link não vale mais.");
    const upd = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.senha,
    });
    if (upd.error) {
      await supabaseAdmin
        .from("redefinicoes_senha")
        .update({ usado_em: null })
        .eq("token_hash", hash);
      throw new Error("Não foi possível salvar a nova senha.");
    }
    await supabaseAdmin.rpc("derrubar_sessoes", { uid: row.user_id });
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    await auditar("entrada.senha_redefinida", {
      email: user.user?.email ?? null,
      userId: row.user_id,
      status: "success",
    });
    return { email: user.user?.email ?? "" };
  });

/** Gestor/plataforma gera link de uso único (24 h), como o convite. */
export const gerarLinkRedefinicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), empresa: z.string().max(40).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { peloMenos } = await import("@/lib/acesso/papeis");
    const sessao = await g.sessaoGatewayMfa(context, data.empresa ?? null);
    const t = await sessao.tenant(data.empresa ?? null);
    if (!peloMenos(t.papel, "gestor")) {
      throw new Error("Seu acesso não inclui redefinir senha.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("gateway_tenant_id", t.id)
      .maybeSingle();
    if (!tenant) throw new Error("Empresa não encontrada.");
    const { data: vinculo } = await supabaseAdmin
      .from("tenant_users")
      .select("user_id, email")
      .eq("tenant_id", tenant.id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!vinculo && !sessao.perfil.superAdmin) {
      throw new Error("Usuário não encontrado nesta empresa.");
    }
    const userId = data.user_id;
    const agora = new Date().toISOString();
    await supabaseAdmin
      .from("redefinicoes_senha")
      .update({ revogado_em: agora })
      .eq("user_id", userId)
      .is("usado_em", null)
      .is("revogado_em", null);
    const token = randomBytes(32).toString("base64url");
    const { error } = await supabaseAdmin.from("redefinicoes_senha").insert({
      user_id: userId,
      token_hash: hashToken(token),
      expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      criado_por: context.userId,
    });
    if (error) throw new Error("Não foi possível gerar o link.");
    await auditar("entrada.redefinicao_link", {
      email: sessao.perfil.email,
      userId: context.userId,
      detail: `Alvo ${userId}`,
      status: "success",
    });
    return {
      ok: true as const,
      link: linkRedefinicao(token),
      aviso: "Envie este link só para a pessoa. Vale 24 horas e uma vez.",
    };
  });
