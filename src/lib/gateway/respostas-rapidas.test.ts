import { expect, test } from "bun:test";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import { executarRespostas } from "./respostas-rapidas.server";
import {
  aplicarVariaveis,
  filtrarRespostas,
  primeiroNome,
  respostasSchema,
  saudacaoDoDia,
  tokenBarra,
  trocarToken,
  variaveisPendentes,
  type RespostaRapida,
} from "./respostas-rapidas";

const resposta = (atalho: string, texto = "Texto") =>
  ({
    id: 1,
    atalho,
    texto,
    escopo: "equipe",
    usos: 0,
    atualizado_em: "",
    editavel: true,
  }) as RespostaRapida;

test("tokenBarra abre no início ou depois de espaço e ignora link e data", () => {
  expect(tokenBarra("/pi", 3)).toEqual({ inicio: 0, fim: 3, termo: "pi" });
  expect(tokenBarra("/", 1)).toEqual({ inicio: 0, fim: 1, termo: "" });
  expect(tokenBarra("olá /pi", 7)).toEqual({ inicio: 4, fim: 7, termo: "pi" });
  expect(tokenBarra("linha\n/pi", 9)).toEqual({ inicio: 6, fim: 9, termo: "pi" });
  expect(tokenBarra("https://site.com/pix", 20)).toBeNull();
  expect(tokenBarra("dia 10/11", 9)).toBeNull();
  expect(tokenBarra("sem barra", 9)).toBeNull();
  // Cursor no meio da palavra: não interrompe a edição.
  expect(tokenBarra("/pix", 2)).toBeNull();
  expect(tokenBarra("/pi fim", 3)).toEqual({ inicio: 0, fim: 3, termo: "pi" });
});

test("trocarToken mantém o resto do texto e posiciona o cursor", () => {
  const texto = "Oi /pi tudo bem";
  expect(trocarToken(texto, { inicio: 3, fim: 6, termo: "pi" }, "Chave PIX")).toEqual({
    texto: "Oi Chave PIX tudo bem",
    cursor: 12,
  });
});

test("filtrarRespostas prioriza o atalho e não liga para acento", () => {
  const itens = [
    resposta("horario", "Abrimos às 18h"),
    resposta("sem-pix"),
    resposta("pix"),
    resposta("x", "Aceitamos pix"),
  ];
  expect(filtrarRespostas(itens, "pix").map((r) => r.atalho)).toEqual(["pix", "sem-pix", "x"]);
  expect(filtrarRespostas(itens, "ÀS 18").map((r) => r.atalho)).toEqual(["horario"]);
  expect(filtrarRespostas(itens, "")).toEqual(itens);
  expect(filtrarRespostas(itens, "nada")).toEqual([]);
});

test("saudacaoDoDia segue o horário de Brasília", () => {
  expect(saudacaoDoDia(Date.parse("2026-11-01T11:59:00-03:00"))).toBe("Bom dia");
  expect(saudacaoDoDia(Date.parse("2026-11-01T12:00:00-03:00"))).toBe("Boa tarde");
  expect(saudacaoDoDia(Date.parse("2026-11-01T18:00:00-03:00"))).toBe("Boa noite");
  expect(saudacaoDoDia(Date.parse("2026-11-01T00:30:00-03:00"))).toBe("Bom dia");
});

test("aplicarVariaveis preenche o que sabe e deixa o resto para a pessoa", () => {
  const agora = Date.parse("2026-11-01T09:00:00-03:00");
  expect(
    aplicarVariaveis("{saudacao}, {nome}! Unidade {unidade}.", {
      nome: "Ana",
      unidade: "Centro",
      agora,
    }),
  ).toBe("Bom dia, Ana! Unidade Centro.");
  const parcial = aplicarVariaveis("{saudacao}, {nome}!", { nome: null, agora });
  expect(parcial).toBe("Bom dia, {nome}!");
  expect(variaveisPendentes(parcial)).toEqual(["{nome}"]);
  expect(variaveisPendentes("{nome} e {nome} {unidade}")).toEqual(["{nome}", "{unidade}"]);
  expect(variaveisPendentes("Texto com {chaves} livres")).toEqual([]);
});

test("primeiroNome não transforma telefone em nome", () => {
  expect(primeiroNome({ nome_exibicao: "Ana Lima", nome_origem: "cadastro" })).toBe("Ana");
  expect(primeiroNome({ nome_exibicao: "+55 11 90000-0001", nome_origem: "telefone" })).toBeNull();
  expect(primeiroNome({ nome_exibicao: "Contato", nome_origem: "anonimizado" })).toBeNull();
  expect(primeiroNome({ nome_exibicao: "12345" })).toBeNull();
  expect(primeiroNome({ nome_exibicao: null })).toBeNull();
});

test("respostasSchema recusa atalho inválido e campo a mais", () => {
  const base = { empresa: "e", acao: "criar", texto: "x", escopo: "pessoal" };
  expect(respostasSchema.safeParse({ ...base, atalho: "pix" }).success).toBe(true);
  expect(respostasSchema.safeParse({ ...base, atalho: "Com Espaco" }).success).toBe(false);
  expect(respostasSchema.safeParse({ ...base, atalho: "pix", dono: "outro" }).success).toBe(false);
  expect(respostasSchema.safeParse({ ...base, atalho: "pix", texto: "   " }).success).toBe(false);
});

function sessaoQueFalha(erro: GatewayErro) {
  const chamar = async () => {
    throw erro;
  };
  return { tenant: async () => ({ chamar }) } as unknown as Parameters<typeof executarRespostas>[0];
}
const criar = { empresa: "e", acao: "criar", atalho: "pix", texto: "x", escopo: "equipe" };

test("erro do servidor segue como GatewayErro, senão a tela só veria a mensagem genérica", async () => {
  const repetido = new GatewayErro({
    codigo: "CONFLICT",
    status: 409,
    detalhes: { campo: "atalho" },
  });
  const pego = await executarRespostas(sessaoQueFalha(repetido), criar).catch((e: unknown) => e);
  expect(pego).toBeInstanceOf(GatewayErro);
  expect(mensagemParaUsuario(pego as GatewayErro)).toBe("Já existe uma resposta com este atalho.");

  const invalido = await executarRespostas(sessaoQueFalha(repetido), {
    ...criar,
    atalho: "Com Espaco",
  }).catch((e: unknown) => e);
  expect(invalido).toBeInstanceOf(GatewayErro);
  expect((invalido as GatewayErro).status).toBe(400);
});

test("gateway sem a rota: a lista fica indisponível e a conversa segue", async () => {
  const ausente = new GatewayErro({ codigo: "NOT_FOUND", status: 404 });
  expect(
    await executarRespostas(sessaoQueFalha(ausente), { empresa: "e", acao: "listar" }),
  ).toEqual({
    itens: [],
    indisponivel: true,
  });
  const pego = await executarRespostas(sessaoQueFalha(ausente), criar).catch((e: unknown) => e);
  expect(pego).toBeInstanceOf(GatewayErro);
});
