import { describe, expect, test } from "bun:test";
import {
  chaveTentativa,
  ENTRADA_FALHAS_MAX,
  mensagemBloqueio,
  registrarFalhaEntrada,
} from "./entrada";

describe("entrada tentativas", () => {
  test("chave usa e-mail e IP", () => {
    expect(chaveTentativa("Ana@X.com", "1.2.3.4")).toBe("ana@x.com|1.2.3.4");
    expect(chaveTentativa("Ana@X.com")).toBe("ana@x.com");
  });

  test("bloqueia na quinta falha na janela", () => {
    const agora = new Date("2026-10-30T17:00:00-03:00");
    let estado = { falhas: 0, falhaEm: null as string | null };
    for (let i = 1; i <= ENTRADA_FALHAS_MAX; i++) {
      const r = registrarFalhaEntrada({
        falhas: estado.falhas,
        falhaEm: estado.falhaEm,
        agora,
      });
      estado = { falhas: r.falhas, falhaEm: agora.toISOString() };
      if (i < ENTRADA_FALHAS_MAX) expect(r.bloqueadoAte).toBeNull();
      else {
        expect(r.bloqueadoAte).toBeTruthy();
        expect(mensagemBloqueio(r.bloqueadoAte!, agora)).toMatch(/15 minutos/);
      }
    }
  });
});
