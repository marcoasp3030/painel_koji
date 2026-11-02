import { expect, test } from "bun:test";
import { ipDoCliente } from "./ip-cliente";

const com = (c: Record<string, string>) => new Headers(c);

test("usa o endereço que o proxy acrescentou, não o forjado no início da lista", () => {
  expect(ipDoCliente(com({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }))).toBe("203.0.113.9");
  expect(ipDoCliente(com({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  expect(ipDoCliente(com({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
});

test("sem lista, usa X-Real-IP; valor estranho não vira cabeçalho", () => {
  expect(ipDoCliente(com({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  expect(ipDoCliente(com({ "x-forwarded-for": "evil\tvalue" }))).toBeNull();
  expect(ipDoCliente(com({}))).toBeNull();
});
