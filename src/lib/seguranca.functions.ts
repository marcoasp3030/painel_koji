/**
 * MFA1 — segunda etapa (TOTP + recuperação).
 * Obrigatoriedade ampla só com MFA1_OBRIGATORIO=1 (depois do §9 da ESPEC).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QTD_CODIGOS_RECUPERACAO } from "@/lib/acesso/codigos-recuperacao";
import {
  RECUPERACAO_SESSAO_MS,
  MAX_FATORES_TOTP,
  mfa1ObrigatorioLigado,
} from "@/lib/acesso/mfa";
import {
  auditarMfa,
  contarFatores,
  estadoMfaCompleto,
  exigirAalDaSessao,
  exigirStepUp,
  gravarStepUp,
  hashCodigoMfa,
  hashesIguaisMfa,
  lerContaSeguranca,
  MfaErro,
  mfaEmpresaDoTenant,
  registrarTentativaFalha,
  zerarFalhasMfa,
} from "@/lib/acesso/mfa.server";
import { contaEmergencia } from "@/lib/acesso/segunda-etapa";

export type EstadoSeguranca = {
  obrigatorio: boolean;
  fatores: number;
  bloqueado: boolean;
  prazo_ate: string | null;
  exige_aal2?: boolean;
  aal2?: boolean;
  codigos_restantes?: number;
  step_up_ate?: string | null;
  mfa_bloqueado_ate?: string | null;
  mfa_empresa?: boolean;
  max_fatores?: number;
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
      const conta = await lerContaSeguranca(sessao.perfil.userId);
      const emergencia = contaEmergencia(email, Boolean(conta?.emergencia));
      if (emergencia) await registrarAlertaLogin(supabaseAdmin, sessao.perfil.userId, email);

      let gatewayTenantId: string | null = null;
      try {
        const t = await sessao.tenant(null);
        gatewayTenantId = t.id;
      } catch {
        gatewayTenantId = null;
      }

      const estado = await estadoMfaCompleto({
        userId: sessao.perfil.userId,
        email,
        superAdmin: sessao.perfil.superAdmin,
        gatewayTenantId,
        claims: context.claims as Record<string, unknown>,
      });

      // Sem cutover e sem obrigação de papel: gestor/supervisor/funcionário veem vazio
      // (exceto se já tiverem fator — aí exige_aal2 aparece).
      if (!estado.obrigatorio && estado.fatores === 0 && !mfa1ObrigatorioLigado()) {
        return { ...vazio, exige_aal2: false, aal2: estado.aal2 };
      }
      return estado;
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
    await auditarMfa({
      userId,
      email,
      action: "Login da conta de emergência",
      target: email ?? userId,
      detail: "Conta de emergência entrou no painel.",
      status: "alerta",
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

const codigosSchema = z.object({
  codigos: z.array(z.string().trim().min(8).max(32)).length(QTD_CODIGOS_RECUPERACAO),
});

/** Guarda só o hash. O texto fica na tela, uma vez. */
export const guardarCodigosRecuperacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codigosSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hashes = data.codigos.map(hashCodigoMfa);
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
    await auditarMfa({
      userId: context.userId,
      action: "mfa.ativado",
      detail: `${QTD_CODIGOS_RECUPERACAO} códigos de recuperação guardados.`,
    });
    // Derruba outras sessões após ativar.
    const sessionId =
      typeof context.claims?.["session_id"] === "string"
        ? (context.claims["session_id"] as string)
        : null;
    if (sessionId) {
      await supabaseAdmin.rpc("derrubar_outras_sessoes", {
        uid: context.userId,
        manter: sessionId,
      });
    }
    return { ok: true as const };
  });

/**
 * Código de recuperação no login: consome 1 hash e eleva a sessão no painel
 * (recuperacao_valida_ate). Não apaga os fatores TOTP.
 */
export const usarCodigoRecuperacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ codigo: z.string().trim().min(8).max(32) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email =
      typeof context.claims?.["email"] === "string" ? (context.claims["email"] as string) : null;
    const conta = await lerContaSeguranca(context.userId);
    const agora = new Date();
    if (conta?.mfa_bloqueado_ate && new Date(conta.mfa_bloqueado_ate).getTime() > agora.getTime()) {
      throw new MfaErro("mfa_bloqueado", "Muitas tentativas. Aguarde alguns minutos.");
    }
    const hash = hashCodigoMfa(data.codigo);
    const guardados = conta?.codigos_recuperacao ?? [];
    if (!guardados.some((item) => hashesIguaisMfa(item, hash))) {
      await registrarTentativaFalha(context.userId, email, "Código de recuperação inválido.");
      throw new Error("Código de recuperação não conferiu.");
    }
    const restante = guardados.filter((item) => !hashesIguaisMfa(item, hash));
    const ate = new Date(agora.getTime() + RECUPERACAO_SESSAO_MS).toISOString();
    const { error } = await supabaseAdmin
      .from("conta_seguranca")
      .update({
        codigos_recuperacao: restante,
        recuperacao_valida_ate: ate,
        mfa_falhas: 0,
        mfa_falha_em: null,
        mfa_bloqueado_ate: null,
      })
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível usar o código de recuperação.");
    await auditarMfa({
      userId: context.userId,
      email,
      action: "mfa.recuperacao_usada",
      detail: `Restam ${restante.length} códigos. Sessão elevada no painel até ${ate}.`,
      status: "alerta",
    });
    return { ok: true as const, codigos_restantes: restante.length, valida_ate: ate };
  });

/** Regenera 10 códigos. Exige aal2 (TOTP) ou recuperação válida. */
export const regenerarCodigosRecuperacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codigosSchema.parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const sessao = await g.sessaoGateway(context);
    await exigirAalDaSessao({
      userId: context.userId,
      email: sessao.perfil.email,
      claims: context.claims as Record<string, unknown>,
      superAdmin: sessao.perfil.superAdmin,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hashes = data.codigos.map(hashCodigoMfa);
    const { error } = await supabaseAdmin
      .from("conta_seguranca")
      .update({ codigos_recuperacao: hashes })
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível regenerar os códigos.");
    await auditarMfa({
      userId: context.userId,
      email: sessao.perfil.email,
      action: "mfa.recuperacao_regenerada",
      detail: "Novos 10 códigos gerados; os anteriores foram invalidados.",
      status: "alerta",
    });
    return { ok: true as const };
  });

/** Confirma TOTP já verificado no cliente e grava step-up de 15 min. */
export const confirmarStepUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!sessaoEhAal2Claims(context.claims as Record<string, unknown>)) {
      // Step-up também aceita recuperação elevada.
      const conta = await lerContaSeguranca(context.userId);
      const ok =
        conta?.recuperacao_valida_ate &&
        new Date(conta.recuperacao_valida_ate).getTime() > Date.now();
      if (!ok) throw new MfaErro("mfa_aal", "Confirme o código do aplicativo.");
    }
    const ate = await gravarStepUp(context.userId);
    await zerarFalhasMfa(context.userId);
    await auditarMfa({
      userId: context.userId,
      action: "mfa.step_up",
      detail: `Válido até ${ate}`,
    });
    return { ok: true as const, step_up_ate: ate };
  });

function sessaoEhAal2Claims(claims: Record<string, unknown>) {
  const aal = claims["aal"];
  return aal === "aal2" || aal === "aal3";
}

type AdminFatores = {
  _listFactors(params: { userId: string }): Promise<{
    data: { factors: { id: string; factor_type?: string; status?: string }[] } | null;
    error: { message: string } | null;
  }>;
  _deleteFactor(params: {
    userId: string;
    id: string;
  }): Promise<{ error: { message: string } | null }>;
};

/** Reset de fator por outra conta (plataforma; gestor só da empresa). */
export const resetarFatorMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        motivo: z.string().trim().min(3).max(500),
        empresa: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { peloMenos } = await import("@/lib/acesso/papeis");
    const sessao = await g.sessaoGateway(context);
    await exigirAalDaSessao({
      userId: context.userId,
      email: sessao.perfil.email,
      claims: context.claims as Record<string, unknown>,
      superAdmin: sessao.perfil.superAdmin,
      gatewayTenantId: data.empresa ?? null,
    });
    await exigirStepUp({
      userId: context.userId,
      email: sessao.perfil.email,
      acao: "usuarios.reset_mfa",
    });
    const t = await sessao.tenant(data.empresa ?? null);
    if (!peloMenos(t.papel, "gestor")) {
      throw new Error("Seu acesso não inclui resetar a segunda etapa.");
    }
    if (data.user_id === context.userId) {
      throw new Error("Não é possível resetar o próprio fator por este caminho.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin.auth.admin as unknown as AdminFatores;
    const lista = await admin._listFactors({ userId: data.user_id });
    if (lista.error) throw new Error("Não foi possível listar os fatores.");
    for (const fator of lista.data?.factors ?? []) {
      const apagou = await admin._deleteFactor({ userId: data.user_id, id: fator.id });
      if (apagou.error) throw new Error("Não foi possível remover o fator.");
    }
    await supabaseAdmin.from("conta_seguranca").upsert({
      user_id: data.user_id,
      codigos_recuperacao: [],
      recuperacao_valida_ate: null,
      step_up_ate: null,
      mfa_falhas: 0,
      mfa_falha_em: null,
      mfa_bloqueado_ate: null,
    });
    await supabaseAdmin.rpc("derrubar_sessoes", { uid: data.user_id });
    await auditarMfa({
      userId: context.userId,
      email: sessao.perfil.email,
      action: "mfa.reset",
      target: data.user_id,
      detail: data.motivo,
      status: "alerta",
      tenantId: null,
    });
    return { ok: true as const };
  });

/** Liga/desliga obrigação de MFA para supervisor/funcionário na empresa. */
export const definirMfaEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ empresa: z.string().min(1).max(40), obrigatorio: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const { peloMenos } = await import("@/lib/acesso/papeis");
    const sessao = await g.sessaoGateway(context);
    await exigirAalDaSessao({
      userId: context.userId,
      email: sessao.perfil.email,
      claims: context.claims as Record<string, unknown>,
      superAdmin: sessao.perfil.superAdmin,
      gatewayTenantId: data.empresa,
    });
    await exigirStepUp({
      userId: context.userId,
      email: sessao.perfil.email,
      acao: "empresa.mfa_obrigatorio",
    });
    const t = await sessao.tenant(data.empresa);
    if (!peloMenos(t.papel, "gestor")) {
      throw new Error("Seu acesso não inclui esta configuração.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ mfa_obrigatorio: data.obrigatorio })
      .eq("gateway_tenant_id", t.id);
    if (error) throw new Error("Não foi possível salvar.");
    await auditarMfa({
      userId: context.userId,
      email: sessao.perfil.email,
      action: "mfa.empresa",
      detail: data.obrigatorio
        ? "Segunda etapa obrigatória para supervisor e funcionário."
        : "Segunda etapa opcional para supervisor e funcionário.",
      status: "success",
    });
    return { ok: true as const, mfa_obrigatorio: data.obrigatorio };
  });

export const lerMfaEmpresa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const g = await import("./gateway/painel.server");
    const sessao = await g.sessaoGateway(context);
    await exigirAalDaSessao({
      userId: context.userId,
      email: sessao.perfil.email,
      claims: context.claims as Record<string, unknown>,
      superAdmin: sessao.perfil.superAdmin,
      gatewayTenantId: data.empresa,
    });
    const t = await sessao.tenant(data.empresa);
    return { mfa_obrigatorio: await mfaEmpresaDoTenant(t.id), max_fatores: MAX_FATORES_TOTP };
  });

export async function assertAalNoContexto(
  context: { userId: string; claims: Record<string, unknown> },
  gatewayTenantId?: string | null,
) {
  const g = await import("./gateway/painel.server");
  const sessao = await g.sessaoGateway(context);
  await exigirAalDaSessao({
    userId: context.userId,
    email: sessao.perfil.email,
    claims: context.claims,
    superAdmin: sessao.perfil.superAdmin,
    gatewayTenantId: gatewayTenantId ?? null,
  });
  return sessao;
}

export { contarFatores, MfaErro };
