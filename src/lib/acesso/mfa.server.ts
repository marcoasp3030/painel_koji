/**
 * MFA1 no servidor: aal, step-up, tentativas e auditoria.
 * Escritas em conta_seguranca usam service_role (bypass RLS).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizarCodigo } from "./codigos-recuperacao";
import {
  decidirMfa1,
  exigeAal2,
  mfa1ObrigatorioLigado,
  mfaBloqueado,
  novoStepUpAte,
  registrarFalhaMfa,
  sessaoEhAal2,
  stepUpValido,
  type AcaoStepUp,
} from "./mfa";
import type { PapelAcesso } from "./papeis";
import { papelAcesso } from "./papeis";
import { contaEmergencia } from "./segunda-etapa";

export class MfaErro extends Error {
  codigo: "mfa_obrigatorio" | "mfa_aal" | "mfa_step_up" | "mfa_bloqueado" | "mfa_codigo";
  constructor(
    codigo: MfaErro["codigo"],
    message: string,
  ) {
    super(message);
    this.codigo = codigo;
  }
}

export function hashCodigoMfa(codigo: string) {
  return createHash("sha256").update(normalizarCodigo(codigo)).digest("hex");
}

export function hashesIguaisMfa(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

type Conta = {
  prazo_ate: string | null;
  emergencia: boolean;
  step_up_ate: string | null;
  mfa_bloqueado_ate: string | null;
  mfa_falhas: number;
  mfa_falha_em: string | null;
  recuperacao_valida_ate: string | null;
  codigos_recuperacao: string[];
};

export async function lerContaSeguranca(userId: string): Promise<Conta | null> {
  const { data } = await supabaseAdmin
    .from("conta_seguranca")
    .select(
      "prazo_ate, emergencia, step_up_ate, mfa_bloqueado_ate, mfa_falhas, mfa_falha_em, recuperacao_valida_ate, codigos_recuperacao",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Conta | null) ?? null;
}

function recuperacaoEleva(conta: Conta | null, agora: Date) {
  return stepUpValido(conta?.recuperacao_valida_ate, agora);
}

export async function contarFatores(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("fatores_verificados", { uid: userId });
  if (error) throw new Error("Não foi possível conferir a segunda etapa.");
  return (data as number) ?? 0;
}

export async function mfaEmpresaDoTenant(gatewayTenantId: string | null) {
  if (!gatewayTenantId) return false;
  const { data } = await supabaseAdmin
    .from("tenants")
    .select("mfa_obrigatorio")
    .eq("gateway_tenant_id", gatewayTenantId)
    .maybeSingle();
  return Boolean(data?.mfa_obrigatorio);
}

/** Papel efetivo para MFA: plataforma se super_admin; senão o do vínculo ativo. */
export async function papelParaMfa(
  userId: string,
  superAdmin: boolean,
  gatewayTenantId: string | null,
): Promise<PapelAcesso | null> {
  if (superAdmin) return "plataforma";
  if (!gatewayTenantId) return null;
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("gateway_tenant_id", gatewayTenantId)
    .maybeSingle();
  if (!tenant) return null;
  const { data: vinculo } = await supabaseAdmin
    .from("tenant_users")
    .select("papel_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!vinculo?.papel_id) return null;
  const { data: papel } = await supabaseAdmin
    .from("papeis")
    .select("papel_gateway")
    .eq("id", vinculo.papel_id)
    .maybeSingle();
  return papelAcesso(papel?.papel_gateway ?? null);
}

export async function auditarMfa(entrada: {
  userId: string;
  email?: string | null;
  action: string;
  target?: string;
  detail?: string;
  status?: "success" | "alerta" | "error";
  tenantId?: string | null;
}) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: entrada.tenantId ?? null,
      actor_user_id: entrada.userId,
      actor_email: entrada.email ?? null,
      action: entrada.action,
      target: entrada.target ?? entrada.userId,
      status: entrada.status ?? "success",
      detail: entrada.detail ?? null,
    });
  } catch {
    console.error("[mfa] não foi possível registrar auditoria", entrada.action);
  }
  // Gancho Telegram: quando o gateway expuser o endpoint, chamar aqui nos status alerta.
}

export async function registrarTentativaFalha(userId: string, email: string | null, detalhe: string) {
  const conta = await lerContaSeguranca(userId);
  const agora = new Date();
  const r = registrarFalhaMfa({
    falhas: conta?.mfa_falhas ?? 0,
    falhaEm: conta?.mfa_falha_em ?? null,
    agora,
  });
  const patch = {
    mfa_falhas: r.falhas,
    mfa_falha_em: agora.toISOString(),
    ...(r.bloqueadoAte ? { mfa_bloqueado_ate: r.bloqueadoAte } : {}),
  };
  if (conta) {
    await supabaseAdmin.from("conta_seguranca").update(patch).eq("user_id", userId);
  } else {
    await supabaseAdmin.from("conta_seguranca").insert({ user_id: userId, ...patch });
  }
  await auditarMfa({
    userId,
    email,
    action: r.bloqueadoAte ? "mfa.bloqueado" : "mfa.falhou",
    detail: detalhe,
    status: "alerta",
  });
  if (r.alertar) {
    await auditarMfa({
      userId,
      email,
      action: "mfa.bloqueado",
      detail: "5 falhas seguidas de segunda etapa.",
      status: "alerta",
    });
  }
}

export async function zerarFalhasMfa(userId: string) {
  await supabaseAdmin
    .from("conta_seguranca")
    .update({ mfa_falhas: 0, mfa_falha_em: null, mfa_bloqueado_ate: null })
    .eq("user_id", userId);
}

/**
 * Confere aal para funções de negócio. Funções de cadastro MFA não chamam isto.
 */
export async function exigirAalDaSessao(entrada: {
  userId: string;
  email: string | null;
  claims: Record<string, unknown>;
  superAdmin: boolean;
  gatewayTenantId?: string | null;
}) {
  const conta = await lerContaSeguranca(entrada.userId);
  const agora = new Date();
  if (mfaBloqueado(conta?.mfa_bloqueado_ate, agora)) {
    throw new MfaErro(
      "mfa_bloqueado",
      "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    );
  }
  const fatores = await contarFatores(entrada.userId);
  const papel = await papelParaMfa(
    entrada.userId,
    entrada.superAdmin,
    entrada.gatewayTenantId ?? null,
  );
  const mfaEmpresa = await mfaEmpresaDoTenant(entrada.gatewayTenantId ?? null);
  const emergencia = contaEmergencia(entrada.email, Boolean(conta?.emergencia));
  const decisao = decidirMfa1({
    papel,
    email: entrada.email,
    emergenciaMarcada: Boolean(conta?.emergencia),
    fatores,
    mfaEmpresa,
    prazoAte: conta?.prazo_ate ?? null,
    agora,
    obrigatorioGlobal: mfa1ObrigatorioLigado(),
  });
  const precisa = exigeAal2({
    papel,
    emergencia,
    mfaEmpresa,
    obrigatorioGlobal: mfa1ObrigatorioLigado(),
    fatores,
    bloqueado: decisao.bloqueado,
  });
  if (!precisa) return { fatores, papel, conta };
  let elevada =
    sessaoEhAal2(entrada.claims) || recuperacaoEleva(conta, agora);
  // Fallback: o claim aal às vezes não vem no getClaims; confere a sessão no GoTrue.
  if (!elevada) {
    const sid =
      typeof entrada.claims["session_id"] === "string"
        ? entrada.claims["session_id"]
        : null;
    if (sid) {
      const { data: aalSess } = await supabaseAdmin.rpc("sessao_aal", { sid });
      if (aalSess === "aal2" || aalSess === "aal3") elevada = true;
    }
  }
  if (!elevada) {
    if (fatores === 0) {
      throw new MfaErro(
        "mfa_obrigatorio",
        "Ative a segunda etapa para continuar.",
      );
    }
    throw new MfaErro(
      "mfa_aal",
      "Confirme o código do aplicativo autenticador para continuar.",
    );
  }
  return { fatores, papel, conta };
}

export async function exigirStepUp(entrada: {
  userId: string;
  email: string | null;
  acao: AcaoStepUp;
}) {
  const conta = await lerContaSeguranca(entrada.userId);
  if (!stepUpValido(conta?.step_up_ate, new Date())) {
    throw new MfaErro(
      "mfa_step_up",
      "Confirme o código do aplicativo para esta ação.",
    );
  }
  await auditarMfa({
    userId: entrada.userId,
    email: entrada.email,
    action: "mfa.step_up",
    detail: `Ação: ${entrada.acao}`,
  });
}

export async function gravarStepUp(userId: string) {
  const ate = novoStepUpAte(new Date());
  const { data: conta } = await supabaseAdmin
    .from("conta_seguranca")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (conta) {
    await supabaseAdmin.from("conta_seguranca").update({ step_up_ate: ate }).eq("user_id", userId);
  } else {
    await supabaseAdmin.from("conta_seguranca").insert({ user_id: userId, step_up_ate: ate });
  }
  return ate;
}

export async function estadoMfaCompleto(entrada: {
  userId: string;
  email: string | null;
  superAdmin: boolean;
  gatewayTenantId: string | null;
  claims: Record<string, unknown>;
}) {
  const conta = await lerContaSeguranca(entrada.userId);
  const fatores = await contarFatores(entrada.userId);
  const papel = await papelParaMfa(
    entrada.userId,
    entrada.superAdmin,
    entrada.gatewayTenantId,
  );
  const mfaEmpresa = await mfaEmpresaDoTenant(entrada.gatewayTenantId);
  const decisao = decidirMfa1({
    papel,
    email: entrada.email,
    emergenciaMarcada: Boolean(conta?.emergencia),
    fatores,
    mfaEmpresa,
    prazoAte: conta?.prazo_ate ?? null,
    agora: new Date(),
    obrigatorioGlobal: mfa1ObrigatorioLigado(),
  });
  if (decisao.gravarPrazo) {
    if (conta) {
      await supabaseAdmin
        .from("conta_seguranca")
        .update({ prazo_ate: decisao.gravarPrazo })
        .eq("user_id", entrada.userId);
    } else {
      await supabaseAdmin.from("conta_seguranca").insert({
        user_id: entrada.userId,
        prazo_ate: decisao.gravarPrazo,
      });
    }
  }
  return {
    obrigatorio: decisao.obrigatorio,
    fatores,
    bloqueado: decisao.bloqueado,
    prazo_ate: decisao.prazo_ate,
    exige_aal2: decisao.exigeAal2,
    aal2: sessaoEhAal2(entrada.claims),
    codigos_restantes: conta?.codigos_recuperacao?.length ?? 0,
    step_up_ate: conta?.step_up_ate ?? null,
    mfa_bloqueado_ate: conta?.mfa_bloqueado_ate ?? null,
    mfa_empresa: mfaEmpresa,
    max_fatores: 2,
  };
}
