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
  duracaoCurta,
  juntarMensagens,
  legendaDoArquivo,
  linhaDoTempo,
  problemaNoArquivo,
  tamanhoLegivel,
  rotuloPessoa,
  nomeContato,
  esperaCurta,
  ordenarConversas,
  proximaDaFila,
  urgenciaEspera,
  vizinhaNaLista,
  telefoneExibicao,
  telefoneVisivel,
  textoCanal,
  temNovidade,
  type Conversa,
  type NotaInterna,
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
  // Recência manda: mensagem nova sobe, mesmo com outra conversa aguardando.
  expect(ordenarConversas([a, b])[0]?.conversation_id).toBe("a");
  expect(ordenarConversas([a, b], { porEspera: true })[0]?.conversation_id).toBe("b");
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
    leituraDeApoio: async <T>() => ({
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
        leituraDeApoio: async () => {
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

test("lista por recência: atividade mais nova no topo; aba espera usa idade da fila", () => {
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
    "a",
    "b",
    "e",
  ]);
  expect(ordenarConversas(itens).map((x) => x.conversation_id)).toEqual(["b", "a", "e"]);
  expect(
    ordenarConversas(itens, { porEspera: true, porRecencia: false }).map((x) => x.conversation_id),
  ).toEqual(["e", "a", "b"]);
});

const AGORA = Date.parse("2026-11-01T12:00:00-03:00");
const minutosAtras = (m: number) => new Date(AGORA - m * 60000).toISOString();
const fila = (id: string, aguardando?: string) =>
  ({ conversation_id: id, aguardando_atendente_desde: aguardando ?? null }) as Conversa;

test("esperaCurta mostra só o que importa em cada faixa", () => {
  expect(esperaCurta(minutosAtras(0.5), AGORA)).toBe("agora");
  expect(esperaCurta(minutosAtras(12), AGORA)).toBe("12 min");
  expect(esperaCurta(minutosAtras(60), AGORA)).toBe("1 h");
  expect(esperaCurta(minutosAtras(125), AGORA)).toBe("2 h 5 min");
  expect(esperaCurta(minutosAtras(1620), AGORA)).toBe("1 d 3 h");
  expect(esperaCurta(minutosAtras(2880), AGORA)).toBe("2 d");
  expect(esperaCurta("data ruim", AGORA)).toBe("");
});

test("urgenciaEspera muda nos limites de 5 e 15 minutos", () => {
  expect(urgenciaEspera(minutosAtras(4.9), AGORA)).toBe("normal");
  expect(urgenciaEspera(minutosAtras(5), AGORA)).toBe("atencao");
  expect(urgenciaEspera(minutosAtras(14.9), AGORA)).toBe("atencao");
  expect(urgenciaEspera(minutosAtras(15), AGORA)).toBe("critica");
  expect(urgenciaEspera("data ruim", AGORA)).toBe("normal");
});

test("vizinhaNaLista anda uma posição e para nas pontas", () => {
  const itens = [fila("a"), fila("b"), fila("c")];
  expect(vizinhaNaLista(itens, "b", 1)?.conversation_id).toBe("c");
  expect(vizinhaNaLista(itens, "b", -1)?.conversation_id).toBe("a");
  expect(vizinhaNaLista(itens, "c", 1)).toBeNull();
  expect(vizinhaNaLista(itens, "a", -1)).toBeNull();
  expect(vizinhaNaLista(itens, null, 1)?.conversation_id).toBe("a");
  expect(vizinhaNaLista(itens, "sumiu", -1)?.conversation_id).toBe("a");
  expect(vizinhaNaLista([], "a", 1)).toBeNull();
});

test("proximaDaFila abre a espera mais antiga e pula a conversa aberta", () => {
  const itens = [
    fila("nova", minutosAtras(2)),
    fila("sem-espera"),
    fila("antiga", minutosAtras(40)),
  ];
  expect(proximaDaFila(itens, null)?.conversation_id).toBe("antiga");
  expect(proximaDaFila(itens, "antiga")?.conversation_id).toBe("nova");
  expect(proximaDaFila([fila("sem-espera")], null)).toBeNull();
  expect(proximaDaFila([fila("so", minutosAtras(1))], "so")).toBeNull();
});

test("rotuloPessoa usa o primeiro nome do cadastro e cai para o e-mail", () => {
  const equipe = [
    { email: "ana.lima@exemplo.test", nome: "Ana Lima" },
    { email: "bia@exemplo.test", nome: null },
  ];
  expect(rotuloPessoa("ANA.LIMA@exemplo.test", equipe)).toBe("Ana");
  expect(rotuloPessoa("bia@exemplo.test", equipe)).toBe("bia");
  expect(rotuloPessoa("fora@exemplo.test", equipe)).toBe("fora");
  expect(rotuloPessoa("sem-arroba")).toBe("sem-arroba");
});

const nota = (id: number, criado_em: string) => ({ id, criado_em }) as NotaInterna;
const msg = (id: number, enviada_em: string | null) => ({ id, enviada_em });

test("linhaDoTempo intercala notas pelo horário", () => {
  const linha = linhaDoTempo(
    [msg(1, "2026-11-01T10:00:00Z"), msg(2, "2026-11-01T10:10:00Z")],
    [nota(9, "2026-11-01T10:05:00Z"), nota(8, "2026-11-01T10:20:00Z")],
  );
  expect(linha.map((i) => (i.tipo === "nota" ? `n${i.nota.id}` : `m${i.mensagem.id}`))).toEqual([
    "m1",
    "n9",
    "m2",
    "n8",
  ]);
});

test("linhaDoTempo só mostra nota antiga quando o histórico anterior está carregado", () => {
  const mensagens = [msg(5, "2026-11-01T10:00:00Z")];
  const antiga = [nota(1, "2026-11-01T09:00:00Z")];
  expect(linhaDoTempo(mensagens, antiga, { temMais: true }).map((i) => i.tipo)).toEqual([
    "mensagem",
  ]);
  expect(linhaDoTempo(mensagens, antiga).map((i) => i.tipo)).toEqual(["nota", "mensagem"]);
  // Conversa sem mensagem nenhuma ainda mostra a nota.
  expect(linhaDoTempo([], antiga).map((i) => i.tipo)).toEqual(["nota"]);
});

test("linhaDoTempo mantém no lugar a mensagem sem data", () => {
  const linha = linhaDoTempo(
    [msg(1, "2026-11-01T10:00:00Z"), msg(2, null), msg(3, "2026-11-01T10:10:00Z")],
    [],
  );
  expect(linha.map((i) => (i.tipo === "mensagem" ? i.mensagem.id : 0))).toEqual([1, 2, 3]);
});

test("duracaoCurta escolhe a unidade e mostra traço sem dado", () => {
  expect(duracaoCurta(null)).toBe("—");
  expect(duracaoCurta(0)).toBe("0 s");
  expect(duracaoCurta(59)).toBe("59 s");
  expect(duracaoCurta(120)).toBe("2 min");
  expect(duracaoCurta(3600)).toBe("1 h");
  expect(duracaoCurta(7500)).toBe("2 h 5 min");
});

test("problemaNoArquivo aceita PDF, JPG e PNG até 10 MB", () => {
  expect(problemaNoArquivo({ name: "a.PDF", size: 10 })).toBeNull();
  expect(problemaNoArquivo({ name: "a.jpeg", size: 10 })).toBeNull();
  expect(problemaNoArquivo({ name: "a.exe", size: 10 })).toContain("PDF");
  expect(problemaNoArquivo({ name: "a.png", size: 10 * 1024 * 1024 + 1 })).toContain("10 MB");
  expect(problemaNoArquivo({ name: "a.png", size: 0 })).toContain("vazio");
});

test("tamanhoLegivel e legendaDoArquivo", () => {
  expect(tamanhoLegivel(2048)).toBe("2 KB");
  expect(tamanhoLegivel(2.5 * 1024 * 1024)).toBe("2,5 MB");
  expect(legendaDoArquivo("[arquivo enviado: a.pdf]\nSegue")).toBe("Segue");
  expect(legendaDoArquivo("[arquivo enviado: a.pdf]")).toBeNull();
  expect(legendaDoArquivo("Texto comum")).toBe("Texto comum");
});
