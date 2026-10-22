import { expect, test } from "bun:test";
import { ESCOPOS } from "../gateway-chaves.functions";
import { dataBrParaIso, isoParaDataBr, mascaraData } from "@/lib/data-hora";
import { AJUDA_CAMPO } from "./atendimento";
import {
  AVISO_PIX,
  CAMPOS_COPIAR,
  apresentarCampo,
  diaBrasilia,
  filtrarDocumentos,
  itensNota,
  normalizarOrigem,
  origensDoTexto,
  rotuloCampoDocumento,
  textoExpira,
  type DocumentoResumo,
} from "./documentos";
import { executarWebhook } from "./webhooks.server";
import { gradeJanela, lerJanela, MENSAGEM_FOLLOWUP_AUSENTE } from "./followup";
import { executarFollowUp } from "./followup.server";
import { GatewayErro } from "./erros";
import { EVENTOS_SAIDA } from "./webhooks";

const doc = (parcial: Partial<DocumentoResumo>): DocumentoResumo => ({
  id: "anx_1",
  agente_id: "ag_1",
  conversation_id: null,
  origem: "api",
  modo: "extrair",
  nome: "boleto.pdf",
  formato: "pdf",
  tamanho_bytes: 100,
  estado: "pronto",
  motivo: null,
  paginas: 1,
  tipo_documento: "boleto",
  referencia: null,
  criado_em: "2026-10-21T15:30:00Z",
  processado_em: null,
  expira_em: null,
  apagado_em: null,
  ...parcial,
});

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

test("filtros de documento: tipo e dia de Brasília; estado fica para o gateway", () => {
  const itens = [
    doc({ id: "a", tipo_documento: "boleto", criado_em: "2026-10-21T02:30:00Z" }),
    doc({ id: "b", tipo_documento: "nfe", criado_em: "2026-10-21T15:00:00Z" }),
  ];
  // 02:30 UTC é 21/10 23:30 do dia anterior em Brasília? 02:30 UTC = 20/10 23:30 BRT.
  expect(diaBrasilia("2026-10-21T02:30:00Z")).toBe("2026-10-20");
  expect(diaBrasilia("2026-10-21T15:00:00Z")).toBe("2026-10-21");
  const noDia = filtrarDocumentos(itens, {
    estado: "pronto",
    tipo: "",
    desde: "2026-10-21",
    ate: "2026-10-21",
  });
  expect(noDia.map((d) => d.id)).toEqual(["b"]);
  const boletos = filtrarDocumentos(itens, { estado: "", tipo: "boleto", desde: "", ate: "" });
  expect(boletos.map((d) => d.id)).toEqual(["a"]);
});

test("janela de follow-up vira a mesma faixa em todos os dias", () => {
  const grade = gradeJanela("09:00", "22:00");
  expect(grade?.["dom"]).toEqual([["09:00", "22:00"]]);
  expect(gradeJanela("10:00", "10:00")).toBeNull();
  expect(lerJanela(grade).uniforme).toBe(true);
  expect(lerJanela({ seg: [["09:00", "18:00"]], ter: [["10:00", "18:00"]] }).uniforme).toBe(false);
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
