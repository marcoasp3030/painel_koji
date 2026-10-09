/**
 * Liga o módulo do gateway ao banco do painel: papel e vínculo vêm do
 * Postgres, lidos no servidor a partir do usuário da sessão.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clienteGatewayPadrao } from "./cliente.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import {
  criarModuloGateway,
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
    .select("tenants(gateway_tenant_id, status)")
    .eq("user_id", usuario.userId);
  if (erroVinculos) throw new Error("Não foi possível conferir suas permissões.");

  return {
    userId: usuario.userId,
    email: usuario.email,
    superAdmin: (papeis ?? []).some((p) => p.role === "super_admin"),
    vinculos: (vinculos ?? []).flatMap((v) => {
      const t = v.tenants as { gateway_tenant_id: string | null; status: string } | null;
      return t?.gateway_tenant_id
        ? [{ gatewayTenantId: t.gateway_tenant_id, ativo: t.status === "active" }]
        : [];
    }),
  };
}

async function registrarBloqueio(perfil: PerfilGateway, solicitado: string | null) {
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: perfil.userId,
    actor_email: perfil.email,
    action: "Bloqueio de segurança",
    target: "Gateway de agentes",
    status: "error",
    detail: solicitado ? `Empresa solicitada no gateway: ${solicitado}` : "Sem vínculo com o gateway",
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
