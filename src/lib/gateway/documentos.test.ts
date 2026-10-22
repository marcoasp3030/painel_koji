import { expect, test } from "bun:test";
import { ESCOPOS } from "../gateway-chaves.functions";
import { dataBrParaIso, isoParaDataBr, mascaraData } from "@/lib/data-hora";
import { AJUDA_CAMPO } from "./atendimento";
import {
  AVISO_PIX,
  CAMPOS_COPIAR,
  apresentarCampo,
  itensNota,
  normalizarOrigem,
  origensDoTexto,
  parametrosListaDocumentos,
  rotuloCampoDocumento,
  rotuloTipo,
  textoExpira,
} from "./documentos";
import { executarDocumentos } from "./documentos.server";
import { executarWebhook } from "./webhooks.server";
import { gradeJanela, lerJanela, MENSAGEM_FOLLOWUP_AUSENTE } from "./followup";
import { executarFollowUp } from "./followup.server";
import { GatewayErro } from "./erros";
import { EVENTOS_SAIDA, textoSegredoAnterior } from "./webhooks";

test("escopo documentos:enviar entra na criação da chave da empresa", () => {
  expect(ESCOPOS).toContain("documentos:enviar");
});

test("origem de formulário aceita o site e recusa caminho", () => {
  expect(normalizarOrigem("HTTPS://Loja.Exemplo.com.br/")).toBe("https://loja.exemplo.com.br");
  expect(normalizarOrigem("https://loja.exemplo.com.br/boleto")).toBeNull();
  const lidas = origensDoTexto("https://a.com.br\nhttps://a.com.br/\nftp://b.com");
  expect(lidas.origens).toEqual(["https://a.com.br"]);
  expect(lidas.invalidas).toEqual(["ftp://b.com"]);
});

test("lista de documentos pede tipo e período ao gateway", async () => {
  let query: unknown;
  const sessao = {
    tenant: async () => ({
      chamar: async (_metodo: string, caminho: string[], opcoes?: { query?: unknown }) => {
        expect(caminho).toEqual(["anexos"]);
        query = opcoes?.query;
        return { dados: { itens: [], proximo_cursor: null } };
      },
    }),
  };
  await executarDocumentos(sessao as never, {
    empresa: "bykoji",
    acao: "listar",
    estado: "pronto",
    tipo: "nfe",
    desde: "2026-10-21",
    ate: "2026-10-23",
  });
  expect(query).toEqual({
    limite: 50,
    estado: "pronto",
    tipo_documento: "nfe",
    de: "2026-10-21",
    ate: "2026-10-23",
  });
  expect(parametrosListaDocumentos({ estado: "", tipo: "", desde: "", ate: "" }, null)).toEqual({
    limite: 50,
  });
  await expect(
    executarDocumentos(sessao as never, {
      empresa: "bykoji",
      acao: "listar",
      desde: "2026-10-23",
      ate: "2026-10-21",
    }),
  ).rejects.toThrow("A data inicial é posterior à final.");
});

test("janela de follow-up vira a mesma faixa em todos os dias", () => {
  const grade = gradeJanela("09:00", "22:00");
  expect(grade?.["dom"]).toEqual([["09:00", "22:00"]]);
  expect(gradeJanela("10:00", "10:00")).toBeNull();
  expect(lerJanela(grade).uniforme).toBe(true);
  expect(lerJanela({ seg: [["09:00", "18:00"]], ter: [["10:00", "18:00"]] }).uniforme).toBe(false);
});

test("reativar follow-up envia o motivo no corpo", async () => {
  let corpo: unknown;
  const sessao = {
    tenant: async () => ({
      chamar: async (_metodo: string, caminho: string[], opcoes?: { corpo?: unknown }) => {
        expect(caminho).toEqual(["contatos", "ct_1", "opt-out-follow-up"]);
        corpo = opcoes?.corpo;
        return { dados: { ativo: false } };
      },
    }),
  };
  await executarFollowUp(sessao as never, {
    empresa: "bykoji",
    acao: "reativar",
    contato: "ct_1",
    motivo: "Pedido do cliente",
  });
  expect(corpo).toEqual({ motivo: "Pedido do cliente" });
  await expect(
    executarFollowUp(sessao as never, {
      empresa: "bykoji",
      acao: "reativar",
      contato: "ct_1",
      motivo: "ok",
    }),
  ).rejects.toThrow();
});

test("follow-up ausente (404) não derruba a conversa", async () => {
  const sessao = {
    tenant: async () => ({
      chamar: async () => {
        throw new GatewayErro({ codigo: "NOT_FOUND", status: 404 });
      },
    }),
  };
  const lista = await executarFollowUp(sessao as never, {
    empresa: "bykoji",
    acao: "listar",
    conversa: "conv_1",
  });
  expect(lista).toMatchObject({ itens: [], indisponivel: true });
  await expect(
    executarFollowUp(sessao as never, {
      empresa: "bykoji",
      acao: "cancelar",
      conversa: "conv_1",
    }),
  ).rejects.toThrow(MENSAGEM_FOLLOWUP_AUSENTE);
});

test("detalhe do documento usa rótulo, real e data — nunca a chave", () => {
  expect(rotuloCampoDocumento("linha_digitavel")).toBe("Linha digitável");
  expect(rotuloCampoDocumento("beneficiario_documento")).toBe("CNPJ do beneficiário");
  expect(rotuloCampoDocumento("id_transacao")).toBe("ID da transação");
  expect(rotuloCampoDocumento("data_hora")).toBe("Data e hora");
  expect(apresentarCampo("valor", "152.30").replace(/\s/g, " ")).toBe("R$ 152,30");
  expect(apresentarCampo("valor_total", "1890.50").replace(/\s/g, "")).toContain("1.890,50");
  expect(apresentarCampo("vencimento", "2026-10-25")).toBe("25/10/2026");
  expect(apresentarCampo("data_hora", "2026-10-21T14:32")).toBe("21/10/2026 14:32");
  expect(apresentarCampo("linha_digitavel", "34191.79001")).toBe("34191.79001");
  expect(CAMPOS_COPIAR).toEqual([
    "linha_digitavel",
    "codigo_barras",
    "chave_acesso",
    "id_transacao",
  ]);
  expect(textoExpira("2026-11-20T16:02:00Z")).toBe("Apagado automaticamente em 20/11/2026");
  expect(AVISO_PIX).toBe("Pagamento não verificado: confira no extrato antes de dar baixa");
  const itens = itensNota([
    { descricao: "Temaki", quantidade: "2", valor_unitario: "32.00", valor_total: "64.00" },
  ]);
  expect(itens?.[0]?.descricao).toBe("Temaki");
  expect(mascaraData("21102026")).toBe("21/10/2026");
  expect(dataBrParaIso("21/10/2026")).toBe("2026-10-21");
  expect(dataBrParaIso("31/02/2026")).toBe("");
  expect(isoParaDataBr("2026-10-21")).toBe("21/10/2026");
});

test("rótulos de conta de consumo e cobrança Pix", () => {
  expect(rotuloTipo("boleto_concessionaria")).toBe("Conta de consumo");
  expect(rotuloTipo("pix_cobranca")).toBe("Cobrança Pix");
  expect(textoSegredoAnterior("2026-10-23T17:32:00Z")).toBe(
    "Segredo anterior válido até 23/10 14:32",
  );
  expect(textoSegredoAnterior(null)).toBe("");
});

test("ensaio do follow-up avisa que só o primeiro é registrado", () => {
  expect(AJUDA_CAMPO["follow_up_segundo_min"]).toContain(
    "Enquanto estiver em ensaio, só o 1º é registrado.",
  );
  expect(AJUDA_CAMPO["follow_up_segundo_min"]).not.toContain("ainda não nasce");
});

test("gerar segredo novo avisa quando a rota ainda não existe", async () => {
  const sessao = {
    tenant: async () => ({
      chamar: async () => {
        throw new GatewayErro({ codigo: "NOT_FOUND", status: 404 });
      },
    }),
  };
  await expect(
    executarWebhook(sessao as never, { empresa: "bykoji", acao: "rotacionar", id: "wh_1" }),
  ).rejects.toThrow("O gateway ainda não gera um segredo novo");
});

test("webhooks de saída incluem documentos, resposta e follow-up", () => {
  const ids = EVENTOS_SAIDA.map((e) => e.id);
  for (const id of [
    "documento.pronto",
    "documento.falhou",
    "documento.apagado",
    "conversa.resposta",
    "follow_up.agendado",
    "follow_up.cancelado",
    "follow_up.ensaio",
  ]) {
    expect(ids).toContain(id);
  }
});
