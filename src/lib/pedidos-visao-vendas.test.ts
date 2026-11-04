import { describe, expect, test } from "bun:test";
import { filtrarMenu, TENANT_NAV, ADMIN_NAV } from "./nav";
import {
  deveMostrarAbaUnidades,
  diasNoPeriodo,
  erroPeriodo,
  matrizCalorHorarios,
  maximoCalor,
  ordenarProdutos,
  origemDaOpcao,
  periodoDoAtalho,
  sentidoVariacao,
  temVendaNoPeriodo,
  textoVariacao,
  telefoneParaBuscaConversa,
  ORIGEM_COM_TESTE,
  ORIGEM_SO_REAL,
} from "./pedidos-visao-vendas";

describe("pedidos-visao-vendas", () => {
  test("cartões: variação positiva, negativa e sem seta quando null", () => {
    expect(sentidoVariacao(12.5)).toBe("alta");
    expect(sentidoVariacao(-3)).toBe("baixa");
    expect(sentidoVariacao(null)).toBe("neutra");
    expect(sentidoVariacao(0)).toBe("neutra");
    expect(textoVariacao(12.5)).toBe("+12,5%");
    expect(textoVariacao(null)).toBeNull();
  });

  test("período: atalhos e limite de 366 dias", () => {
    expect(periodoDoAtalho("hoje", "2026-11-04")).toEqual({ de: "2026-11-04", ate: "2026-11-04" });
    expect(periodoDoAtalho("7d", "2026-11-04")).toEqual({ de: "2026-10-29", ate: "2026-11-04" });
    expect(periodoDoAtalho("30d", "2026-11-04")).toEqual({ de: "2026-10-06", ate: "2026-11-04" });
    expect(periodoDoAtalho("mes", "2026-11-04")).toEqual({ de: "2026-11-01", ate: "2026-11-04" });
    expect(periodoDoAtalho("mes_passado", "2026-11-04")).toEqual({
      de: "2026-10-01",
      ate: "2026-10-31",
    });
    expect(periodoDoAtalho("livre", "2026-11-04")).toBeNull();
    expect(diasNoPeriodo("2026-01-01", "2026-12-31")).toBe(365);
    expect(erroPeriodo("2026-01-02", "2026-01-01")).toMatch(/anterior/);
    expect(erroPeriodo("2025-01-01", "2026-12-31")).toMatch(/366/);
    expect(erroPeriodo("2026-10-01", "2026-10-31")).toBeNull();
  });

  test("origem: desligado = real; ligado = real,piloto,teste", () => {
    expect(origemDaOpcao(false)).toBe(ORIGEM_SO_REAL);
    expect(origemDaOpcao(true)).toBe(ORIGEM_COM_TESTE);
  });

  test("estado vazio quando não há venda; unidades só com mais de uma", () => {
    expect(temVendaNoPeriodo({ pedidos: 0 })).toBe(false);
    expect(temVendaNoPeriodo({ pedidos: 2 })).toBe(true);
    expect(deveMostrarAbaUnidades([{ unidade: "a" }])).toBe(false);
    expect(deveMostrarAbaUnidades([{ unidade: "a" }, { unidade: "b" }])).toBe(true);
  });

  test("gráficos: série vazia e calor com domingo = 0", () => {
    const m = matrizCalorHorarios([]);
    expect(m).toHaveLength(7);
    expect(m[0]).toHaveLength(24);
    expect(maximoCalor(m)).toBe(0);
    const com = matrizCalorHorarios([{ dia_semana: 0, hora: 12, pedidos: 4, faturamento: 10 }]);
    expect(com[0]![12]).toBe(4);
    expect(maximoCalor(com)).toBe(4);
  });

  test("produtos: ordenação por quantidade ou faturamento", () => {
    const itens = [
      { nome: "B", quantidade: 2, faturamento: 90 },
      { nome: "A", quantidade: 5, faturamento: 40 },
    ];
    expect(ordenarProdutos(itens, "quantidade").map((i) => i.nome)).toEqual(["A", "B"]);
    expect(ordenarProdutos(itens, "faturamento").map((i) => i.nome)).toEqual(["B", "A"]);
  });

  test("telefone abre conversa pela busca com dígitos", () => {
    expect(telefoneParaBuscaConversa("+5511900000081")).toBe("5511900000081");
    expect(telefoneParaBuscaConversa(null)).toBeNull();
  });

  test("menu Visão de vendas: gestor e plataforma veem; supervisor e funcionário não", () => {
    const to = "/ia/visao-vendas";
    expect(filtrarMenu(TENANT_NAV, "gestor").some((i) => i.to === to)).toBe(true);
    expect(filtrarMenu(TENANT_NAV, "supervisor").some((i) => i.to === to)).toBe(false);
    expect(filtrarMenu(TENANT_NAV, "funcionario").some((i) => i.to === to)).toBe(false);
    expect(filtrarMenu(ADMIN_NAV, "plataforma").some((i) => i.to === to)).toBe(true);
  });
});
