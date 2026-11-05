import { expect, test } from "bun:test";
import { MODULOS_PAINEL, ehModuloPainel, gruposModulosPainel } from "./modulos";
import { ADMIN_NAV, TENANT_NAV, filtrarMenuPorBloqueio, moduloBloqueadoNoCaminho } from "../nav";

test("todo item do menu da empresa é um módulo do catálogo, e todo módulo tem item", () => {
  const doMenu = TENANT_NAV.map((i) => i.modulo);
  expect(doMenu.every((m) => m !== undefined && ehModuloPainel(m))).toBe(true);
  for (const m of MODULOS_PAINEL) expect(doMenu).toContain(m.id);
  expect(gruposModulosPainel().flatMap((g) => g.itens)).toHaveLength(MODULOS_PAINEL.length);
  expect(ehModuloPainel("inventado")).toBe(false);
});

test("bloqueado some do menu; sem bloqueio, nada muda", () => {
  expect(filtrarMenuPorBloqueio(TENANT_NAV, [])).toEqual(TENANT_NAV);
  expect(filtrarMenuPorBloqueio(TENANT_NAV, null)).toEqual(TENANT_NAV);
  const itens = filtrarMenuPorBloqueio(TENANT_NAV, ["pedidos", "webhooks"]).map((i) => i.to);
  expect(itens).not.toContain("/ia/pedidos");
  expect(itens).not.toContain("/ia/webhooks-saida");
  expect(itens).toContain("/ia/conversas");
  // Itens só da plataforma (Clientes, Modelos, Chaves de API) não são módulos de empresa.
  const admin = filtrarMenuPorBloqueio(ADMIN_NAV, ["pedidos"]).map((i) => i.to);
  expect(admin).toContain("/admin");
  expect(admin).toContain("/ia/modelos");
});

test("link direto para tela bloqueada, inclusive subpágina, é barrado", () => {
  expect(moduloBloqueadoNoCaminho(TENANT_NAV, "/ia/agentes/abc", ["agentes"])?.label).toBe(
    "Agentes",
  );
  expect(moduloBloqueadoNoCaminho(TENANT_NAV, "/ia/pedidos", ["pedidos"])?.modulo).toBe("pedidos");
  expect(moduloBloqueadoNoCaminho(TENANT_NAV, "/ia/pedidos", ["cardapio"])).toBeNull();
  expect(
    moduloBloqueadoNoCaminho(TENANT_NAV, "/ia/configuracoes/avisos", ["aparencia"]),
  ).toBeNull();
  expect(moduloBloqueadoNoCaminho(TENANT_NAV, "/equipe", ["usuarios"])?.modulo).toBe("usuarios");
  expect(moduloBloqueadoNoCaminho(TENANT_NAV, "/ia/pedidos", [])).toBeNull();
});
