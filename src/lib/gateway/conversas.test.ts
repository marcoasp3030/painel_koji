import { expect, test } from "bun:test";
import {
  avancarCursor,
  canalDaConversa,
  MOTIVO_NOME,
  nomeSemCadastro,
  resumoUltima,
  seloOrigemNome,
  validarNomeCadastro,
  chaveNovidades,
  desdeDoCursor,
  estadoConversa,
  juntarMensagens,
  nomeContato,
  ordenarConversas,
  telefoneExibicao,
  telefoneVisivel,
  textoCanal,
  temNovidade,
  type Conversa,
} from "./conversas";
import { agentesOcultos, exigirConversaVisivel } from "./ocultos";

test("polling parte do ultimo_id e não varre o histórico desde zero", async () => {
  expect(desdeDoCursor(0)).toBe(0);
  expect(desdeDoCursor(216)).toBe(216);
  expect(() => desdeDoCursor(-1)).toThrow();
  expect(() => desdeDoCursor(1.5)).toThrow();
  const chamadas: number[] = [];
  const desde = desdeDoCursor(216);
  const resultado = await avancarCursor(async (cursor) => {
    chamadas.push(cursor);
    return { proximo_cursor: cursor + 2, tem_mais: false };
  }, desde);
  expect(chamadas).toEqual([216]);
  expect(resultado).toEqual({ cursor: 218, completo: true });
});
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
    aguardando_atendente_desde: "2026-10-09T10:00:00Z",
  } as Conversa;
  expect(ordenarConversas([a, b])[0]?.conversation_id).toBe("b");
});
test("estado, telefone e canal usam só o que a lista já devolve", () => {
  const agora = Date.parse("2026-10-10T22:00:00Z");
  const base = {
    status: "ativa" as const,
    bot_pausado_ate: null,
    aguardando_atendente_desde: null,
    encerrada_em: null,
  };
  expect(estadoConversa(base, agora)).toBe("bot");
  expect(estadoConversa({ ...base, status: "pausada" }, agora)).toBe("atendente");
  expect(estadoConversa({ ...base, bot_pausado_ate: "2026-10-10T22:30:00Z" }, agora)).toBe(
    "atendente",
  );
  expect(estadoConversa({ ...base, bot_pausado_ate: "2026-10-10T21:00:00Z" }, agora)).toBe("bot");
  expect(
    estadoConversa(
      { ...base, status: "pausada", aguardando_atendente_desde: "2026-10-10T21:00:00Z" },
      agora,
    ),
  ).toBe("aguardando_atendente");
  expect(
    estadoConversa(
      {
        ...base,
        status: "pausada",
        aguardando_atendente_desde: "2026-10-10T21:00:00Z",
        encerrada_em: "2026-10-10T21:30:00Z",
      },
      agora,
    ),
  ).toBe("encerrada");
  expect(telefoneExibicao("5511947281513")).toBe("+55 11 94728-1513");
  expect(telefoneExibicao("551133334444")).toBe("+551133334444");
  expect(telefoneExibicao("marco")).toBe("marco");
  expect(telefoneExibicao("123")).toBe("123");
  expect(nomeContato({ nome: "Ana", telefone: "5511947281513" })).toBe("Ana");
  expect(nomeContato({ nome: null, telefone: "5511947281513" })).toBe("+55 11 94728-1513");
  expect(nomeContato({ nome: "  ", telefone: null })).toBe("Contato");
  expect(
    nomeContato({
      nome: "Perfil",
      telefone: "5511947281513",
      nome_exibicao: "Marco",
      telefone_formatado: "+55 11 94728-1513",
    }),
  ).toBe("Marco");
  expect(textoCanal("uazapi", "Loja")).toBe("WhatsApp · Loja");
  expect(textoCanal("api", "Diagnóstico")).toBe("API · Diagnóstico");
  expect(textoCanal("api", null)).toBe("API");
  expect(
    telefoneVisivel({ telefone: "5511947281513", telefone_formatado: "+55 11 9 4728-1513" }),
  ).toBe("+55 11 9 4728-1513");
});
test("agentes de teste em páginas posteriores continuam ocultos; falha de canal não libera histórico", async () => {
  let chamadas = 0;
  const t = {
    papel: "funcionario" as const,
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
        papel: "funcionario",
        chamar: async () => {
          throw new Error("canal indisponível");
        },
      },
      "empresa:canal:contato",
    ),
  ).rejects.toThrow();
});

test("PED1-c estado único do gateway vence o cálculo local", () => {
  const base = {
    status: "pausada" as const,
    bot_pausado_ate: null,
    aguardando_atendente_desde: null,
    encerrada_em: null,
  };
  expect(estadoConversa(base)).toBe("atendente");
  expect(estadoConversa({ ...base, estado: "encerrada" })).toBe("encerrada");
  expect(estadoConversa({ ...base, estado: "inventado" as never })).toBe("atendente");
});

test("PED1-c selo de origem, canal_info com teste e última com autor e tipo", () => {
  expect(seloOrigemNome("cadastro")?.rotulo).toBe("cadastro");
  expect(seloOrigemNome("informado")?.rotulo).toBe("informado");
  expect(seloOrigemNome("perfil")?.rotulo).toBe("perfil");
  expect(seloOrigemNome("telefone")?.rotulo).toBe("telefone");
  expect(seloOrigemNome("identificador")).toBeNull();
  expect(seloOrigemNome(null)).toBeNull();

  expect(
    canalDaConversa(
      {
        canal: "uazapi",
        canal_info: { id: "c", tipo: "uazapi", nome: "Loja", icone: "whatsapp", teste: true },
      },
      { tipo: "meta", nome: "Outro" },
    ),
  ).toEqual({ tipo: "uazapi", nome: "Loja", teste: true });
  expect(canalDaConversa({ canal: "site" }, { tipo: "site", nome: "Site" })).toEqual({
    tipo: "site",
    nome: "Site",
    teste: false,
  });

  expect(
    resumoUltima({
      ultima_mensagem: "x",
      ultima_em: null,
      ultima: {
        texto: null,
        em: "2026-10-11T00:40:02Z",
        direcao: "entrada",
        origem: "cliente",
        tipo: "audio",
      },
    }),
  ).toEqual({ autor: "Cliente", tipo: "Áudio", texto: null, em: "2026-10-11T00:40:02Z" });
  expect(
    resumoUltima({
      ultima_mensagem: "Pra retirar",
      ultima_em: null,
      ultima: { texto: "Pra retirar", em: null, direcao: "saida", origem: "humano", tipo: "texto" },
    }),
  ).toMatchObject({ autor: "Atendente", tipo: null, texto: "Pra retirar" });
  expect(resumoUltima({ ultima_mensagem: "antigo", ultima_em: null })).toMatchObject({
    autor: null,
    texto: "antigo",
  });
});

test("PED1-c nome de cadastro: mesma regra do gateway; vazio apaga", () => {
  expect(validarNomeCadastro("  Marco   Silva ")).toEqual({ ok: true, nome: "Marco Silva" });
  expect(validarNomeCadastro("   ")).toEqual({ ok: true, nome: null });
  expect(validarNomeCadastro("M")).toEqual({ ok: false, motivo: "tamanho" });
  expect(validarNomeCadastro("a".repeat(61))).toEqual({ ok: false, motivo: "tamanho" });
  expect(validarNomeCadastro("Marco 11 94728-1513")).toEqual({ ok: false, motivo: "telefone" });
  expect(validarNomeCadastro("Marco 😀")).toEqual({ ok: false, motivo: "caractere" });
  expect(validarNomeCadastro("A1")).toEqual({ ok: false, motivo: "letras" });
  expect(validarNomeCadastro("José D'Ávila")).toEqual({ ok: true, nome: "José D'Ávila" });
  expect(MOTIVO_NOME["letras"]).toBeTruthy();

  const telefone = { telefone: "5511947281513", telefone_formatado: "+55 11 94728-1513" };
  expect(
    nomeSemCadastro({
      ...telefone,
      nomes: { cadastro: "Marco", informado: "Marquinho", perfil: "M." },
    }),
  ).toBe("Marquinho");
  expect(
    nomeSemCadastro({ ...telefone, nomes: { cadastro: "Marco", informado: null, perfil: "🙂" } }),
  ).toBe("+55 11 94728-1513");
});

test("PED1-c ordem de cadastro mantém a ordem do gateway, fila de espera no topo", () => {
  const c = (id: string, ultima_em: string, espera: string | null = null) =>
    ({
      conversation_id: id,
      ultima_em,
      aguardando_atendente_desde: espera,
    }) as Conversa;
  const itens = [
    c("a", "2026-10-10T10:00:00Z"),
    c("b", "2026-10-10T12:00:00Z"),
    c("e", "2026-10-10T09:00:00Z", "2026-10-10T09:00:00Z"),
  ];
  expect(ordenarConversas(itens, { porRecencia: false }).map((x) => x.conversation_id)).toEqual([
    "e",
    "a",
    "b",
  ]);
  expect(ordenarConversas(itens).map((x) => x.conversation_id)).toEqual(["e", "b", "a"]);
});
