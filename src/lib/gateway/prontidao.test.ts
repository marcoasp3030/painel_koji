// Executar: bun test src/lib/gateway
import { describe, expect, test } from "bun:test";
import { acaoPermitida, prontidao, resumoProntidao } from "./prontidao";
import type { AgenteDetalhe, CanalGateway } from "./tipos";

const base = {
  id: "ag_1",
  tenant_id: "bykoji",
  modelo_id: "atendente_delivery",
  modelo_versao: 1,
  nome: "Atendimento",
  status: "ativo",
  provedor: "mock",
  skyone_estrategia: "por_modelo",
  skyone_webhook_url: null,
  skyone_auth_tipo: "nenhuma",
  skyone_auth_configurado: false,
  skyone_auth_usuario_configurado: false,
  timeout_s: 90,
  instrucoes_agente: "",
  debounce_s: null,
  max_wait_s: null,
  pause_minutes: null,
  slow_notice_s: null,
  aviso_demora: null,
  fallback: null,
  alerta_telefone: null,
  send_mode: null,
  agente_mode: null,
  modo_piloto: null,
  contatos_permitidos: null,
  configuracao_efetiva: { agente_mode: "mock", send_mode: "dry" },
} satisfies AgenteDetalhe;

const canal = (ativo: boolean, agente_id = "ag_1"): CanalGateway => ({
  id: "can_1",
  tenant_id: "bykoji",
  tipo: "api",
  nome: "Teste",
  agente_id,
  publico: "clientes",
  ativo,
});

const estados = (itens: ReturnType<typeof prontidao>) =>
  Object.fromEntries(itens.map((i) => [i.chave, [i.estado, i.acao ?? null]]));

describe("checklist de prontidão", () => {
  test("agente novo em simulação, sem canal e sem Skyone", () => {
    const itens = prontidao({ ...base, status: "rascunho" }, []);
    expect(estados(itens)).toEqual({
      modelo: ["ok", null],
      situacao: ["pendente", "ativar"],
      canal: ["pendente", "criar_canal"],
      skyone: ["pendente", "configurar_ia"],
      respostas: ["pendente", "ativar_ia"],
      envio: ["info", null],
    });
    expect(resumoProntidao(itens)).toEqual({ prontos: 1, total: 5 });
  });

  test("agente pronto com IA real", () => {
    const pronto: AgenteDetalhe = {
      ...base,
      provedor: "skyone",
      skyone_webhook_url: "https://x.example/f",
      skyone_auth_tipo: "basic",
      skyone_auth_configurado: true,
      skyone_auth_usuario_configurado: true,
      agente_mode: "live",
      configuracao_efetiva: { agente_mode: "live", send_mode: "dry" },
    };
    const itens = prontidao(pronto, [canal(true)], {
      estado: "fechado",
      falhas: 0,
      aberto_ate: null,
      ultimo_alerta: null,
    });
    expect(resumoProntidao(itens)).toEqual({ prontos: 5, total: 5 });
    expect(itens.find((i) => i.chave === "envio")!.detalhe).toContain("ainda não saem");
  });

  test("canal desativado, canal de outro agente, senha incompleta e falhas", () => {
    const itens = prontidao(
      {
        ...base,
        provedor: "skyone",
        skyone_webhook_url: "https://x.example/f",
        skyone_auth_tipo: "basic",
        skyone_auth_configurado: true,
      },
      [canal(false), canal(true, "ag_outro")],
      { estado: "aberto", falhas: 3, aberto_ate: "2026-10-09T17:32:00Z", ultimo_alerta: null },
    );
    const e = estados(itens);
    expect(e["canal"]).toEqual(["pendente", "ver_canais"]);
    expect(e["skyone"]).toEqual(["pendente", "configurar_ia"]);
    expect(itens.find((i) => i.chave === "skyone")!.detalhe).toContain("usuário ou a senha");
    expect(itens.find((i) => i.chave === "falhas")!.detalhe).toContain("Nova tentativa");
  });
});

describe("quem vê o botão de cada pendência", () => {
  test("plataforma resolve tudo", () => {
    for (const a of [
      "ativar",
      "criar_canal",
      "ver_canais",
      "configurar_ia",
      "ativar_ia",
    ] as const) {
      expect(acaoPermitida(a, "plataforma", "rascunho")).toBe(true);
    }
  });

  test("admin da empresa: ativa pausado, vê canais; nada de IA, canal novo ou rascunho", () => {
    expect(acaoPermitida("ativar", "admin", "pausado")).toBe(true);
    expect(acaoPermitida("ativar", "admin", "rascunho")).toBe(false);
    expect(acaoPermitida("ver_canais", "admin", "ativo")).toBe(true);
    for (const a of ["criar_canal", "configurar_ia", "ativar_ia"] as const) {
      expect(acaoPermitida(a, "admin", "ativo")).toBe(false);
    }
  });

  test("membro só vê canais", () => {
    expect(acaoPermitida("ver_canais", "membro", "ativo")).toBe(true);
    for (const a of ["ativar", "criar_canal", "configurar_ia", "ativar_ia"] as const) {
      expect(acaoPermitida(a, "membro", "pausado")).toBe(false);
    }
  });
});
