import { describe, expect, test } from "bun:test";
import {
  buscaRestrita,
  cabecalhoUnidades,
  idConversa,
  papeisConcediveis,
  podeConceder,
  telefoneParaPapel,
} from "./papeis";

describe("USUARIOS1", () => {
  test("cabeçalho de unidades", () => {
    expect(cabecalhoUnidades("gestor", [])).toBe("*");
    expect(cabecalhoUnidades("plataforma", ["centro"])).toBe("*");
    expect(cabecalhoUnidades("supervisor", ["jardim", "centro"])).toBe("centro,jardim");
    expect(cabecalhoUnidades("funcionario", "*")).toBeNull();
    expect(cabecalhoUnidades("funcionario", [])).toBeNull();
    expect(cabecalhoUnidades("funcionario", ["Centro", "ok"])).toBe("ok");
  });

  test("quem concede", () => {
    expect(papeisConcediveis("supervisor")).toEqual(["funcionario"]);
    expect(podeConceder("gestor", "gestor")).toBe(true);
    expect(podeConceder("gestor", "plataforma")).toBe(false);
    expect(podeConceder("supervisor", "supervisor")).toBe(false);
    expect(podeConceder("funcionario", "funcionario")).toBe(false);
  });

  test("telefone e busca do funcionário", () => {
    expect(telefoneParaPapel("funcionario", "5511912341513")).toBe("····1513");
    expect(telefoneParaPapel("supervisor", "5511912341513")).toBe("5511912341513");
    expect(telefoneParaPapel("funcionario", "····1513")).toBe("····1513");
    expect(buscaRestrita("funcionario", "11912341513")).toBe(true);
    expect(buscaRestrita("funcionario", "1513")).toBe(false);
    expect(buscaRestrita("funcionario", "Ana")).toBe(false);
    expect(buscaRestrita("gestor", "11912341513")).toBe(false);
  });

  test("apelido da conversa", () => {
    expect(idConversa("cv_a1b2c3d4e5")).toBe("cv_a1b2c3d4e5");
    expect(idConversa("bykoji:can_1:5511912341513")).toBe("bykoji:can_1:5511912341513");
    expect(idConversa("cv_curto")).toBeNull();
  });
});
