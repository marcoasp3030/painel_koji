import { expect, test } from "bun:test";
import { campoDePedidos, pedidosEmUso, telaLiberada } from "./modulos";
import { ADMIN_NAV, TENANT_NAV, filtrarMenuPorTelas } from "../nav";

test("pedidosEmUso e campos de pedidos", () => {
  expect(pedidosEmUso({ em_uso: ["catalogo", "pedidos"] })).toBe(true);
  expect(pedidosEmUso({ em_uso: ["catalogo"] })).toBe(false);
  expect(campoDePedidos("carrinho_expira_h")).toBe(true);
  expect(campoDePedidos("debounce_s")).toBe(false);
});

test("telas liberam Cardápio/Pedidos/Avisos só quando o módulo declara", () => {
  expect(telaLiberada("/ia/cardapio", ["cardapio"])).toBe(true);
  expect(telaLiberada("/ia/cardapio", [])).toBe(false);
  expect(telaLiberada("/ia/conversas", [])).toBe(true);
  expect(telaLiberada("/ia/pedidos", ["pedidos"])).toBe(true);
  expect(telaLiberada("/ia/configuracoes/avisos", ["avisos_de_pedido"])).toBe(true);
});

test("menu da empresa sem pedidos esconde Cardápio, Pedidos e Avisos", () => {
  const base = filtrarMenuPorTelas(
    TENANT_NAV.filter((i) => !i.papeis || i.papeis.includes("gestor")),
    [],
  );
  expect(base.map((i) => i.to)).not.toContain("/ia/cardapio");
  expect(base.map((i) => i.to)).not.toContain("/ia/pedidos");
  expect(base.map((i) => i.to)).not.toContain("/ia/configuracoes/avisos");
  expect(base.map((i) => i.to)).toContain("/ia/conversas");
  expect(base.map((i) => i.to)).toContain("/ia/unidades");
});

test("menu By Koji com as três telas mostra Cardápio, Pedidos e Avisos", () => {
  const itens = filtrarMenuPorTelas(ADMIN_NAV, ["cardapio", "pedidos", "avisos_de_pedido"]);
  expect(itens.some((i) => i.to === "/ia/cardapio")).toBe(true);
  expect(itens.some((i) => i.to === "/ia/pedidos")).toBe(true);
  expect(itens.some((i) => i.to === "/ia/configuracoes/avisos")).toBe(true);
  expect(itens.some((i) => i.to === "/ia/modelos")).toBe(true);
});
