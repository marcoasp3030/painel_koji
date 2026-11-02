import { expect, test } from "bun:test";
import { confirmaExclusao, filtrarClientes, type ClienteLinha } from "./clientes";

const cliente = (d: Partial<ClienteLinha>) =>
  ({
    id: "1",
    name: "Zé Lanches",
    slug: "ze",
    contact_name: null,
    contact_email: null,
    status: "active",
    userCount: 0,
    activeIntegrations: 0,
    ...d,
  }) as ClienteLinha;
const lista = [
  cliente({ id: "1" }),
  cliente({ id: "2", name: "Ana Café", slug: "ana", status: "suspended", contact_email: "x@y.z" }),
  cliente({ id: "3", name: "Bar", slug: "bar", gateway_tenant_id: "bar_gw" }),
];
const ids = (f: Partial<Parameters<typeof filtrarClientes>[1]>) =>
  filtrarClientes(lista, { busca: "", status: "", ordem: "recentes", ...f }).map((c) => c.id);

test("mantém a ordem do servidor e ordena por nome quando pedido", () => {
  expect(ids({})).toEqual(["1", "2", "3"]);
  expect(ids({ ordem: "nome" })).toEqual(["2", "3", "1"]);
  expect(lista[0]!.id).toBe("1");
});

test("busca sem acento em nome, e-mail e empresa do gateway; filtra por situação", () => {
  expect(ids({ busca: "ze" })).toEqual(["1"]);
  expect(ids({ busca: "X@Y" })).toEqual(["2"]);
  expect(ids({ busca: "bar_gw" })).toEqual(["3"]);
  expect(ids({ status: "suspended" })).toEqual(["2"]);
});

test("excluir exige o nome exato", () => {
  expect(confirmaExclusao("Demo Local", "Demo Local")).toBe(true);
  expect(confirmaExclusao(" Demo Local ", "Demo Local")).toBe(true);
  expect(confirmaExclusao("demo local", "Demo Local")).toBe(false);
  expect(confirmaExclusao("", "")).toBe(false);
});
