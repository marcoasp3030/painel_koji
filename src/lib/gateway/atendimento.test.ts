import { test, expect } from "bun:test";
import {
  ordenarConversas,
  seloEspera,
  MOTIVO_ATENDENTE,
  contarEsperasVisiveis,
  type Conversa,
} from "./conversas";
import { FALLBACK_PADRAO, problemaFallback, erroDoFallback } from "./fallback";
import { interpretarErro } from "./erros";
import { autorizar } from "./modulo.server";
import { paraValor } from "./formulario";

test("espera mais antiga primeiro, independente da última mensagem; null sai da fila", () => {
  const c = (id: string, data: string | null) =>
    ({
      conversation_id: id,
      aguardando_atendente_desde: data,
      ultima_em: "2026-10-10T12:00:00Z",
    }) as Conversa;
  const velha = c("velha", "2026-10-10T10:00:00Z"),
    nova = c("nova", "2026-10-10T11:00:00Z"),
    normal = c("normal", null);
  expect(ordenarConversas([normal, nova, velha]).map((c) => c.conversation_id)).toEqual([
    "velha",
    "nova",
    "normal",
  ]);
  velha.aguardando_atendente_desde = null;
  expect(ordenarConversas([velha, nova])[0]?.conversation_id).toBe("nova");
  expect(seloEspera("2026-10-10T11:58:00Z", Date.parse("2026-10-10T12:00:00Z"))).toBe(
    "Aguardando atendente há 2 min",
  );
  expect(seloEspera("2026-10-10T12:01:00Z", Date.parse("2026-10-10T12:00:00Z"))).toContain("0 min");
  expect(Object.values(MOTIVO_ATENDENTE)).toEqual([
    "o agente deu erro",
    "o agente demorou demais",
    "agente pausado por falhas seguidas",
    "não sabemos se a resposta chegou ao cliente",
  ]);
});
test("evento sinaliza somente conversa visível, sem revelar agentes de teste", async () => {
  const eventos = [
    { id: 1, tipo: "conversa.aguardando_atendente", alvo: "visivel" },
    { id: 2, tipo: "conversa.aguardando_atendente", alvo: "oculta" },
    { id: 3, tipo: "mensagem.recebida", alvo: "visivel" },
  ];
  expect(
    await contarEsperasVisiveis(eventos, async (alvo) => {
      if (alvo === "oculta") throw new Error("NOT_FOUND");
    }),
  ).toBe(1);
  expect(
    await contarEsperasVisiveis(eventos, async () => {
      throw new Error("rede");
    }),
  ).toBe(0);
});
test("fallback vazio herda; mínimo Unicode e letra, não só números ou emoji", () => {
  for (const v of ["", "   ", null, undefined, FALLBACK_PADRAO, "é12345678901234"])
    expect(problemaFallback(v)).toBeNull();
  for (const v of ["curto", "123456789012345", "🙏".repeat(20), "a".repeat(14), 123])
    expect(problemaFallback(v)).not.toBeNull();
  expect(paraValor("fallback", "  ")).toBeNull();
});
test("erro do gateway aponta fallback junto ao campo sem repassar detalhes extras", () => {
  const e = interpretarErro(400, {
    erro: {
      codigo: "VALIDATION_ERROR",
      mensagem: "Confira os campos informados.",
      detalhes: { campo: "fallback", extra: "nao transportar" },
    },
  });
  expect(erroDoFallback(e)).toEqual({
    campo: "fallback",
    mensagem:
      "Escreva pelo menos 15 caracteres, incluindo uma letra, ou deixe vazio para usar o padrão.",
  });
  expect(erroDoFallback(interpretarErro(403, {}))).toBeNull();
  expect(erroDoFallback(new Error("x"))).toBeNull();
});
test("fallback e leitura mantêm papéis no servidor", () => {
  expect(() =>
    autorizar("admin", "PATCH", ["agentes", "a"], { fallback: FALLBACK_PADRAO }),
  ).not.toThrow();
  expect(() =>
    autorizar("membro", "PATCH", ["agentes", "a"], { fallback: FALLBACK_PADRAO }),
  ).toThrow();
  for (const p of ["admin", "membro"] as const)
    expect(() => autorizar(p, "GET", ["conversas"])).not.toThrow();
});
