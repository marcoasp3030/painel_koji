import { expect, test } from "bun:test";
import { filtrarEmpresas } from "./empresas";
import type { EmpresaGateway, EmpresaPainel } from "./tipos";

const empresa = (d: Partial<EmpresaGateway>) =>
  ({ id: "a", nome: "A", status: "ativo", tenant_teste: false, ...d }) as EmpresaGateway;
const lista = [
  empresa({ id: "koji", nome: "By Koji" }),
  empresa({ id: "demo", nome: "Demonstração", tenant_teste: true }),
  empresa({ id: "fora", nome: "Fora", status: "suspenso" }),
];
const painel = [{ id: "1", name: "Cliente Sul", gateway_tenant_id: "koji" }] as EmpresaPainel[];
const ids = (filtros: Parameters<typeof filtrarEmpresas>[2]) =>
  filtrarEmpresas(lista, painel, filtros).map((e) => e.id);

test("filtros da lista de empresas", () => {
  expect(ids({ busca: "", filtro: "ativas" })).toEqual(["koji", "demo"]);
  expect(ids({ busca: "", filtro: "suspensas" })).toEqual(["fora"]);
  expect(ids({ busca: "", filtro: "teste" })).toEqual(["demo"]);
  expect(ids({ busca: "", filtro: "sem_vinculo" })).toEqual(["demo", "fora"]);
});

test("busca olha nome, id e cliente ligado, sem acento", () => {
  expect(ids({ busca: "demonstracao", filtro: "" })).toEqual(["demo"]);
  expect(ids({ busca: "FORA", filtro: "" })).toEqual(["fora"]);
  expect(ids({ busca: "cliente sul", filtro: "" })).toEqual(["koji"]);
});
