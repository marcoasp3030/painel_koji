import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROVIDER_BY_KEY, PROVIDERS, type ProviderKey } from "./providers";

const SUPER_ADMIN_EMAIL = "admin@luxtia.local";

type Ctx = {
  supabase: any;
  userId: string;
  claims: Record<string, unknown>;
};

async function resolveMe(context: Ctx) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const isSuperAdmin = (roles ?? []).some((r: { role: string }) => r.role === "super_admin");

  const { data: membership } = await context.supabase
    .from("tenant_users")
    .select("tenant_id, is_tenant_admin, full_name, email, tenants(id, name, slug, status)")
    .eq("user_id", context.userId)
    .maybeSingle();

  return {
    userId: context.userId,
    email: (context.claims["email"] as string) ?? membership?.email ?? null,
    isSuperAdmin,
    isTenantAdmin: Boolean(membership?.is_tenant_admin),
    tenant: membership?.tenants
      ? {
          id: membership.tenants.id as string,
          name: membership.tenants.name as string,
          slug: membership.tenants.slug as string,
          status: membership.tenants.status as string,
        }
      : null,
  };
}

async function requireSuperAdmin(context: Ctx) {
  const me = await resolveMe(context);
  if (!me.isSuperAdmin) throw new Error("Acesso restrito ao Super Admin.");
  return me;
}

type AuditEntry = {
  tenantId?: string | null;
  tenantName?: string | null;
  action: string;
  target?: string | null;
  status?: "success" | "error";
  detail?: string | null;
};

/** Grava a trilha de auditoria; nunca interrompe a ação principal. */
async function writeAudit(
  me: { userId: string; email: string | null },
  entry: AuditEntry,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let tenantName = entry.tenantName ?? null;
    if (!tenantName && entry.tenantId) {
      const { data: t } = await supabaseAdmin
        .from("tenants")
        .select("name")
        .eq("id", entry.tenantId)
        .maybeSingle();
      tenantName = (t?.name as string) ?? null;
    }
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: entry.tenantId ?? null,
      tenant_name: tenantName,
      actor_user_id: me.userId,
      actor_email: me.email,
      action: entry.action,
      target: entry.target ?? null,
      status: entry.status ?? "success",
      detail: entry.detail ?? null,
    });
  } catch (error) {
    console.error("writeAudit", error);
  }
}

type Me = Awaited<ReturnType<typeof resolveMe>>;

/**
 * Decide, no servidor, sobre qual cliente a ação vai agir.
 * Um usuário comum nunca pode apontar para outro cliente: a tentativa é
 * bloqueada e registrada como evento de segurança.
 */
async function resolveTenantScope(me: Me, requested?: string | null) {
  if (me.isSuperAdmin) return requested ?? me.tenant?.id ?? null;

  if (requested && requested !== me.tenant?.id) {
    await writeAudit(me, {
      tenantId: me.tenant?.id ?? null,
      tenantName: me.tenant?.name ?? null,
      action: "Bloqueio de segurança",
      target: "Tentativa de acessar outro cliente",
      status: "error",
      detail: `Cliente solicitado: ${requested}`,
    });
    throw new Error("Você não tem permissão para acessar dados de outro cliente.");
  }
  return me.tenant?.id ?? null;
}



function maskCredentials(provider: ProviderKey, credentials: Record<string, string> | null) {
  const def = PROVIDER_BY_KEY[provider];
  const out: Record<string, { value: string; filled: boolean; secret: boolean }> = {};
  for (const field of def.fields) {
    const raw = credentials?.[field.key] ?? "";
    const filled = raw.length > 0;
    out[field.key] = {
      secret: field.secret,
      filled,
      value: field.secret ? (filled ? `••••••${raw.slice(-4)}` : "") : raw,
    };
  }
  return out;
}

/** Cria o acesso inicial do Super Admin apenas quando ainda não existe nenhum. */
export const bootstrapSuperAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "super_admin")
    .limit(1);
  if (existing && existing.length > 0) return { created: false };

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: SUPER_ADMIN_EMAIL,
    password: "32443030",
    email_confirm: true,
    user_metadata: { full_name: "Super Admin" },
  });
  if (error || !created?.user) {
    console.error("bootstrapSuperAdmin", error);
    return { created: false };
  }

  await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: created.user.id, role: "super_admin" });
  return { created: true };
});

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => resolveMe(context as Ctx));

/* ---------------------------- Super Admin ---------------------------- */

export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context as Ctx);
    const ctx = context as Ctx;
    const { data: tenants, error } = await ctx.supabase
      .from("tenants")
      .select("id, name, slug, contact_name, contact_email, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: integrations } = await ctx.supabase
      .from("integrations")
      .select("tenant_id, enabled");
    const { data: users } = await ctx.supabase.from("tenant_users").select("tenant_id");

    return (tenants ?? []).map((t: any) => ({
      ...t,
      activeIntegrations: (integrations ?? []).filter(
        (i: any) => i.tenant_id === t.id && i.enabled,
      ).length,
      userCount: (users ?? []).filter((u: any) => u.tenant_id === t.id).length,
    }));
  });

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(2),
        slug: z
          .string()
          .min(2)
          .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await requireSuperAdmin(context as Ctx);
    const { data: tenant, error } = await (context as Ctx).supabase
      .from("tenants")
      .insert({
        name: data.name,
        slug: data.slug,
        contact_name: data.contactName || null,
        contact_email: data.contactEmail || null,
      })
      .select("id")
      .single();
    if (error) {
      await writeAudit(me, {
        action: "Criação de cliente",
        target: data.name,
        status: "error",
        detail: error.message,
      });
      throw new Error(error.message);
    }
    await writeAudit(me, {
      tenantId: tenant.id as string,
      tenantName: data.name,
      action: "Criação de cliente",
      target: data.slug,
    });
    return { id: tenant.id as string };
  });

export const setTenantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = await requireSuperAdmin(context as Ctx);
    const ctx = context as Ctx;
    const { data: before } = await ctx.supabase
      .from("tenants")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await ctx.supabase
      .from("tenants")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(me, {
      tenantId: data.id,
      tenantName: (before?.name as string) ?? null,
      action: data.status === "active" ? "Reativação de cliente" : "Suspensão de cliente",
      target: (before?.name as string) ?? data.id,
    });
    return { ok: true };
  });

export const deleteTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await requireSuperAdmin(context as Ctx);
    const ctx = context as Ctx;
    const { data: before } = await ctx.supabase
      .from("tenants")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await ctx.supabase.from("tenants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(me, {
      tenantName: (before?.name as string) ?? null,
      action: "Exclusão de cliente",
      target: (before?.name as string) ?? data.id,
    });
    return { ok: true };
  });

export const getTenantDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context as Ctx);
    const ctx = context as Ctx;
    const { data: tenant, error } = await ctx.supabase
      .from("tenants")
      .select("id, name, slug, contact_name, contact_email, status, created_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: members } = await ctx.supabase
      .from("tenant_users")
      .select("id, email, full_name, is_tenant_admin, created_at")
      .eq("tenant_id", data.id)
      .order("created_at", { ascending: true });

    const { data: integrations } = await ctx.supabase
      .from("integrations")
      .select("provider, enabled, updated_at")
      .eq("tenant_id", data.id);

    return { tenant, members: members ?? [], integrations: integrations ?? [] };
  });

/* ------------------------- Usuários do tenant ------------------------- */

export const createTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        email: z.string().email(),
        password: z.string().min(8),
        fullName: z.string().optional(),
        isTenantAdmin: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const allowed = me.isSuperAdmin || (me.isTenantAdmin && me.tenant?.id === data.tenantId);
    if (!allowed) {
      await writeAudit(me, {
        tenantId: me.tenant?.id ?? null,
        tenantName: me.tenant?.name ?? null,
        action: "Bloqueio de segurança",
        target: "Criação de acesso negada",
        status: "error",
        detail: `Cliente solicitado: ${data.tenantId}`,
      });
      throw new Error("Sem permissão para criar acessos neste cliente.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName ?? null },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Não foi possível criar o acesso.");

    const { error: linkError } = await supabaseAdmin.from("tenant_users").insert({
      tenant_id: data.tenantId,
      user_id: created.user.id,
      email: data.email,
      full_name: data.fullName ?? null,
      is_tenant_admin: data.isTenantAdmin,
    });
    if (linkError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(linkError.message);
    }

    await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: data.isTenantAdmin ? "tenant_admin" : "tenant_user",
    });

    await writeAudit(me, {
      tenantId: data.tenantId,
      action: "Criação de acesso",
      target: data.email,
      detail: data.isTenantAdmin ? "Administrador do cliente" : "Usuário do cliente",
    });
    return { ok: true };
  });

export const removeTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("tenant_users")
      .select("id, tenant_id, user_id, email")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Acesso não encontrado.");

    const allowed = me.isSuperAdmin || (me.isTenantAdmin && me.tenant?.id === row.tenant_id);
    if (!allowed) {
      await writeAudit(me, {
        tenantId: me.tenant?.id ?? null,
        tenantName: me.tenant?.name ?? null,
        action: "Bloqueio de segurança",
        target: "Remoção de acesso negada",
        status: "error",
        detail: `Acesso de outro cliente: ${row.tenant_id}`,
      });
      throw new Error("Sem permissão para remover este acesso.");
    }
    if (row.user_id === me.userId) throw new Error("Você não pode remover o próprio acesso.");

    await supabaseAdmin.from("tenant_users").delete().eq("id", row.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", row.user_id);
    await supabaseAdmin.auth.admin.deleteUser(row.user_id);
    await writeAudit(me, {
      tenantId: row.tenant_id as string,
      action: "Remoção de acesso",
      target: (row as { email?: string }).email ?? (row.user_id as string),
    });
    return { ok: true };
  });

export const listMyTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    if (!me.tenant) return { members: [], isTenantAdmin: false, tenant: null };
    const { data: members } = await ctx.supabase
      .from("tenant_users")
      .select("id, email, full_name, is_tenant_admin, created_at")
      .eq("tenant_id", me.tenant.id)
      .order("created_at", { ascending: true });
    return { members: members ?? [], isTenantAdmin: me.isTenantAdmin, tenant: me.tenant };
  });

/* --------------------------- Integrações --------------------------- */

export const listIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tenantId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const tenantId = await resolveTenantScope(me, data.tenantId);
    // Super Admin sem cliente escolhido: devolve vazio em vez de derrubar a tela.
    if (!tenantId) return { tenantId: null, canEdit: false, items: [] };

    const { data: rows, error } = await ctx.supabase
      .from("integrations")
      .select("provider, enabled, credentials, updated_at, last_test_ok, last_test_at, last_test_message")
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    return {
      tenantId,
      canEdit: me.isSuperAdmin || me.isTenantAdmin,
      items: PROVIDERS.map((p) => {
        const row = (rows ?? []).find((r: any) => r.provider === p.key);
        return {
          provider: p.key,
          enabled: Boolean(row?.enabled),
          updatedAt: (row?.updated_at as string) ?? null,
          lastTestOk: (row as any)?.last_test_ok ?? null,
          lastTestAt: ((row as any)?.last_test_at as string) ?? null,
          lastTestMessage: ((row as any)?.last_test_message as string) ?? null,
          fields: maskCredentials(p.key, (row?.credentials as Record<string, string>) ?? null),
        };
      }),
    };
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid().optional(),
        provider: z.enum(["ifood", "food99", "whatsapp_official", "uazapi"]),
        enabled: z.boolean(),
        values: z.record(z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const tenantId = await resolveTenantScope(me, data.tenantId);
    if (!tenantId) throw new Error("Nenhum cliente associado a este acesso.");
    if (!me.isSuperAdmin && !me.isTenantAdmin)
      throw new Error("Somente administradores podem alterar integrações.");

    const { data: current } = await ctx.supabase
      .from("integrations")
      .select("credentials")
      .eq("tenant_id", tenantId)
      .eq("provider", data.provider)
      .maybeSingle();

    const merged: Record<string, string> = {
      ...((current?.credentials as Record<string, string>) ?? {}),
    };
    for (const field of PROVIDER_BY_KEY[data.provider].fields) {
      const incoming = data.values[field.key];
      if (incoming === undefined) continue;
      // Campo secreto em branco significa "manter o valor atual".
      if (field.secret && incoming.trim() === "") continue;
      merged[field.key] = incoming.trim();
    }

    const { error } = await ctx.supabase.from("integrations").upsert(
      {
        tenant_id: tenantId,
        provider: data.provider,
        enabled: data.enabled,
        credentials: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,provider" },
    );
    if (error) throw new Error(error.message);
    await writeAudit(me, {
      tenantId,
      action: "Atualização de integração",
      target: PROVIDER_BY_KEY[data.provider].name,
      detail: data.enabled ? "Integração ativa" : "Integração inativa",
    });
    return { ok: true };
  });

/** Verifica se as credenciais salvas respondem no serviço do parceiro. */
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid().optional(),
        provider: z.enum(["ifood", "food99", "whatsapp_official", "uazapi"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const tenantId = await resolveTenantScope(me, data.tenantId);
    if (!tenantId) throw new Error("Nenhum cliente associado a este acesso.");

    const { data: row } = await ctx.supabase
      .from("integrations")
      .select("credentials")
      .eq("tenant_id", tenantId)
      .eq("provider", data.provider)
      .maybeSingle();

    const creds = (row?.credentials as Record<string, string>) ?? {};
    const def = PROVIDER_BY_KEY[data.provider];

    // Tempo limite curto para não deixar a tela presa em serviços lentos.
    const startedAt = Date.now();
    const steps: {
      label: string;
      ok: boolean;
      status: number | null;
      durationMs: number;
      detail: string;
    }[] = [];

    /** Executa a chamada, cronometra e guarda o registro técnico do teste. */
    const withTimeout = async (
      input: string,
      init?: RequestInit,
      log?: { label: string; payload?: Record<string, unknown>; safeUrl?: string },
    ) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const t0 = Date.now();
      try {
        const res = await fetch(input, { ...init, signal: controller.signal });
        const duration = Date.now() - t0;
        let body = "";
        try {
          body = (await res.clone().text()).slice(0, 2000);
        } catch {
          body = "";
        }
        if (log) {
          steps.push({
            label: log.label,
            ok: res.ok,
            status: res.status,
            durationMs: duration,
            detail: res.ok ? "Resposta recebida." : `Código ${res.status}.`,
          });
          await writeRequestLog({
            tenantId,
            provider: data.provider,
            action: log.label,
            method: (init?.method ?? "GET").toUpperCase(),
            url: log.safeUrl ?? input,
            payload: log.payload ?? null,
            responseBody: body,
            httpStatus: res.status,
            durationMs: duration,
            ok: res.ok,
            errorDetail: res.ok ? null : `Código ${res.status}.`,
            actorEmail: me.email,
          });
        }
        return res;
      } catch (error) {
        const duration = Date.now() - t0;
        const aborted = error instanceof Error && error.name === "AbortError";
        const detail = aborted
          ? "Tempo esgotado (10s) sem resposta."
          : error instanceof Error
            ? error.message
            : "Falha de rede.";
        if (log) {
          steps.push({
            label: log.label,
            ok: false,
            status: null,
            durationMs: duration,
            detail,
          });
          await writeRequestLog({
            tenantId,
            provider: data.provider,
            action: log.label,
            method: (init?.method ?? "GET").toUpperCase(),
            url: log.safeUrl ?? input,
            payload: log.payload ?? null,
            responseBody: null,
            httpStatus: null,
            durationMs: duration,
            ok: false,
            errorDetail: detail,
            actorEmail: me.email,
          });
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    };


    /** Traduz a resposta do parceiro em uma frase compreensível. */
    const explain = (status: number, service: string) => {
      if (status === 401 || status === 403) {
        return `${service}: as credenciais foram recusadas. Confira os dados e salve novamente.`;
      }
      if (status === 404) return `${service}: os dados informados não foram encontrados.`;
      if (status === 429) return `${service}: muitas tentativas em pouco tempo. Aguarde um instante.`;
      if (status >= 500) return `${service} está indisponível no momento. Tente novamente em alguns minutos.`;
      return `${service} não aceitou a verificação (código ${status}).`;
    };

    const run = async (): Promise<{ ok: boolean; message: string }> => {
      // Compatibilidade com credenciais salvas nos nomes antigos do 99Food.
      if (data.provider === "food99") {
        const legacy = food99Creds(creds);
        creds["app_secret"] = creds["app_secret"] || legacy.appSecret;
        creds["shop_id"] = creds["shop_id"] || legacy.shopId;
      }
      const required = def.fields.filter((f) => !f.optional);
      const missing = required.filter((f) => !(creds[f.key] ?? "").trim()).map((f) => f.label);
      if (missing.length === required.length) {
        return { ok: false, message: "Nenhuma credencial salva ainda. Preencha e salve para testar." };
      }
      if (missing.length > 0) {
        return {
          ok: false,
          message: `Cadastro incompleto. Falta preencher: ${missing.join(", ")}.`,
        };
      }


      try {
        if (data.provider === "ifood") {
          const body = new URLSearchParams({
            grantType: "client_credentials",
            clientId: creds["client_id"] ?? "",
            clientSecret: creds["client_secret"] ?? "",
          });
          const res = await withTimeout(
            "https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token",
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body,
            },
            {
              label: "Autenticação (OAuth token)",
              payload: {
                grantType: "client_credentials",
                clientId: creds["client_id"] ?? "",
                clientSecret: "••••••",
              },
            },
          );
          if (!res.ok) return { ok: false, message: explain(res.status, "iFood") };

          let token = "";
          try {
            token = ((await res.json()) as { accessToken?: string; access_token?: string })
              .accessToken ?? "";
          } catch {
            token = "";
          }
          if (!token) {
            return {
              ok: false,
              message: "O iFood autenticou, mas não devolveu um token utilizável.",
            };
          }

          // Segunda etapa: confirma que a loja informada pertence a estas credenciais.
          const merchantId = (creds["merchant_id"] ?? "").trim();
          const merchantRes = await withTimeout(
            `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}`,
            { headers: { Authorization: `Bearer ${token}` } },
            { label: "Consulta da loja (merchant)", payload: { merchantId } },
          );
          if (merchantRes.status === 404) {
            return {
              ok: false,
              message: "Autenticação certa, mas o ID da loja não foi encontrado no iFood.",
            };
          }
          if (!merchantRes.ok) return { ok: false, message: explain(merchantRes.status, "iFood") };

          return { ok: true, message: "Conexão com o iFood confirmada: token válido e loja localizada." };
        }


        if (data.provider === "whatsapp_official") {
          const res = await withTimeout(
            `https://graph.facebook.com/v20.0/${encodeURIComponent(creds["phone_number_id"] ?? "")}`,
            { headers: { Authorization: `Bearer ${creds["access_token"] ?? ""}` } },
            { label: "Consulta do número (Graph API)", payload: { phoneNumberId: creds["phone_number_id"] ?? "" } },
          );
          return res.ok
            ? { ok: true, message: "Conexão com o WhatsApp Oficial confirmada." }
            : { ok: false, message: explain(res.status, "WhatsApp Oficial") };
        }

        if (data.provider === "uazapi") {
          const base = (creds["instance_url"] ?? "").replace(/\/+$/, "");
          if (!/^https?:\/\//.test(base)) {
            return { ok: false, message: "Informe a URL da instância começando com https://." };
          }
          const res = await withTimeout(
            `${base}/instance/status`,
            { headers: { token: creds["token"] ?? "" } },
            { label: "Status da instância", payload: { instance: creds["instance_name"] ?? "" } },
          );
          return res.ok
            ? { ok: true, message: "Conexão com a Uazapi confirmada." }
            : { ok: false, message: explain(res.status, "Uazapi") };
        }

        // 99Food: obtém o Auth Token oficial e usa-o para consultar a loja vinculada.
        const { appId, appSecret, shopId, appShopId } = food99Creds(creds);
        if (!appId) return { ok: false, message: "Falta salvar o App ID do 99Food." };
        if (!appSecret) return { ok: false, message: "Falta salvar o App Secret do 99Food." };
        if (!appShopId) return { ok: false, message: "Falta salvar o APP Shop ID do 99Food." };
        if (!/^\d{4,}$/.test(shopId)) {
          return {
            ok: false,
            message:
              "O Shop ID deve ser o número da loja (ex.: 5764617677143805837). O apelido como “luxtia_sp_001” é o APP Shop ID e vai no campo próprio.",
          };
        }
        const authParams = { app_id: appId, app_secret: appSecret, app_shop_id: appShopId };
        const safeAuthUrl = (path: string) =>
          `${FOOD99_BASE}${path}?app_id=${encodeURIComponent(appId)}&app_secret=••••••&app_shop_id=${encodeURIComponent(appShopId)}`;
        const askToken = async (label: string) => {
          const r = await withTimeout(
            food99Url(FOOD99_PATHS.auth(), authParams),
            { headers: { Accept: "application/json" } },
            {
              label,
              payload: { appId, appSecret: "••••••", appShopId },
              safeUrl: safeAuthUrl(FOOD99_PATHS.auth()),
            },
          );
          const b = (await r.clone().json().catch(() => null)) as any;
          return { res: r, body: b, token: String(b?.data?.auth_token ?? "") };
        };

        // Reaproveita o token guardado: a 99Food aceita só 1 pedido de token por minuto.
        let authToken = (await readFood99Token(tenantId)) ?? "";
        if (!authToken) {
          let { res: tokenRes, body: tokenBody, token } = await askToken(
            "Obtenção do Auth Token (99Food)",
          );
          // Token expirado ou ausente: tenta renovar automaticamente e buscar de novo.
          if (
            !food99RateLimited(tokenBody) &&
            (tokenBody?.errno === 10102 || tokenBody?.errno === 10101 || !token)
          ) {
            await withTimeout(
              food99Url(FOOD99_PATHS.refresh(), authParams),
              { headers: { Accept: "application/json" } },
              {
                label: "Renovação do Auth Token (99Food)",
                payload: { appId, appSecret: "••••••", appShopId },
                safeUrl: safeAuthUrl(FOOD99_PATHS.refresh()),
              },
            ).catch(() => null);
            ({ res: tokenRes, body: tokenBody, token } = await askToken(
              "Obtenção do Auth Token após renovação (99Food)",
            ));
          }
          if (!tokenRes.ok || tokenBody?.errno !== 0 || !token) {
            return {
              ok: false,
              message: food99ApiMessage(tokenBody, "Não foi possível obter o Auth Token do 99Food."),
            };
          }
          authToken = token;
          await saveFood99Token(tenantId, authToken, tokenBody);
        }

        const res = await withTimeout(
          food99Url(FOOD99_PATHS.store(), { auth_token: authToken }),
          { headers: { Accept: "application/json" } },
          { label: "Consulta da loja (99Food)", payload: { shopId, appShopId, authToken: "••••••" } },
        );
        const storeBody = await res.clone().json().catch(() => null) as any;
        if (!res.ok || storeBody?.errno !== 0) {
          // HTTP 200 com erro no corpo também é falha: corrige o passo registrado.
          const last = steps[steps.length - 1];
          if (last && last.label === "Consulta da loja (99Food)") {
            last.ok = false;
            last.detail = food99ApiMessage(storeBody, `Código ${res.status}.`);
          }
          // Token recusado: descarta o guardado para renovar no próximo teste.
          if (storeBody?.errno === 10101 || storeBody?.errno === 10102) {
            await saveFood99Token(tenantId, "", { data: { expire_time: 0 } }).catch(() => null);
          }
          return {
            ok: false,
            message: food99ApiMessage(storeBody, "O 99Food não retornou os dados da loja vinculada."),
          };
        }
        if (String(storeBody?.data?.shop_id ?? "") !== shopId) {
          return { ok: false, message: "O Auth Token pertence a outra loja. Confira o Shop ID e o APP Shop ID vinculados à aplicação." };
        }
        return res.ok
          ? {
              ok: true,
              message: "Conexão com o 99Food confirmada: aplicação autenticada e loja localizada.",
            }
          : { ok: false, message: explain(res.status, "99Food") };
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return {
          ok: false,
          message: aborted
            ? `${def.name}: o serviço não respondeu em 10 segundos. Tente novamente em instantes.`
            : `Não foi possível falar com o ${def.name} agora. Verifique a conexão e tente de novo.`,
        };
      }
    };

    const result = await run();
    // Avisa quando o parceiro respondeu, porém devagar.
    const elapsed = Date.now() - startedAt;
    if (result.ok && elapsed > 4000) {
      result.message += ` O serviço respondeu devagar (${Math.round(elapsed / 1000)}s).`;
    }
    const checkedAt = new Date().toISOString();
    // Guarda o status da última verificação para continuar visível ao recarregar.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("integrations")
        .update({
          last_test_ok: result.ok,
          last_test_at: checkedAt,
          last_test_message: result.message,
        } as never)
        .eq("tenant_id", tenantId)
        .eq("provider", data.provider);
    } catch (error) {
      console.error("persistTestStatus", error);
    }
    await writeAudit(me, {
      tenantId,
      action: "Teste de conexão",
      target: def.name,
      status: result.ok ? "success" : "error",
      detail: result.message,
    });
    return { ...result, durationMs: elapsed, steps, checkedAt };
  });

/* --------------------- Registro técnico (debug) --------------------- */

/** Guarda a chamada feita ao parceiro; nunca interrompe o teste. */
async function writeRequestLog(entry: {
  tenantId: string;
  provider: ProviderKey;
  action: string;
  method: string;
  url: string;
  payload: Record<string, unknown> | null;
  responseBody: string | null;
  httpStatus: number | null;
  durationMs: number;
  ok: boolean;
  errorDetail: string | null;
  actorEmail: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_request_logs").insert({
      tenant_id: entry.tenantId,
      provider: entry.provider,
      action: entry.action,
      method: entry.method,
      url: entry.url,
      request_payload: (entry.payload ?? null) as never,
      response_body: entry.responseBody,
      http_status: entry.httpStatus,
      duration_ms: entry.durationMs,
      ok: entry.ok,
      error_detail: entry.errorDetail,
      actor_email: entry.actorEmail,
    });
  } catch (error) {
    console.error("writeRequestLog", error);
  }
}

export const listIntegrationRequestLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid().optional(),
        provider: z.enum(["ifood", "food99", "whatsapp_official", "uazapi"]).default("ifood"),
        onlyErrors: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const tenantId = await resolveTenantScope(me, data.tenantId);
    if (!tenantId) return { tenantId: null, items: [] };

    let query = ctx.supabase
      .from("integration_request_logs")
      .select(
        "id, action, method, url, request_payload, response_body, http_status, duration_ms, ok, error_detail, actor_email, created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("provider", data.provider)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.onlyErrors) query = query.eq("ok", false);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { tenantId, items: rows ?? [] };
  });

/** Eventos brutos recebidos pelos webhooks dos parceiros. */
export const listWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid().optional(),
        platform: z.string().default("99food"),
        orderId: z.string().trim().max(120).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const tenantId = await resolveTenantScope(me, data.tenantId);
    if (!tenantId) return { tenantId: null, items: [] };

    let query = ctx.supabase
      .from("webhook_events")
      .select(
        "id, platform, shop_id, order_id, event_type, status_original, event_time, received_at, payload_original",
      )
      .eq("tenant_id", tenantId)
      .eq("platform", data.platform)
      .order("received_at", { ascending: false })
      .limit(200);
    if (data.orderId) query = query.eq("order_id", data.orderId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { tenantId, items: rows ?? [] };
  });


/* --------------------- Central de testes do iFood --------------------- */

const IFOOD_BASE = "https://merchant-api.ifood.com.br";

type IfoodCall = {
  label: string;
  method: string;
  url: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  detail: string;
  body: any;
};

/** Executa uma chamada ao iFood, cronometra, registra no debug e devolve o corpo. */
async function ifoodCall(opts: {
  tenantId: string;
  actorEmail: string | null;
  label: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  payload?: Record<string, unknown>;
}): Promise<IfoodCall> {
  const method = (opts.method ?? "GET").toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const t0 = Date.now();
  try {
    const init: RequestInit = { method, signal: controller.signal };
    if (opts.headers) init.headers = opts.headers;
    if (opts.body !== undefined) init.body = opts.body;
    const res = await fetch(opts.url, init);
    const durationMs = Date.now() - t0;
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    await writeRequestLog({
      tenantId: opts.tenantId,
      provider: "ifood",
      action: opts.label,
      method,
      url: opts.url,
      payload: opts.payload ?? null,
      responseBody: text.slice(0, 4000),
      httpStatus: res.status,
      durationMs,
      ok: res.ok,
      errorDetail: res.ok ? null : `Código ${res.status}.`,
      actorEmail: opts.actorEmail,
    });
    return {
      label: opts.label,
      method,
      url: opts.url,
      ok: res.ok,
      status: res.status,
      durationMs,
      detail: res.ok ? "Resposta recebida." : `Código ${res.status}.`,
      body: parsed,
    };
  } catch (error) {
    const durationMs = Date.now() - t0;
    const aborted = error instanceof Error && error.name === "AbortError";
    const detail = aborted
      ? "Tempo esgotado (15s) sem resposta."
      : error instanceof Error
        ? error.message
        : "Falha de rede.";
    await writeRequestLog({
      tenantId: opts.tenantId,
      provider: "ifood",
      action: opts.label,
      method,
      url: opts.url,
      payload: opts.payload ?? null,
      responseBody: null,
      httpStatus: null,
      durationMs,
      ok: false,
      errorDetail: detail,
      actorEmail: opts.actorEmail,
    });
    return {
      label: opts.label,
      method,
      url: opts.url,
      ok: false,
      status: null,
      durationMs,
      detail,
      body: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Executa uma verificação da central de testes do iFood. */
export const runIfoodTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid().optional(),
        action: z.enum(["auth", "merchant", "status", "polling", "order", "reviews"]),
        orderId: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const tenantId = await resolveTenantScope(me, data.tenantId);
    if (!tenantId) throw new Error("Escolha um cliente para executar os testes.");

    const { data: row } = await ctx.supabase
      .from("integrations")
      .select("credentials")
      .eq("tenant_id", tenantId)
      .eq("provider", "ifood")
      .maybeSingle();
    const creds = (row?.credentials as Record<string, string>) ?? {};
    const clientId = (creds["client_id"] ?? "").trim();
    const clientSecret = (creds["client_secret"] ?? "").trim();
    const merchantId = (creds["merchant_id"] ?? "").trim();

    const calls: IfoodCall[] = [];
    const startedAt = Date.now();
    const finish = (ok: boolean, message: string, payload?: Record<string, unknown>) => ({
      ok,
      message,
      action: data.action,
      durationMs: Date.now() - startedAt,
      calls,
      checkedAt: new Date().toISOString(),
      ...(payload ?? {}),
    });

    if (!clientId || !clientSecret) {
      return finish(false, "Falta salvar o Client ID e o Client Secret do iFood.");
    }

    // Autenticação: todas as consultas dependem do token.
    const auth = await ifoodCall({
      tenantId,
      actorEmail: me.email,
      label: "Autenticação (OAuth token)",
      url: `${IFOOD_BASE}/authentication/v1.0/oauth/token`,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grantType: "client_credentials",
        clientId,
        clientSecret,
      }),
      payload: { grantType: "client_credentials", clientId, clientSecret: "••••••" },
    });
    calls.push(auth);

    const token =
      (auth.body as { accessToken?: string; access_token?: string } | null)?.accessToken ??
      (auth.body as { access_token?: string } | null)?.access_token ??
      "";

    if (!auth.ok || !token) {
      return finish(
        false,
        !auth.ok
          ? auth.status === 401 || auth.status === 403
            ? "O iFood recusou as credenciais. Confira o Client ID e o Client Secret."
            : auth.status
              ? `O iFood não autenticou (código ${auth.status}).`
              : auth.detail
          : "O iFood autenticou, mas não devolveu um token utilizável.",
      );
    }

    if (data.action === "auth") {
      return finish(true, `Autenticação confirmada em ${(auth.durationMs / 1000).toFixed(1)}s.`);
    }

    const authHeaders = { Authorization: `Bearer ${token}` };
    const needsMerchant = ["merchant", "status", "reviews"].includes(data.action);
    if (needsMerchant && !merchantId) {
      return finish(false, "Falta salvar o ID da loja (merchant) do iFood.");
    }

    if (data.action === "merchant" || data.action === "status") {
      const merchant = await ifoodCall({
        tenantId,
        actorEmail: me.email,
        label: "Consulta da loja (merchant)",
        url: `${IFOOD_BASE}/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}`,
        headers: authHeaders,
        payload: { merchantId },
      });
      calls.push(merchant);

      const statusCall = await ifoodCall({
        tenantId,
        actorEmail: me.email,
        label: "Status de funcionamento da loja",
        url: `${IFOOD_BASE}/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}/status`,
        headers: authHeaders,
        payload: { merchantId },
      });
      calls.push(statusCall);

      if (!merchant.ok) {
        return finish(
          false,
          merchant.status === 404
            ? "O ID da loja não foi encontrado no iFood."
            : `Não foi possível consultar a loja (código ${merchant.status ?? "sem resposta"}).`,
        );
      }
      return finish(true, "Loja localizada no iFood.", {
        merchant: merchant.body,
        merchantStatus: statusCall.ok ? statusCall.body : null,
      });
    }

    if (data.action === "polling") {
      const events = await ifoodCall({
        tenantId,
        actorEmail: me.email,
        label: "Polling de eventos de pedidos",
        url: `${IFOOD_BASE}/order/v1.0/events:polling`,
        headers: merchantId ? { ...authHeaders, "x-polling-merchants": merchantId } : authHeaders,
        payload: { merchantId },
      });
      calls.push(events);

      if (!events.ok && events.status !== 204) {
        return finish(
          false,
          `Não foi possível consultar os eventos (código ${events.status ?? "sem resposta"}).`,
        );
      }

      const list = Array.isArray(events.body) ? (events.body as Record<string, unknown>[]) : [];
      // Busca o detalhe dos primeiros pedidos para mostrar algo legível na tela.
      const orders: any[] = [];
      for (const ev of list.slice(0, 5)) {
        const orderId = String(ev["orderId"] ?? "");
        if (!orderId) continue;
        const detail = await ifoodCall({
          tenantId,
          actorEmail: me.email,
          label: "Detalhes do pedido",
          url: `${IFOOD_BASE}/order/v1.0/orders/${encodeURIComponent(orderId)}`,
          headers: authHeaders,
          payload: { orderId },
        });
        calls.push(detail);
        if (detail.ok) orders.push(detail.body);
      }

      return finish(
        true,
        list.length === 0
          ? "Nenhum evento novo de pedido no momento."
          : `${list.length} evento(s) recebido(s) do iFood.`,
        { events: list, orders },
      );
    }

    if (data.action === "order") {
      const orderId = (data.orderId ?? "").trim();
      if (!orderId) return finish(false, "Informe o número (ID) do pedido para consultar.");
      const detail = await ifoodCall({
        tenantId,
        actorEmail: me.email,
        label: "Detalhes do pedido",
        url: `${IFOOD_BASE}/order/v1.0/orders/${encodeURIComponent(orderId)}`,
        headers: authHeaders,
        payload: { orderId },
      });
      calls.push(detail);
      if (!detail.ok) {
        return finish(
          false,
          detail.status === 404
            ? "Pedido não encontrado no iFood."
            : `Não foi possível consultar o pedido (código ${detail.status ?? "sem resposta"}).`,
        );
      }
      return finish(true, "Pedido encontrado.", { orders: [detail.body] });
    }

    // reviews
    const reviews = await ifoodCall({
      tenantId,
      actorEmail: me.email,
      label: "Consulta de avaliações",
      url: `${IFOOD_BASE}/review/v1.0/merchants/${encodeURIComponent(merchantId)}/reviews?page=1&pageSize=10&sort=DESC&sortBy=CREATED_AT`,
      headers: authHeaders,
      payload: { merchantId },
    });
    calls.push(reviews);
    if (!reviews.ok) {
      return finish(
        false,
        `Não foi possível consultar as avaliações (código ${reviews.status ?? "sem resposta"}).`,
      );
    }
    const body = reviews.body as { reviews?: unknown[] } | unknown[] | null;
    const items = Array.isArray(body) ? body : (body?.reviews ?? []);
    return finish(
      true,
      items.length === 0 ? "Nenhuma avaliação encontrada." : `${items.length} avaliação(ões) recebida(s).`,
      { reviews: items },
    );
  });


/* ---------------------------- Auditoria ---------------------------- */

/** Tipos de ação disponíveis no filtro da tela de auditoria. */
const AUDIT_ACTIONS = [
  "Criação de cliente",
  "Suspensão de cliente",
  "Reativação de cliente",
  "Exclusão de cliente",
  "Criação de acesso",
  "Remoção de acesso",
  "Atualização de integração",
  "Teste de conexão",
  "Bloqueio de segurança",
] as const;



export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid().optional(),
        actor: z.string().trim().max(200).optional(),
        action: z.string().trim().max(120).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);

    let query = ctx.supabase
      .from("audit_logs")
      .select("id, tenant_id, tenant_name, actor_email, action, target, status, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (me.isSuperAdmin) {
      if (data.tenantId) query = query.eq("tenant_id", data.tenantId);
    } else {
      if (!me.tenant) return { scope: "none" as const, items: [], actions: [] };
      // Reforça o isolamento além da política de acesso do banco: um usuário
      // comum só enxerga o próprio cliente, mesmo pedindo outro.
      const scoped = await resolveTenantScope(me, data.tenantId);
      query = query.eq("tenant_id", scoped);
    }

    if (data.actor) query = query.ilike("actor_email", `%${data.actor}%`);
    if (data.action) query = query.eq("action", data.action);
    if (data.from) query = query.gte("created_at", new Date(data.from).toISOString());
    if (data.to) {
      const end = new Date(data.to);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return {
      scope: me.isSuperAdmin ? ("all" as const) : ("tenant" as const),
      items: rows ?? [],
      actions: AUDIT_ACTIONS,
    };
  });


/* --------------------- Central de testes do 99Food --------------------- */

const FOOD99_BASE = "https://openapi.99food.com";

/** Caminhos usados nas consultas ao 99Food. */
const FOOD99_PATHS = {
  auth: () => "/v1/auth/authtoken/get",
  refresh: () => "/v1/auth/authtoken/refresh",

  store: () => "/v1/shop/shop/detail",
  status: () => "/v1/shop/shop/detail",
  polling: (storeId: string) =>
    `/v1/orders/events:polling?storeId=${encodeURIComponent(storeId)}`,
  order: () => "/v1/order/order/detail",
  reviews: (storeId: string) =>
    `/v1/merchants/${encodeURIComponent(storeId)}/reviews?page=1&pageSize=20`,
};

function food99Url(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `${FOOD99_BASE}${path}?${query.toString()}`;
}

/** A 99Food devolve o limite de frequência dentro do corpo, com HTTP 200. */
function food99RateLimited(body: any) {
  const text = `${body?.errmsg ?? ""} ${body?.message ?? ""}`.toLowerCase();
  return text.includes("calling frequency") || text.includes("frequency exceeds");
}

/** Token guardado no banco, reaproveitado enquanto estiver válido. */
async function readFood99Token(tenantId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integrations")
      .select("auth_token, auth_token_expires_at")
      .eq("tenant_id", tenantId)
      .eq("provider", "food99")
      .maybeSingle();
    const row = data as any;
    if (!row?.auth_token || !row?.auth_token_expires_at) return null;
    // Margem de 2 minutos para não usar um token prestes a vencer.
    if (new Date(row.auth_token_expires_at).getTime() - Date.now() < 120000) return null;
    return String(row.auth_token);
  } catch {
    return null;
  }
}

async function saveFood99Token(tenantId: string, token: string, body: any) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const raw = body?.data?.expire_time ?? body?.data?.expires_at ?? body?.data?.expire_at;
    let expiresAt: string;
    if (typeof raw === "number") {
      expiresAt = new Date(raw > 1e12 ? raw : raw * 1000).toISOString();
    } else if (typeof raw === "string" && !Number.isNaN(Date.parse(raw))) {
      expiresAt = new Date(raw).toISOString();
    } else {
      expiresAt = new Date(Date.now() + 3600_000).toISOString();
    }
    await supabaseAdmin
      .from("integrations")
      .update({
        auth_token: token,
        auth_token_obtained_at: new Date().toISOString(),
        auth_token_expires_at: expiresAt,
      } as never)
      .eq("tenant_id", tenantId)
      .eq("provider", "food99");
  } catch (error) {
    console.error("saveFood99Token", error);
  }
}

function food99ApiMessage(body: any, fallback: string) {
  if (food99RateLimited(body)) {
    return "A 99Food permite apenas 1 consulta deste tipo a cada 60 segundos. Aguarde cerca de um minuto e teste novamente.";
  }
  const code = Number(body?.errno);
  if (code === 10101) return "A loja ainda não possui Auth Token. Confirme o vínculo do APP Shop ID no portal da 99Food.";
  if (code === 10102) return "O Auth Token da loja expirou. Gere um novo vínculo/token no portal da 99Food e teste novamente.";
  if (code === 11033) return "A loja vinculada não existe na 99Food. Confira o Shop ID e o APP Shop ID.";
  if (code === 14105) return "O App ID não existe na 99Food. Confira o valor salvo.";
  if (code === 14106) return "O App Secret está incorreto. Salve novamente a chave da aplicação.";
  return typeof body?.errmsg === "string" && body.errmsg !== "ok" ? `${fallback} ${body.errmsg}` : fallback;
}

/**
 * Credenciais oficiais da 99Food Open Platform, com compatibilidade para os
 * nomes antigos (api_key -> app_secret, store_id -> shop_id).
 */
function food99Creds(creds: Record<string, string>) {
  const env = (creds["environment"] ?? "").trim().toLowerCase();
  return {
    appId: (creds["app_id"] ?? "").trim(),
    appSecret: (creds["app_secret"] ?? creds["api_key"] ?? "").trim(),
    shopId: (creds["shop_id"] ?? creds["store_id"] ?? "").trim(),
    appShopId: (creds["app_shop_id"] ?? "").trim(),
    environment: env === "sandbox" || env === "test" ? "sandbox" : "production",
  };
}

type PartnerCall = {
  label: string;
  method: string;
  url: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  detail: string;
  body: any;
};

/** Executa uma chamada ao 99Food, cronometra, registra no debug e devolve o corpo. */
async function food99Call(opts: {
  tenantId: string;
  actorEmail: string | null;
  label: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  payload?: Record<string, unknown>;
  safeUrl?: string;
}): Promise<PartnerCall> {
  const method = (opts.method ?? "GET").toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const t0 = Date.now();
  try {
    const init: RequestInit = { method, signal: controller.signal };
    if (opts.headers) init.headers = opts.headers;
    if (opts.body !== undefined) init.body = opts.body;
    const res = await fetch(opts.url, init);
    const durationMs = Date.now() - t0;
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    // HTTP 200 não basta: a 99Food coloca erros (inclusive limite de frequência) no corpo.
    const apiOk =
      !food99RateLimited(parsed) &&
      ((res.ok && !(parsed && typeof parsed === "object" && "errno" in parsed)) ||
        parsed?.errno === 0);
    const apiDetail = apiOk
      ? "Resposta recebida."
      : food99ApiMessage(parsed, res.ok ? "A 99Food recusou a operação." : `Código ${res.status}.`);
    await writeRequestLog({
      tenantId: opts.tenantId,
      provider: "food99",
      action: opts.label,
      method,
      url: opts.safeUrl ?? opts.url,
      payload: opts.payload ?? null,
      responseBody: text.slice(0, 4000),
      httpStatus: res.status,
      durationMs,
      ok: apiOk,
      errorDetail: apiOk ? null : apiDetail,
      actorEmail: opts.actorEmail,
    });
    return {
      label: opts.label,
      method,
      url: opts.safeUrl ?? opts.url,
      ok: apiOk,
      status: res.status,
      durationMs,
      detail: apiDetail,
      body: parsed,
    };
  } catch (error) {
    const durationMs = Date.now() - t0;
    const aborted = error instanceof Error && error.name === "AbortError";
    const detail = aborted
      ? "Tempo esgotado (15s) sem resposta."
      : error instanceof Error
        ? error.message
        : "Falha de rede.";
    await writeRequestLog({
      tenantId: opts.tenantId,
      provider: "food99",
      action: opts.label,
      method,
      url: opts.safeUrl ?? opts.url,
      payload: opts.payload ?? null,
      responseBody: null,
      httpStatus: null,
      durationMs,
      ok: false,
      errorDetail: detail,
      actorEmail: opts.actorEmail,
    });
    return {
      label: opts.label,
      method,
      url: opts.url,
      ok: false,
      status: null,
      durationMs,
      detail,
      body: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Executa uma verificação da central de testes do 99Food. */
export const runFood99Test = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid().optional(),
        action: z.enum(["auth", "store", "status", "polling", "order", "reviews"]),
        orderId: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const me = await resolveMe(ctx);
    const tenantId = await resolveTenantScope(me, data.tenantId);
    if (!tenantId) throw new Error("Escolha um cliente para executar os testes.");

    const { data: row } = await ctx.supabase
      .from("integrations")
      .select("credentials")
      .eq("tenant_id", tenantId)
      .eq("provider", "food99")
      .maybeSingle();
    const creds = (row?.credentials as Record<string, string>) ?? {};
    const { appId, appSecret, shopId, appShopId } = food99Creds(creds);
    const storeId = shopId;

    const calls: PartnerCall[] = [];
    const startedAt = Date.now();
    const finish = (ok: boolean, message: string, payload?: Record<string, unknown>) => ({
      ok,
      message,
      action: data.action,
      durationMs: Date.now() - startedAt,
      calls,
      checkedAt: new Date().toISOString(),
      ...(payload ?? {}),
    });

    if (!appId) return finish(false, "Falta salvar o App ID do 99Food.");
    if (!appSecret) return finish(false, "Falta salvar o App Secret do 99Food.");
    if (!appShopId) return finish(false, "Falta salvar o APP Shop ID do 99Food.");
    const needsStore = ["store", "status", "polling", "reviews"].includes(data.action);
    if (needsStore && !storeId) return finish(false, "Falta salvar o Shop ID (ID da loja) do 99Food.");
    if (needsStore && !/^\d{4,}$/.test(storeId)) {
      return finish(
        false,
        "O Shop ID deve ser o número da loja (ex.: 5764617677143805837). O apelido como “luxtia_sp_001” é o APP Shop ID e vai no campo próprio.",
      );
    }

    const explain99 = (call: PartnerCall, assunto: string) => {
      if (call.status === 401 || call.status === 403) {
        return "O 99Food recusou o App ID/App Secret. Confira os dados e salve novamente.";
      }
      if (call.status === 404) {
        return `${assunto} não encontrado no 99Food. Confira o Shop ID e se o ambiente escolhido (teste ou produção) é o mesmo da loja.`;
      }
      if (call.status === 429) return "Muitas tentativas em pouco tempo. Aguarde um instante.";
      if (call.status && call.status >= 500) {
        return "O 99Food está indisponível no momento. Tente novamente em alguns minutos.";
      }
      return call.status ? `${assunto}: falha (código ${call.status}).` : call.detail;
    };

    const authParams = { app_id: appId, app_secret: appSecret, app_shop_id: appShopId };
    const safeAuthUrl = (path: string) =>
      `${FOOD99_BASE}${path}?app_id=${encodeURIComponent(appId)}&app_secret=••••••&app_shop_id=${encodeURIComponent(appShopId)}`;

    const askToken = async (label: string, path: string) => {
      const call = await food99Call({
        tenantId,
        actorEmail: me.email,
        label,
        url: food99Url(path, authParams),
        headers: { Accept: "application/json" },
        payload: { appId, appSecret: "••••••", appShopId },
        safeUrl: safeAuthUrl(path),
      });
      calls.push(call);
      return { call, token: String(call.body?.data?.auth_token ?? "") };
    };

    const getAuthToken = async () => {
      // Reaproveita o token guardado enquanto estiver válido (limite de 1 pedido/60s).
      const cached = await readFood99Token(tenantId);
      if (cached) {
        const call: PartnerCall = {
          label: "Auth Token reaproveitado (sem chamar a 99Food)",
          method: "CACHE",
          url: "-",
          ok: true,
          status: null,
          durationMs: 0,
          detail: "Token válido guardado no sistema.",
          body: null,
        };
        calls.push(call);
        return { call, token: cached };
      }
      let result = await askToken("Obtenção do Auth Token", FOOD99_PATHS.auth());
      const errno = Number(result.call.body?.errno);
      // Token expirado ou ausente: renova automaticamente e busca de novo.
      if (
        !food99RateLimited(result.call.body) &&
        (!result.token || errno === 10102 || errno === 10101)
      ) {
        await askToken("Renovação do Auth Token", FOOD99_PATHS.refresh());
        result = await askToken("Obtenção do Auth Token após renovação", FOOD99_PATHS.auth());
      }
      if (result.token) await saveFood99Token(tenantId, result.token, result.call.body);
      return result;
    };


    if (data.action === "auth") {
      const { call: auth, token } = await getAuthToken();
      return auth.ok
        && token
        ? finish(true, `App ID, App Secret e APP Shop ID válidos (${(auth.durationMs / 1000).toFixed(1)}s).`)
        : finish(false, auth.detail || explain99(auth, "Obtenção do Auth Token"));
    }

    if (data.action === "store" || data.action === "status") {
      const { call: auth, token } = await getAuthToken();
      if (!auth.ok || !token) return finish(false, auth.detail);
      const store = await food99Call({
        tenantId,
        actorEmail: me.email,
        label: "Consulta da loja (99Food)",
        url: food99Url(FOOD99_PATHS.store(), { auth_token: token }),
        headers: { Accept: "application/json" },
        payload: { storeId, appShopId, authToken: "••••••" },
      });
      calls.push(store);
      if (!store.ok) return finish(false, explain99(store, "O ID da loja"));
      if (String(store.body?.data?.shop_id ?? "") !== storeId) {
        return finish(false, "O Auth Token retornado pertence a outra loja. Confira o Shop ID e o APP Shop ID.");
      }
      return finish(true, "Loja localizada no 99Food.", {
        merchant: store.body?.data ?? store.body,
        merchantStatus: store.body?.data ?? null,
      });
    }

    if (data.action === "polling") {
      return finish(true, "A API oficial recomendada da 99Food envia novos pedidos pelo webhook; não há polling neste protocolo.", { events: [], orders: [] });
    }

    if (data.action === "order") {
      const orderId = (data.orderId ?? "").trim();
      if (!orderId) return finish(false, "Informe o número (ID) do pedido para consultar.");
      const { call: auth, token } = await getAuthToken();
      if (!auth.ok || !token) return finish(false, auth.detail);
      const detail = await food99Call({
        tenantId,
        actorEmail: me.email,
        label: "Detalhes do pedido",
        url: food99Url(FOOD99_PATHS.order(), { auth_token: token, order_id: orderId }),
        headers: { Accept: "application/json" },
        payload: { orderId, authToken: "••••••" },
      });
      calls.push(detail);
      if (!detail.ok) return finish(false, explain99(detail, "O pedido"));
      return finish(true, "Pedido encontrado.", { orders: [detail.body] });
    }

    // reviews
    return finish(true, "A documentação oficial da 99Food não publica uma API de avaliações para esta integração.", { reviews: [] });
  });
