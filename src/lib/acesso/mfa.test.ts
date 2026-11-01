import { describe, expect, test } from "bun:test";
import {
  decidirMfa1,
  exigeAal2,
  lerAal,
  mfaBloqueado,
  papelExigeMfa,
  registrarFalhaMfa,
  stepUpValido,
  FALHAS_PARA_BLOQUEIO,
} from "./mfa";

const agora = new Date("2026-10-30T18:00:00Z");

describe("MFA1 regras", () => {
  test("aal do JWT", () => {
    expect(lerAal({ aal: "aal2" })).toBe("aal2");
    expect(lerAal({})).toBe("aal1");
  });

  test("antes do cutover só plataforma é obrigada", () => {
    expect(
      papelExigeMfa({
        papel: "plataforma",
        emergencia: false,
        mfaEmpresa: false,
        obrigatorioGlobal: false,
      }),
    ).toBe(true);
    expect(
      papelExigeMfa({
        papel: "gestor",
        emergencia: false,
        mfaEmpresa: false,
        obrigatorioGlobal: false,
      }),
    ).toBe(false);
  });

  test("com cutover, gestor obrigatório e supervisor pela empresa", () => {
    expect(
      papelExigeMfa({
        papel: "gestor",
        emergencia: false,
        mfaEmpresa: false,
        obrigatorioGlobal: true,
      }),
    ).toBe(true);
    expect(
      papelExigeMfa({
        papel: "supervisor",
        emergencia: false,
        mfaEmpresa: true,
        obrigatorioGlobal: true,
      }),
    ).toBe(true);
    expect(
      papelExigeMfa({
        papel: "funcionario",
        emergencia: false,
        mfaEmpresa: false,
        obrigatorioGlobal: true,
      }),
    ).toBe(false);
  });

  test("com fator exige aal2; sem fator nunca (aal2 seria impossível)", () => {
    expect(
      exigeAal2({
        papel: "plataforma",
        emergencia: false,
        mfaEmpresa: false,
        obrigatorioGlobal: false,
        fatores: 1,
        bloqueado: false,
      }),
    ).toBe(true);
    expect(
      exigeAal2({
        papel: "plataforma",
        emergencia: true,
        mfaEmpresa: false,
        obrigatorioGlobal: false,
        fatores: 0,
        bloqueado: true,
      }),
    ).toBe(false);
  });

  test("decidirMfa1 cutover: gestor sem fator bloqueado na UI; aal2 só com fator", () => {
    const d = decidirMfa1({
      papel: "gestor",
      email: "g@x.com",
      emergenciaMarcada: false,
      fatores: 0,
      mfaEmpresa: false,
      prazoAte: null,
      agora,
      obrigatorioGlobal: true,
    });
    expect(d.obrigatorio).toBe(true);
    expect(d.bloqueado).toBe(true);
    expect(d.exigeAal2).toBe(false);
  });

  test("step-up e bloqueio por falhas", () => {
    expect(stepUpValido(new Date(agora.getTime() + 60_000).toISOString(), agora)).toBe(true);
    expect(stepUpValido(new Date(agora.getTime() - 1000).toISOString(), agora)).toBe(false);
    expect(mfaBloqueado(new Date(agora.getTime() + 60_000).toISOString(), agora)).toBe(true);
    let falhas = 0;
    let falhaEm: string | null = null;
    let alertar = false;
    for (let i = 0; i < FALHAS_PARA_BLOQUEIO; i++) {
      const r = registrarFalhaMfa({ falhas, falhaEm, agora });
      falhas = r.falhas;
      falhaEm = agora.toISOString();
      alertar = r.alertar;
      if (i < FALHAS_PARA_BLOQUEIO - 1) expect(r.bloqueadoAte).toBeNull();
      else expect(r.bloqueadoAte).not.toBeNull();
    }
    expect(alertar).toBe(true);
  });
});
