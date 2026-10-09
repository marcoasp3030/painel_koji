import { expect, test } from "bun:test";
import {
  avancarCursor,
  chaveNovidades,
  juntarMensagens,
  ordenarConversas,
  temNovidade,
  type Conversa,
} from "./conversas";
import { agentesOcultos, exigirConversaVisivel } from "./ocultos";

test("cursor percorre páginas de 100 no servidor, continua sem saltar após limite", async () => {
  const chamadas: number[] = [];
  const pagina = async (desde: number, limite: number) => {
    expect(limite).toBe(100);
    chamadas.push(desde);
    return { proximo_cursor: desde + 100, tem_mais: desde < 2100 };
  };
  const primeira = await avancarCursor(pagina);
  expect(primeira).toEqual({ cursor: 2000, completo: false });
  expect(chamadas.length).toBe(20);
  const segunda = await avancarCursor(pagina, primeira.cursor);
  expect(segunda).toEqual({ cursor: 2200, completo: true });
  expect(chamadas.at(20)).toBe(2000);
});
test("cursor vazio funciona; cursor parado ou regressivo falha sem laço", async () => {
  expect(await avancarCursor(async () => ({ proximo_cursor: 7, tem_mais: false }), 7)).toEqual({
    cursor: 7,
    completo: true,
  });
  await expect(
    avancarCursor(async () => ({ proximo_cursor: 7, tem_mais: true }), 7),
  ).rejects.toThrow();
  await expect(
    avancarCursor(async () => ({ proximo_cursor: 6, tem_mais: false }), 7),
  ).rejects.toThrow();
});
test("novidades isoladas por usuário e empresa, leitura de uma não limpa outra", () => {
  expect(chaveNovidades("a", "bykoji")).not.toBe(chaveNovidades("b", "bykoji"));
  expect(chaveNovidades("a", "bykoji")).not.toBe(chaveNovidades("a", "outro"));
  const c = { conversation_id: "conv", ultima_em: "2026-10-09T12:00:00Z" } as Conversa;
  expect(temNovidade(c, { inicio: "2026-10-09T11:00:00Z", vistas: {} })).toBe(true);
  expect(temNovidade(c, { inicio: "2026-10-09T11:00:00Z", vistas: { conv: c.ultima_em! } })).toBe(
    false,
  );
});
test("histórico combina páginas sem duplicar e ordena IDs; atendimento tem prioridade", () => {
  const m = (id: number) => ({
    id,
    conteudo: "x",
    origem: "cliente",
    direcao: "entrada" as const,
    enviada_em: null,
  });
  expect(juntarMensagens([m(3), m(4)], [m(1), m(3)]).map((m) => m.id)).toEqual([1, 3, 4]);
  const a = { conversation_id: "a", ultima_em: "2026-10-09T12:00:00Z" } as Conversa;
  const b = {
    conversation_id: "b",
    ultima_em: "2026-10-09T11:00:00Z",
    aguardando_humano: true,
  } as Conversa;
  expect(ordenarConversas([a, b])[0]?.conversation_id).toBe("b");
});
test("agentes de teste em páginas posteriores continuam ocultos; falha de canal não libera histórico", async () => {
  let chamadas = 0;
  const t = {
    papel: "membro" as const,
    chamar: async <T>() => ({
      dados: (++chamadas === 1
        ? { itens: [{ id: "a", nome: "normal" }], proximo_cursor: "a" }
        : { itens: [{ id: "b", nome: "[teste] oculto" }], proximo_cursor: null }) as T,
    }),
  };
  expect(await agentesOcultos(t)).toEqual(new Set(["b"]));
  await expect(
    exigirConversaVisivel(
      {
        papel: "membro",
        chamar: async () => {
          throw new Error("canal indisponível");
        },
      },
      "empresa:canal:contato",
    ),
  ).rejects.toThrow();
});
