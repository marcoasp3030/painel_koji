import { expect, test } from "bun:test";
import { ESCOPOS } from "../gateway-chaves.functions";
import { dataBrParaIso, isoParaDataBr, mascaraData } from "@/lib/data-hora";
import { AJUDA_CAMPO } from "./atendimento";
import {
  AVISO_PIX,
  CAMPOS_COPIAR,
  apresentarCampo,
  associarDocumentosDaConversa,
  itensNota,
  AVISO_AINDA_LENDO,
  AVISO_XML_FORA_DA_NOTA,
  INTERVALO_CONSULTA_ANEXO_MS,
  PRAZO_CONSULTA_ANEXO_MS,
  avisoXmlForaDaNota,
  consultaDoAnexoDeveParar,
  lerAnexoDaMensagem,
  mensagemArquivoInvalido,
  normalizarOrigem,
  origensDoTexto,
  parametrosListaDocumentos,
  rotuloCampoDocumento,
  rotuloTipo,
  textoExpira,
  LIMITE_ARQUIVO_BYTES,
} from "./documentos";
import { mensagemParaUsuario } from "./erros";
import { executarAnexo, executarEnvioDocumento } from "./simular.server";
import { LIMITE_CORPO_BYTES, corpoDaFuncaoExcede } from "@/lib/limite-corpo";
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

test("arquivo do simulador: tamanho, formato e o cartão na conversa", () => {
  expect(mensagemArquivoInvalido("boleto.pdf", 1200)).toBeNull();
  expect(mensagemArquivoInvalido("foto.jpeg", 10)).toBeNull();
  expect(mensagemArquivoInvalido("nota.XML", 10)).toBeNull();
  expect(mensagemArquivoInvalido("boleto.pdf", LIMITE_ARQUIVO_BYTES + 1)).toBe(
    "O arquivo é grande demais.",
  );
  expect(mensagemArquivoInvalido("virus.exe", 10)).toBe(
    "Formato não aceito. Use PDF, XML, JPG, PNG ou WEBP.",
  );
  expect(mensagemArquivoInvalido("vazio.pdf", 0)).toBe("O arquivo está vazio.");
  expect(avisoXmlForaDaNota("<pedido><item>1</item></pedido>")).toBe(AVISO_XML_FORA_DA_NOTA);
  expect(avisoXmlForaDaNota("\uFEFF  <NFe xmlns='http://www.portalfiscal.inf.br/nfe'>")).toBeNull();
  expect(avisoXmlForaDaNota("%PDF-1.4")).toBeNull();
  expect(consultaDoAnexoDeveParar(1_000, 30_999, "processando")).toBe(false);
  expect(consultaDoAnexoDeveParar(1_000, 31_000, "processando")).toBe(true);
  expect(consultaDoAnexoDeveParar(1_000, 1_500, "pronto")).toBe(true);
  expect(INTERVALO_CONSULTA_ANEXO_MS).toBe(2_000);
  expect(PRAZO_CONSULTA_ANEXO_MS).toBe(30_000);
  expect(AVISO_AINDA_LENDO).toBe("Ainda lendo, atualize em instantes");
  expect(corpoDaFuncaoExcede("/_serverFn/abc", String(LIMITE_CORPO_BYTES))).toBe(false);
  expect(corpoDaFuncaoExcede("/_serverFn/abc", String(LIMITE_CORPO_BYTES + 1))).toBe(true);
  expect(corpoDaFuncaoExcede("/ia/simular", "99999999")).toBe(false);
  expect(LIMITE_CORPO_BYTES).toBe(15_000_000);
  expect(lerAnexoDaMensagem("[anexo: boleto.pdf]\nsegue o boleto")).toEqual({
    nome: "boleto.pdf",
    texto: "segue o boleto",
  });
  expect(lerAnexoDaMensagem("oi")).toBeNull();
  const docs = associarDocumentosDaConversa(
    [{ conteudo: "[anexo: boleto.pdf]" }, { conteudo: "oi" }, { conteudo: "[anexo: boleto.pdf]" }],
    [
      { nome: "boleto.pdf", criado_em: "2026-10-22T15:00:00Z", id: "a" },
      { nome: "boleto.pdf", criado_em: "2026-10-22T15:02:00Z", id: "b" },
    ],
  );
  expect(docs.map((d) => d?.id ?? null)).toEqual(["a", null, "b"]);
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "VALIDATION_ERROR",
        status: 413,
        detalhes: { campo: "arquivo", motivo: "tamanho" },
      }),
    ),
  ).toBe("O arquivo é grande demais.");
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "VALIDATION_ERROR",
        status: 400,
        detalhes: { campo: "arquivo", motivo: "tipo_nao_aceito" },
      }),
    ),
  ).toBe("Formato não aceito. Use PDF, XML, JPG, PNG ou WEBP.");
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "CONFLICT",
        status: 409,
        detalhes: { campo: "agente_id", motivo: "capacidade_desligada" },
      }),
    ),
  ).toBe("A capacidade de documentos está desligada neste agente.");
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "VALIDATION_ERROR",
        status: 400,
        detalhes: { campo: "arquivo", motivo: "xml_nao_nfe" },
      }),
    ),
  ).toBe(AVISO_XML_FORA_DA_NOTA);
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "VALIDATION_ERROR",
        status: 400,
        detalhes: { campo: "arquivo", motivo: "tipo_nao_aceito", nome: "pedido.xml" },
      }),
    ),
  ).toBe(AVISO_XML_FORA_DA_NOTA);
});

test("envio do simulador vai em multipart, sem o arquivo no JSON", async () => {
  let opcoes: { corpo?: unknown; formulario?: { campos: Record<string, string> } } | undefined;
  const sessao = {
    tenant: async () => ({
      papel: "plataforma",
      chamar: async (_m: string, caminho: string[], op?: typeof opcoes) => {
        expect(caminho).toEqual(["agentes", "ag_1", "simular-documento"]);
        opcoes = op;
        return {
          dados: {
            anexo_id: "anx_abc",
            estado: "processando",
            conversation_id: "c",
            duplicado: false,
          },
        };
      },
    }),
  };
  await executarEnvioDocumento(sessao as never, {
    empresa: "bykoji",
    agente: "ag_1",
    canal_id: "can_1",
    identificador: "teste",
    mensagem: "segue",
    nome: "boleto.pdf",
    tipo: "application/pdf",
    base64: Buffer.from("%PDF-1.4").toString("base64"),
  });
  expect(opcoes?.corpo).toEqual({
    identificador: "teste",
    canal_id: "can_1",
    mensagem: "segue",
  });
  expect(opcoes?.formulario?.campos["mensagem"]).toBe("segue");
  expect(JSON.stringify(opcoes?.corpo)).not.toContain("base64");
});

test("xml que não é nota não segue para o gateway", async () => {
  let chamou = false;
  const sessao = {
    tenant: async () => ({
      papel: "plataforma",
      chamar: async () => {
        chamou = true;
        return { dados: {} };
      },
    }),
  };
  await expect(
    executarEnvioDocumento(sessao as never, {
      empresa: "bench_passo5",
      agente: "ag_1",
      canal_id: "can_1",
      identificador: "teste",
      nome: "pedido.xml",
      tipo: "application/xml",
      base64: Buffer.from("<pedido/>").toString("base64"),
    }),
  ).rejects.toThrow(AVISO_XML_FORA_DA_NOTA);
  expect(chamou).toBe(false);
});

test("o gateway recusando um xml vira o aviso da nota", async () => {
  const sessao = {
    tenant: async () => ({
      papel: "plataforma",
      chamar: async () => {
        throw new GatewayErro({
          codigo: "VALIDATION_ERROR",
          status: 400,
          detalhes: { campo: "arquivo", motivo: "tipo_nao_aceito" },
        });
      },
    }),
  };
  await expect(
    executarEnvioDocumento(sessao as never, {
      empresa: "bench_passo5",
      agente: "ag_1",
      canal_id: "can_1",
      identificador: "teste",
      nome: "pedido.xml",
      tipo: "application/xml",
      base64: Buffer.from("%PDF-1.4 nao e xml").toString("base64"),
    }),
  ).rejects.toThrow(AVISO_XML_FORA_DA_NOTA);
});

test("consulta do cartão lê o anexo pelo id", async () => {
  let caminho: string[] = [];
  const sessao = {
    tenant: async () => ({
      papel: "plataforma",
      chamar: async (_m: string, c: string[]) => {
        caminho = c;
        return {
          dados: {
            id: "anx_0123456789abcdef01234567",
            estado: "pronto",
            tipo_documento: "boleto",
            nome: "boleto.pdf",
            formato: "pdf",
          },
        };
      },
    }),
  };
  const doc = await executarAnexo(sessao as never, "bench_passo5", "anx_0123456789abcdef01234567");
  expect(caminho).toEqual(["anexos", "anx_0123456789abcdef01234567"]);
  expect(doc.estado).toBe("pronto");
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
