import { describe, expect, test } from "bun:test";
import {
  chaveFila,
  classesSeloAlerta,
  conversasNovasNaFila,
  deveLembrar,
  LEMBRETE_INTERVALO_MS,
  LEMBRETE_MAX_POR_CONVERSA,
  mapaDaFila,
  nomeNaFila,
  podeVerAlertaAtendimento,
  rotuloMotivoAtendimento,
  telefoneMascaradoAlerta,
  tituloAbaAguardando,
  urgenciaAlerta,
} from "./atendimento-alerta";

describe("atendimento-alerta (ATD-ALERTA)", () => {
  test("cores por tempo: até 2 dourado, 2–5 laranja, acima de 5 vermelho", () => {
    const agora = Date.parse("2026-11-14T20:00:00-03:00");
    expect(urgenciaAlerta(new Date(agora - 60_000).toISOString(), agora)).toBe("dourado");
    expect(urgenciaAlerta(new Date(agora - 3 * 60_000).toISOString(), agora)).toBe("laranja");
    expect(urgenciaAlerta(new Date(agora - 6 * 60_000).toISOString(), agora)).toBe("vermelho");
    expect(classesSeloAlerta("vermelho")).toMatch(/destructive/);
    expect(classesSeloAlerta("laranja")).toMatch(/orange/);
    expect(classesSeloAlerta("dourado")).toMatch(/gold/);
  });

  test("conversa nova na fila: id+desde que ainda não estava; recarga não repete", () => {
    const a = {
      conversation_id: "c1",
      aguardando_atendente_desde: "2026-11-14T19:00:00-03:00",
      atribuida_a: null,
    };
    const mapa0 = new Map<string, string>();
    expect(conversasNovasNaFila(mapa0, [a])).toHaveLength(1);
    const aposPrimeira = mapaDaFila([a]);
    expect(conversasNovasNaFila(aposPrimeira, [a])).toHaveLength(0);
    const b = {
      conversation_id: "c2",
      aguardando_atendente_desde: "2026-11-14T19:05:00-03:00",
      atribuida_a: null,
    };
    expect(conversasNovasNaFila(aposPrimeira, [a, b]).map((x) => x.conversation_id)).toEqual(["c2"]);
    // Mesmo id com novo desde = nova entrada na fila.
    const a2 = { ...a, aguardando_atendente_desde: "2026-11-14T19:10:00-03:00" };
    expect(conversasNovasNaFila(aposPrimeira, [a2])).toHaveLength(1);
  });

  test("quem já tem atendente não gera alerta de nova", () => {
    const com = {
      conversation_id: "c1",
      aguardando_atendente_desde: "2026-11-14T19:00:00-03:00",
      atribuida_a: "ana@koji.com",
    };
    expect(conversasNovasNaFila(new Map(), [com])).toHaveLength(0);
  });

  test("lembrete: para ao assumir; máx. 5; intervalo 2 min", () => {
    expect(LEMBRETE_INTERVALO_MS).toBe(120_000);
    expect(LEMBRETE_MAX_POR_CONVERSA).toBe(5);
    const agora = 1_000_000;
    expect(
      deveLembrar({ atribuida_a: "x", toques: 0, ultimoToqueEm: agora - 200_000, agora }),
    ).toBe(false);
    expect(
      deveLembrar({ atribuida_a: null, toques: 5, ultimoToqueEm: agora - 200_000, agora }),
    ).toBe(false);
    expect(
      deveLembrar({ atribuida_a: null, toques: 2, ultimoToqueEm: agora - 200_000, agora }),
    ).toBe(true);
    expect(
      deveLembrar({ atribuida_a: null, toques: 2, ultimoToqueEm: agora - 30_000, agora }),
    ).toBe(false);
  });

  test("nome ou telefone mascarado ****1234", () => {
    expect(nomeNaFila({ nome_exibicao: "Maria", telefone: "5511999991234" })).toBe("Maria");
    expect(telefoneMascaradoAlerta("5511999991234")).toBe("****1234");
    expect(nomeNaFila({ nome: null, telefone: "5511999991234" })).toBe("****1234");
  });

  test("motivo e título da aba", () => {
    expect(rotuloMotivoAtendimento("pediu_humano")).toMatch(/atendente/);
    expect(tituloAbaAguardando(0)).toBeNull();
    expect(tituloAbaAguardando(3)).toBe("(3) Aguardando humano");
  });

  test("papel: atendente/supervisor/gestor/plataforma veem; sem papel não", () => {
    expect(podeVerAlertaAtendimento("funcionario")).toBe(true);
    expect(podeVerAlertaAtendimento("supervisor")).toBe(true);
    expect(podeVerAlertaAtendimento("gestor")).toBe(true);
    expect(podeVerAlertaAtendimento("plataforma")).toBe(true);
    expect(podeVerAlertaAtendimento(null)).toBe(false);
    expect(podeVerAlertaAtendimento("outro")).toBe(false);
  });

  test("chave da fila combina id e desde", () => {
    expect(chaveFila({ conversation_id: "a", aguardando_atendente_desde: "t" })).toBe("a|t");
  });
});
