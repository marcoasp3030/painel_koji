/**
 * Convite, papel e unidades de uma empresa. O papel sai do cadastro no
 * servidor. Com SMTP, o convite vai por e-mail. Sem SMTP, quem convidou vê
 * o link uma única vez. A senha da conta de emergência não é alterada aqui.
 */
import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AVISO_LINK_CONVITE,
  conviteAberto,
  convitePorEmail,
  expiraConvite,
  linkDoConvite,
} from "@/lib/acesso/convite";
import { EMAIL_CONTA_EMERGENCIA } from "@/lib/acesso/segunda-etapa";
import { podeConceder, peloMenos, papelAcesso, type PapelAcesso } from "@/lib/acesso/papeis";
import { SENHA_MAX, SENHA_MIN, validarSenhaNova } from "@/lib/acesso/senha";
import { empresa } from "@/lib/gateway/esquemas";

const TOKEN_CONVITE = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);

const PAPEL_EMPRESA = z.enum(["gestor", "supervisor", "funcionario"]);
const CODIGO = z.string().regex(/^[a-z0-9_]{1,40}$/);

type LinhaUsuario = {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
  papel: PapelAcesso;
  ativo: boolean;
  unidades: string[];
  convidado_em: string | null;
  ultimo_acesso: string | null;
  convitePendente: boolean;
  conviteExpiraEm: string | null;
};

async function empresaDo(context: unknown, pedida: string | null | undefined) {
  const g = await import("./gateway/painel.server");
  const sessao = await g.sessaoGateway(context);
  const t = await sessao.tenant(pedida ?? null);
  if (!peloMenos(t.papel, "supervisor")) {
    throw new Error("Seu acesso não inclui a gestão de usuários.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("id, name")
    .eq("gateway_tenant_id", t.id)
    .maybeSingle();
  if (error || !tenant) throw new Error("Esta empresa ainda não está ligada ao painel.");
  return { sessao, t, tenant, supabaseAdmin };
}

async function papelSistema(
  supabaseAdmin: Awaited<ReturnType<typeof empresaDo>>["supabaseAdmin"],
  codigo: PapelAcesso,
) {
  const { data, error } = await supabaseAdmin
    .from("papeis")
    .select("id")
    .eq("codigo", codigo)
    .is("empresa_id", null)
    .maybeSingle();
  if (error || !data) throw new Error("O papel de sistema ainda não está disponível.");
  return data.id;
}

async function unidadesDaEmpresa(t: Awaited<ReturnType<typeof empresaDo>>["t"]) {
  const { dados } = await t.chamar<{ itens?: { codigo?: string | null; nome?: string | null }[] }>(
    "GET",
    ["unidades"],
  );
  const itens = dados.itens ?? [];
  const saida: { codigo: string; nome: string }[] = [];
  for (const item of itens) {
    if (item.codigo) saida.push({ codigo: item.codigo, nome: item.nome ?? item.codigo });
  }
  return saida;
}

function conferirUnidades(
  ator: "*" | readonly string[],
  pedidas: string[],
  existentes: { codigo: string }[],
) {
  const conhecidas = new Set(existentes.map((u) => u.codigo));
  for (const codigo of pedidas) {
    if (!conhecidas.has(codigo)) throw new Error("Unidade desconhecida nesta empresa.");
    if (ator !== "*" && !ator.includes(codigo)) {
      throw new Error("Você só pode conceder unidades do seu próprio acesso.");
    }
  }
}

export const listarUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa }).parse(d))
  .handler(async ({ data, context }): Promise<{
    empresa: string;
    papel: PapelAcesso;
    concediveis: PapelAcesso[];
    unidades: { codigo: string; nome: string }[];
    usuarios: LinhaUsuario[];
    convitePorEmail: boolean;
  }> => {
    const { t, tenant, supabaseAdmin } = await empresaDo(context, data.empresa);
    const { papeisConcediveis } = await import("@/lib/acesso/papeis");
    const { data: membros, error } = await supabaseAdmin
      .from("tenant_users")
      .select("id, user_id, email, full_name, ativo, papel_id, convidado_em")
      .eq("tenant_id", tenant.id)
      .order("email");
    if (error) throw new Error("Não foi possível listar os usuários.");
    const idsPapel = [
      ...new Set((membros ?? []).map((m) => m.papel_id).filter((id): id is string => Boolean(id))),
    ];
    const { data: papeisLinha } = idsPapel.length
      ? await supabaseAdmin.from("papeis").select("id, papel_gateway").in("id", idsPapel)
      : { data: [] };
    const porPapel = new Map((papeisLinha ?? []).map((p) => [p.id, p.papel_gateway]));
    const ids = (membros ?? []).map((m) => m.id);
    const { data: ligacoes } = ids.length
      ? await supabaseAdmin
          .from("usuario_unidades")
          .select("tenant_user_id, unidade_codigo")
          .in("tenant_user_id", ids)
      : { data: [] };
    const { data: convites } = ids.length
      ? await supabaseAdmin
          .from("convites")
          .select("tenant_user_id, expira_em, usado_em, revogado_em")
          .in("tenant_user_id", ids)
      : { data: [] };
    const agora = new Date();
    const usuarios: LinhaUsuario[] = [];
    for (const m of membros ?? []) {
      const papel = papelAcesso(m.papel_id ? porPapel.get(m.papel_id) : null) ?? "funcionario";
      const { data: auth } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      const pendente = (convites ?? [])
        .filter((c) => c.tenant_user_id === m.id && conviteAberto(c, agora))
        .sort((a, b) => b.expira_em.localeCompare(a.expira_em))[0];
      usuarios.push({
        id: m.id,
        user_id: m.user_id,
        email: m.email,
        nome: m.full_name,
        papel,
        ativo: m.ativo,
        unidades: (ligacoes ?? [])
          .filter((l) => l.tenant_user_id === m.id)
          .map((l) => l.unidade_codigo),
        convidado_em: m.convidado_em,
        ultimo_acesso: auth.user?.last_sign_in_at ?? null,
        convitePendente: Boolean(pendente),
        conviteExpiraEm: pendente?.expira_em ?? null,
      });
    }
    const unidades = await unidadesDaEmpresa(t).catch(() => []);
    const visiveis =
      t.unidades === "*" ? unidades : unidades.filter((u) => t.unidades.includes(u.codigo));
    return {
      empresa: tenant.name,
      papel: t.papel,
      concediveis: papeisConcediveis(t.papel).filter((p) => p !== "plataforma"),
      unidades: visiveis,
      usuarios: usuarios.filter(
        (u) => t.unidades === "*" || u.papel === "gestor" || u.unidades.some((c) => t.unidades.includes(c)),
      ),
      convitePorEmail: convitePorEmail(process.env["SMTP_HOST"]),
    };
  });

const convite = z.object({
  empresa,
  email: z.string().email(),
  nome: z.string().trim().max(120).optional(),
  papel: PAPEL_EMPRESA,
  unidades: z.array(CODIGO).max(40),
});

export const convidarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => convite.parse(d))
  .handler(async ({ data, context }) => {
    const { t, tenant, supabaseAdmin, sessao } = await empresaDo(context, data.empresa);
    if (!podeConceder(t.papel, data.papel)) throw new Error("Você não pode conceder este papel.");
    if (data.papel !== "gestor" && data.unidades.length === 0) {
      throw new Error("Escolha ao menos uma unidade.");
    }
    const existentes = await unidadesDaEmpresa(t);
    conferirUnidades(t.unidades, data.unidades, existentes);
    const email = data.email.trim().toLowerCase();
    const porEmail = convitePorEmail(process.env["SMTP_HOST"]);
    const conta = await prepararConta(supabaseAdmin, email, data.nome ?? null, porEmail);
    const papelId = await papelSistema(supabaseAdmin, data.papel);
    const { data: ja } = await supabaseAdmin
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("user_id", conta.usuarioId)
      .maybeSingle();
    if (ja) throw new Error("Esta pessoa já tem acesso nesta empresa.");
    const { data: criado, error } = await supabaseAdmin
      .from("tenant_users")
      .insert({
        tenant_id: tenant.id,
        user_id: conta.usuarioId,
        email,
        full_name: data.nome ?? null,
        is_tenant_admin: data.papel === "gestor",
        papel_id: papelId,
        ativo: true,
        convidado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !criado) throw new Error(error?.message ?? "Não foi possível gravar o acesso.");
    const vinculoId = criado.id;
    if (email !== EMAIL_CONTA_EMERGENCIA) {
      await supabaseAdmin.from("user_roles").upsert(
        {
          user_id: conta.usuarioId,
          role: data.papel === "gestor" ? "tenant_admin" : "tenant_user",
        },
        { onConflict: "user_id,role" },
      );
    }
    if (data.papel !== "gestor") {
      await supabaseAdmin.from("usuario_unidades").insert(
        data.unidades.map((unidade_codigo) => ({ tenant_user_id: vinculoId, unidade_codigo })),
      );
    }
    let link: string | null = null;
    let aviso = conta.aviso;
    if (conta.emitirLink) {
      link = await emitirLinkConvite(supabaseAdmin, vinculoId);
      aviso = AVISO_LINK_CONVITE;
    }
    const { auditarPainel } = await import("./gateway/painel.server");
    await auditarPainel(sessao, {
      tenantId: tenant.id,
      action: "Convite de usuário",
      target: email,
      detail: link ? `${data.papel}; link de uso único` : data.papel,
    });
    return { ok: true as const, aviso, link };
  });

export const alterarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        empresa,
        id: z.string().uuid(),
        papel: PAPEL_EMPRESA.optional(),
        unidades: z.array(CODIGO).max(40).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { t, tenant, supabaseAdmin, sessao } = await empresaDo(context, data.empresa);
    const { data: row, error } = await supabaseAdmin
      .from("tenant_users")
      .select("id, user_id, email, tenant_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row || row.tenant_id !== tenant.id) throw new Error("Usuário não encontrado.");
    if (row.user_id === sessao.perfil.userId) throw new Error("Você não altera o próprio acesso.");
    if (data.papel && !podeConceder(t.papel, data.papel)) {
      throw new Error("Você não pode conceder este papel.");
    }
    if (data.unidades) {
      const existentes = await unidadesDaEmpresa(t);
      conferirUnidades(t.unidades, data.unidades, existentes);
    }
    const papelId = data.papel ? await papelSistema(supabaseAdmin, data.papel) : undefined;
    const { error: gravar } = await supabaseAdmin
      .from("tenant_users")
      .update({
        ...(papelId ? { papel_id: papelId, is_tenant_admin: data.papel === "gestor" } : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      })
      .eq("id", row.id);
    if (gravar) throw new Error("Não foi possível atualizar o acesso.");
    if (data.unidades && data.papel !== "gestor") {
      await supabaseAdmin.from("usuario_unidades").delete().eq("tenant_user_id", row.id);
      if (data.unidades.length) {
        await supabaseAdmin.from("usuario_unidades").insert(
          data.unidades.map((unidade_codigo) => ({ tenant_user_id: row.id, unidade_codigo })),
        );
      }
    }
    if (data.papel === "gestor") {
      await supabaseAdmin.from("usuario_unidades").delete().eq("tenant_user_id", row.id);
    }
    if (data.ativo === false) await derrubarSeIsolado(supabaseAdmin, row.user_id);
    const { auditarPainel } = await import("./gateway/painel.server");
    await auditarPainel(sessao, {
      tenantId: tenant.id,
      action: data.ativo === false ? "Desativação de usuário" : "Alteração de usuário",
      target: row.email,
      detail: data.papel ?? (data.ativo === false ? "inativo" : "ativo"),
    });
    return { ok: true as const };
  });

export const reenviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { tenant, supabaseAdmin, sessao } = await empresaDo(context, data.empresa);
    const { data: row } = await supabaseAdmin
      .from("tenant_users")
      .select("id, email, user_id, tenant_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.tenant_id !== tenant.id) throw new Error("Usuário não encontrado.");
    if (row.email.trim().toLowerCase() === EMAIL_CONTA_EMERGENCIA) {
      return {
        ok: false as const,
        aviso: "Esta conta não recebe link de convite.",
        link: null,
      };
    }
    const { auditarPainel } = await import("./gateway/painel.server");
    if (convitePorEmail(process.env["SMTP_HOST"])) {
      const r = await supabaseAdmin.auth.admin.inviteUserByEmail(row.email);
      if (r.error) {
        return {
          ok: false as const,
          aviso: "Não foi possível reenviar o e-mail.",
          link: null,
        };
      }
      await auditarPainel(sessao, {
        tenantId: tenant.id,
        action: "Reenvio de convite",
        target: row.email,
        detail: "e-mail",
      });
      return { ok: true as const, aviso: null, link: null };
    }
    await supabaseAdmin.rpc("revogar_tokens_de_convite", { uid: row.user_id });
    const link = await emitirLinkConvite(supabaseAdmin, row.id);
    await auditarPainel(sessao, {
      tenantId: tenant.id,
      action: "Novo link de convite",
      target: row.email,
      detail: "uso único, 24 horas",
    });
    return { ok: true as const, aviso: AVISO_LINK_CONVITE, link };
  });

export const revogarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { tenant, supabaseAdmin, sessao } = await empresaDo(context, data.empresa);
    const { data: row } = await supabaseAdmin
      .from("tenant_users")
      .select("id, email, user_id, tenant_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.tenant_id !== tenant.id) throw new Error("Usuário não encontrado.");
    const agora = new Date().toISOString();
    await supabaseAdmin
      .from("convites")
      .update({ revogado_em: agora })
      .eq("tenant_user_id", row.id)
      .is("usado_em", null)
      .is("revogado_em", null);
    await supabaseAdmin.rpc("revogar_tokens_de_convite", { uid: row.user_id });
    const { auditarPainel } = await import("./gateway/painel.server");
    await auditarPainel(sessao, {
      tenantId: tenant.id,
      action: "Revogação de convite",
      target: row.email,
    });
    return { ok: true as const };
  });

export const verConvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: TOKEN_CONVITE }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = await emailDoToken(supabaseAdmin, data.token);
    if (!email) throw new Error("Este convite não vale mais.");
    return { email };
  });

export const aceitarConvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: TOKEN_CONVITE, senha: z.string().min(SENHA_MIN).max(SENHA_MAX) }).parse(d),
  )
  .handler(async ({ data }) => {
    const erroSenha = validarSenhaNova(data.senha);
    if (erroSenha) throw new Error(erroSenha);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const agora = new Date().toISOString();
    const hash = hashToken(data.token);
    const { data: reivindicado } = await supabaseAdmin
      .from("convites")
      .update({ usado_em: agora })
      .eq("token_hash", hash)
      .is("usado_em", null)
      .is("revogado_em", null)
      .gt("expira_em", agora)
      .select("tenant_user_id")
      .maybeSingle();
    if (!reivindicado) throw new Error("Este convite não vale mais.");
    const { data: vinculo } = await supabaseAdmin
      .from("tenant_users")
      .select("user_id, email")
      .eq("id", reivindicado.tenant_user_id)
      .maybeSingle();
    if (!vinculo || vinculo.email.trim().toLowerCase() === EMAIL_CONTA_EMERGENCIA) {
      throw new Error("Este convite não vale mais.");
    }
    const senha = await supabaseAdmin.auth.admin.updateUserById(vinculo.user_id, {
      password: data.senha,
      email_confirm: true,
    });
    if (senha.error) {
      await supabaseAdmin
        .from("convites")
        .update({ usado_em: null })
        .eq("token_hash", hash)
        .eq("usado_em", agora);
      throw new Error("Não foi possível definir a senha. Peça um novo convite.");
    }
    await supabaseAdmin.rpc("revogar_tokens_de_convite", { uid: vinculo.user_id });
    return { email: vinculo.email };
  });

type Admin = Awaited<ReturnType<typeof empresaDo>>["supabaseAdmin"];

function sitePublico() {
  return process.env["SITE_URL"]?.trim() || "https://painel.luxbrain.com.br";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function emitirLinkConvite(supabaseAdmin: Admin, tenantUserId: string) {
  const agora = new Date().toISOString();
  await supabaseAdmin
    .from("convites")
    .update({ revogado_em: agora })
    .eq("tenant_user_id", tenantUserId)
    .is("usado_em", null)
    .is("revogado_em", null);
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabaseAdmin.from("convites").insert({
    tenant_user_id: tenantUserId,
    token_hash: hashToken(token),
    expira_em: expiraConvite(),
  });
  if (error) throw new Error("Não foi possível gerar o link do convite.");
  return linkDoConvite(sitePublico(), token);
}

async function criarUsuarioConvite(supabaseAdmin: Admin, email: string, nome: string | null) {
  let gerado: Awaited<ReturnType<Admin["auth"]["admin"]["generateLink"]>>;
  try {
    gerado = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: nome } },
    });
  } catch {
    throw new Error("Não foi possível criar o convite.");
  }
  const id = gerado.data?.user?.id;
  if (gerado.error || !id) throw new Error("Não foi possível criar o convite.");
  await supabaseAdmin.rpc("revogar_tokens_de_convite", { uid: id });
  return id;
}

async function prepararConta(supabaseAdmin: Admin, email: string, nome: string | null, porEmail: boolean) {
  const { data: existente } = await supabaseAdmin.rpc("usuario_id_por_email", { alvo: email });
  let usuarioId = existente ?? null;
  const emergencia = email === EMAIL_CONTA_EMERGENCIA;
  if (emergencia) {
    if (!usuarioId) throw new Error("Não foi possível convidar.");
    return {
      usuarioId,
      emitirLink: false,
      aviso: "Esta pessoa já tem conta. O acesso foi gravado; ela entra com a senha que já usa.",
    };
  }
  if (!usuarioId) {
    if (porEmail) {
      const conviteAuth = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: nome },
      });
      if (!conviteAuth.data.user) throw new Error("Não foi possível enviar o convite por e-mail.");
      usuarioId = conviteAuth.data.user.id;
    } else {
      usuarioId = await criarUsuarioConvite(supabaseAdmin, email, nome);
      return { usuarioId, emitirLink: true, aviso: null };
    }
    return { usuarioId, emitirLink: false, aviso: null };
  }
  if (porEmail) {
    const r = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: nome },
    });
    return {
      usuarioId,
      emitirLink: false,
      aviso: r.error
        ? "Esta pessoa já tem conta. O acesso foi gravado; ela entra com a senha que já usa."
        : null,
    };
  }
  const { data: auth } = await supabaseAdmin.auth.admin.getUserById(usuarioId);
  if (auth.user?.last_sign_in_at) {
    return {
      usuarioId,
      emitirLink: false,
      aviso: "Esta pessoa já tem conta. O acesso foi gravado; ela entra com a senha que já usa.",
    };
  }
  await supabaseAdmin.rpc("revogar_tokens_de_convite", { uid: usuarioId });
  return { usuarioId, emitirLink: true, aviso: null };
}

async function emailDoToken(supabaseAdmin: Admin, token: string) {
  const { data } = await supabaseAdmin
    .from("convites")
    .select("tenant_user_id, expira_em, usado_em, revogado_em")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || !conviteAberto(data)) return null;
  const { data: vinculo } = await supabaseAdmin
    .from("tenant_users")
    .select("email")
    .eq("id", data.tenant_user_id)
    .maybeSingle();
  const email = vinculo?.email ?? null;
  if (email?.trim().toLowerCase() === EMAIL_CONTA_EMERGENCIA) return null;
  return email;
}

async function derrubarSeIsolado(
  supabaseAdmin: Awaited<ReturnType<typeof empresaDo>>["supabaseAdmin"],
  userId: string,
) {
  const { count } = await supabaseAdmin
    .from("tenant_users")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("ativo", true);
  const { data: papeis } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const plataforma = (papeis ?? []).some((p) => p.role === "super_admin");
  if ((count ?? 0) === 0 && !plataforma) {
    await supabaseAdmin.rpc("derrubar_sessoes", { uid: userId });
  }
}
