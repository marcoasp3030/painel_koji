import { describe, expect, test } from "bun:test";
import {
  AVISO_LINK_CONVITE,
  VALIDADE_CONVITE_MS,
  conviteAberto,
  convitePorEmail,
  expiraConvite,
  linkDoConvite,
} from "./convite";

describe("convite sem SMTP", () => {
  test("o aviso é o texto combinado", () => {
    expect(AVISO_LINK_CONVITE).toBe("Envie este link só para a pessoa convidada");
  });

  test("sem host de e-mail o convite não sai por SMTP", () => {
    expect(convitePorEmail(undefined)).toBe(false);
    expect(convitePorEmail("  ")).toBe(false);
    expect(convitePorEmail("smtp.exemplo.com")).toBe(true);
  });

  test("o link vale 24 horas e o token não vai na query", () => {
    const agora = new Date("2026-10-28T15:00:00Z");
    const expira = new Date(expiraConvite(agora)).getTime() - agora.getTime();
    expect(expira).toBe(VALIDADE_CONVITE_MS);
    const link = linkDoConvite("https://painel.luxbrain.com.br/", "abc");
    expect(link).toBe("https://painel.luxbrain.com.br/#convite=abc");
    expect(link).not.toContain("?convite=");
  });

  test("uso único: usado, revogado ou vencido não abre", () => {
    const agora = new Date("2026-10-28T15:00:00Z");
    const base = {
      usado_em: null,
      revogado_em: null,
      expira_em: new Date(agora.getTime() + 60_000).toISOString(),
    };
    expect(conviteAberto(base, agora)).toBe(true);
    expect(conviteAberto({ ...base, usado_em: agora.toISOString() }, agora)).toBe(false);
    expect(conviteAberto({ ...base, revogado_em: agora.toISOString() }, agora)).toBe(false);
    expect(
      conviteAberto({ ...base, expira_em: new Date(agora.getTime() - 1).toISOString() }, agora),
    ).toBe(false);
  });
});
