import { describe, expect, test } from "bun:test";
import {
  EMAIL_CONTA_EMERGENCIA,
  PRAZO_SEGUNDA_ETAPA_MS,
  contaEmergencia,
  decidirSegundaEtapa,
} from "./segunda-etapa";

const agora = new Date("2026-10-28T18:00:00Z");

describe("segunda etapa", () => {
  test("a conta de emergência é reconhecida pelo e-mail ou pela marca", () => {
    expect(contaEmergencia(EMAIL_CONTA_EMERGENCIA, false)).toBe(true);
    expect(contaEmergencia("Outra@Exemplo.com", true)).toBe(true);
    expect(contaEmergencia("marco.santos@ticway.com.br", false)).toBe(false);
  });

  test("emergência sem fator bloqueia na hora, sem gravar prazo", () => {
    const d = decidirSegundaEtapa({
      plataforma: true,
      emergencia: true,
      fatores: 0,
      prazoAte: null,
      agora,
    });
    expect(d.bloqueado).toBe(true);
    expect(d.obrigatorio).toBe(true);
    expect(d.prazo_ate).toBeNull();
    expect(d.gravarPrazo).toBeNull();
  });

  test("emergência com fator entra", () => {
    const d = decidirSegundaEtapa({
      plataforma: true,
      emergencia: true,
      fatores: 1,
      prazoAte: null,
      agora,
    });
    expect(d.bloqueado).toBe(false);
    expect(d.gravarPrazo).toBeNull();
  });

  test("as outras contas de plataforma ganham 7 dias", () => {
    const d = decidirSegundaEtapa({
      plataforma: true,
      emergencia: false,
      fatores: 0,
      prazoAte: null,
      agora,
    });
    expect(d.bloqueado).toBe(false);
    expect(new Date(d.gravarPrazo ?? 0).getTime() - agora.getTime()).toBe(PRAZO_SEGUNDA_ETAPA_MS);
  });

  test("plataforma com prazo vencido fica bloqueada", () => {
    const d = decidirSegundaEtapa({
      plataforma: true,
      emergencia: false,
      fatores: 0,
      prazoAte: new Date(agora.getTime() - 1000).toISOString(),
      agora,
    });
    expect(d.bloqueado).toBe(true);
    expect(d.gravarPrazo).toBeNull();
  });

  test("gestor não é obrigado", () => {
    const d = decidirSegundaEtapa({
      plataforma: false,
      emergencia: false,
      fatores: 0,
      prazoAte: null,
      agora,
    });
    expect(d.obrigatorio).toBe(false);
    expect(d.bloqueado).toBe(false);
  });
});
