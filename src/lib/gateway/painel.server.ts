/**
 * Liga o módulo do gateway ao banco do painel: papel e vínculo vêm do
 * Postgres, lidos no servidor a partir do usuário da sessão.
 */
import { papelAcesso } from "@/lib/acesso/papeis";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clienteGatewayPadrao } from "./cliente.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import {
  AcessoNegado,
  criarModuloGateway,
  resolverTenant,
  type ModuloGateway,
  type PerfilGateway,
  type UsuarioSessao,
} from "./modulo.server";

export async function carregarPerfil(usuario: UsuarioSessao): Promise<PerfilGateway> {
  const { data: papeis, error: erroPapeis } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", usuario.userId);
  if (erroPapeis) throw new Error("Não foi possível conferir suas permissões.");

  const { data: vinculos, error: erroVinculos } = await supabaseAdmin
    .from("tenant_users")
    .select("id, is_tenant_admin, ativo, papel_id, tenants(gateway_tenant_id, status)")
    .eq("user_id", usuario.userId);
  if (erroVinculos) throw new Error("Não foi possível conferir suas permissões.");

  const idsPapel = [
    ...new Set((vinculos ?? []).map((v) => v.papel_id).filter((id): id is string => Boolean(id))),
  ];
  const idsVinculo = (vinculos ?? []).map((v) => v.id);
  const [{ data: papeisLinha, error: erroPapel }, { data: unidadesLinha, error: erroUnidades }] =
    await Promise.all([
      idsPapel.length
        ? supabaseAdmin.from("papeis").select("id, papel_gateway, escopo_unidades").in("id", idsPapel)
        : Promise.resolve({ data: [], error: null }),
      idsVinculo.length
        ? supabaseAdmin
            .from("usuario_unidades")
            .select("tenant_user_id, unidade_codigo")
            .in("tenant_user_id", idsVinculo)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (erroPapel || erroUnidades) throw new Error("Não foi possível conferir suas permissões.");
  const porPapel = new Map((papeisLinha ?? []).map((p) => [p.id, p]));

  return {
    userId: usuario.userId,
    email: usuario.email,
    superAdmin: (papeis ?? []).some((p) => p.role === "super_admin"),
    vinculos: (vinculos ?? []).flatMap((v) => {
      const t = v.tenants as { gateway_tenant_id: string | null; status: string } | null;
      if (!t?.gateway_tenant_id) return [];
      const linha = v.papel_id ? porPapel.get(v.papel_id) : undefined;
      const papel = papelAcesso(linha?.papel_gateway);
      // Papel que o gateway não conhece não vira chamada. O vínculo fica inativo.
      const papelValido = Boolean(papel);
      const codigos = (unidadesLinha ?? [])
        .filter((u) => u.tenant_user_id === v.id)
        .map((u) => u.unidade_codigo);
      return [
        {
          gatewayTenantId: t.gateway_tenant_id,
          ativo: t.status === "active" && v.ativo !== false && (papelValido || !v.papel_id),
          admin: Boolean(v.is_tenant_admin),
          ...(papel ? { papel } : {}),
          unidades:
            papel === "gestor" || linha?.escopo_unidades === "todas" ? "*" : codigos,
        },
      ];
    }),
  };
}

async function registrarBloqueio(perfil: PerfilGateway, solicitado: string | null, motivo: string) {
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: perfil.userId,
    actor_email: perfil.email,
    action: "Bloqueio de segurança",
    target: "Gateway de agentes",
    status: "error",
    detail: solicitado ? `${motivo} (empresa no gateway: ${solicitado})` : motivo,
  });
}

let modulo: ModuloGateway | undefined;

export function moduloGateway(): ModuloGateway {
  modulo ??= criarModuloGateway({
    cliente: clienteGatewayPadrao(),
    carregarPerfil,
    registrarBloqueio,
  });
  return modulo;
}

/**
 * Sessão do gateway para o usuário autenticado pelo middleware. O usuário
 * vem do token validado no servidor, nunca de um id enviado pelo navegador.
 */
export function sessaoGateway(context: unknown) {
  const ctx = context as { userId: string; claims: Record<string, unknown> };
  const email = typeof ctx.claims["email"] === "string" ? ctx.claims["email"] : null;
  return moduloGateway().sessao({ userId: ctx.userId, email });
}

/** Sessão do gateway + conferência MFA1 (aal2 / recuperação). */
export async function sessaoGatewayMfa(
  context: unknown,
  gatewayTenantId?: string | null,
) {
  const ctx = context as { userId: string; claims: Record<string, unknown> };
  const sessao = await sessaoGateway(context);
  const { exigirAalDaSessao, MfaErro } = await import("@/lib/acesso/mfa.server");
  try {
    await exigirAalDaSessao({
      userId: ctx.userId,
      email: sessao.perfil.email,
      claims: ctx.claims,
      superAdmin: sessao.perfil.superAdmin,
      gatewayTenantId: gatewayTenantId ?? null,
    });
  } catch (e) {
    if (e instanceof MfaErro) throw new Error(e.message);
    throw e;
  }
  return sessao;
}

/** Repassa ao navegador só a mensagem segura; o resto fica no servidor. */
export async function comGateway<T>(acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof GatewayErro) throw new Error(mensagemParaUsuario(erro));
    console.error("[gateway] erro inesperado:", erro instanceof Error ? erro.name : typeof erro);
    throw new Error("Não foi possível falar com o gateway de agentes.");
  }
}

type Sessao = Awaited<ReturnType<typeof sessaoGateway>>;

/** Abre a sessão do usuário logado e executa a ação com erros seguros para o navegador. */
export function executar<T>(context: unknown, acao: (sessao: Sessao) => Promise<T>): Promise<T> {
  return comGateway(async () => acao(await sessaoGatewayMfa(context)));
}

/** Papel do usuário no gateway, sem expor o tenant vinculado a quem não é da plataforma. */
export function papelDaSessao(sessao: Sessao) {
  if (sessao.perfil.superAdmin) return { papel: "plataforma" as const, motivo: null };
  try {
    return { papel: resolverTenant(sessao.perfil, null).papel, motivo: null };
  } catch (erro) {
    return { papel: null, motivo: erro instanceof Error ? erro.message : "Sem acesso." };
  }
}

export async function auditarPainel(
  sessao: Sessao,
  entrada: { tenantId?: string | null; action: string; target: string; detail?: string },
) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: entrada.tenantId ?? null,
      actor_user_id: sessao.perfil.userId,
      actor_email: sessao.perfil.email,
      action: entrada.action,
      target: entrada.target,
      status: "success",
      detail: entrada.detail ?? null,
    });
  } catch {
    console.error("[gateway] não foi possível registrar a auditoria do painel");
  }
}

/** Empresas do painel com o vínculo atual (só para o admin da plataforma). */
export async function empresasDoPainel(sessao: Sessao) {
  if (!sessao.perfil.superAdmin) throw new AcessoNegado("Acesso restrito ao admin da plataforma.");
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, name, slug, status, gateway_tenant_id")
    .order("name");
  if (error) throw new Error("Não foi possível listar as empresas do painel.");
  return data ?? [];
}

/**
 * Liga um tenant do gateway a uma empresa do painel (ou desliga, com null).
 * Só o admin da plataforma; o gatilho do banco aceita a escrita do servidor.
 */
export async function definirVinculo(
  sessao: Sessao,
  gatewayTenantId: string,
  painelTenantId: string | null,
) {
  if (!sessao.perfil.superAdmin) throw new AcessoNegado("Acesso restrito ao admin da plataforma.");
  // Confere que o tenant existe no gateway antes de gravar o vínculo.
  await (await sessao.tenant(gatewayTenantId)).chamar("GET");

  const { error: erroLimpar } = await supabaseAdmin
    .from("tenants")
    .update({ gateway_tenant_id: null })
    .eq("gateway_tenant_id", gatewayTenantId);
  if (erroLimpar) throw new Error("Não foi possível atualizar o vínculo.");

  let nome: string | null = null;
  if (painelTenantId) {
    const { data, error } = await supabaseAdmin
      .from("tenants")
      .update({ gateway_tenant_id: gatewayTenantId })
      .eq("id", painelTenantId)
      .select("name")
      .maybeSingle();
    if (error) {
      throw new Error(
        error.code === "23505"
          ? "Esta empresa já está vinculada a outro tenant do gateway."
          : "Não foi possível atualizar o vínculo.",
      );
    }
    if (!data) throw new Error("Empresa do painel não encontrada.");
    nome = data.name;
  }

  await auditarPainel(sessao, {
    tenantId: painelTenantId,
    action: painelTenantId ? "Vínculo com o gateway" : "Vínculo com o gateway removido",
    target: gatewayTenantId,
    detail: nome ? `${nome} → ${gatewayTenantId}` : "Sem empresa do painel",
  });
  return { ok: true };
}
