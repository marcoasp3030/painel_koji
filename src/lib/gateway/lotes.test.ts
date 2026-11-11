import { describe, expect, test } from "bun:test";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import {
  ACEITA_ARQUIVO_LOTE,
  INTERVALO_PROGRESSO_LOTE_MS,
  ROTULO_ESTADO_LOTE,
  ROTULO_MOTIVO_LOTE,
  TEXTO_AJUDA_LOTES,
  mensagemArquivoLoteInvalido,
} from "./lotes";
import { LIMITE_ARQUIVO_BYTES } from "./documentos";
import { executarLotes } from "./lotes.server";

test("rótulos e ajuda do lote", () => {
  expect(ROTULO_ESTADO_LOTE.aberto?.rotulo).toBe("Aberto");
  expect(ROTULO_ESTADO_LOTE.lendo?.rotulo).toBe("Lendo");
  expect(ROTULO_ESTADO_LOTE.concluido?.rotulo).toBe("Concluído");
  expect(ROTULO_ESTADO_LOTE.expirado?.rotulo).toBe("Expirado");
  expect(INTERVALO_PROGRESSO_LOTE_MS).toBe(3_000);
  expect(ACEITA_ARQUIVO_LOTE).toContain(".zip");
  expect(TEXTO_AJUDA_LOTES).toContain("sem atrasar os atendimentos");
  expect(TEXTO_AJUDA_LOTES).toContain("NFS-e nacional");
});

test("arquivo do lote: tamanho e formato", () => {
  expect(mensagemArquivoLoteInvalido("nota.pdf", 1200)).toBeNull();
  expect(mensagemArquivoLoteInvalido("nota.XML", 10)).toBeNull();
  expect(mensagemArquivoLoteInvalido("pacote.zip", 10)).toBeNull();
  expect(mensagemArquivoLoteInvalido("nota.pdf", LIMITE_ARQUIVO_BYTES + 1)).toBe(
    "O arquivo é grande demais.",
  );
  expect(mensagemArquivoLoteInvalido("foto.jpg", 10)).toBe(
    "Formato não aceito. Use PDF, XML ou ZIP.",
  );
  expect(mensagemArquivoLoteInvalido("vazio.pdf", 0)).toBe("O arquivo está vazio.");
});

test("motivos de recusa do lote em português", () => {
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "VALIDATION_ERROR",
        status: 400,
        detalhes: { campo: "arquivo", motivo: "xml_nao_e_nfe" },
      }),
    ),
  ).toBe("Este XML não é uma NF-e/NFC-e. Envie o XML da nota ou o PDF.");
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "CONFLICT",
        status: 409,
        detalhes: { campo: "lote_id", motivo: "lote_vazio" },
      }),
    ),
  ).toBe("Inclua ao menos um arquivo válido antes de fechar.");
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "CONFLICT",
        status: 409,
        detalhes: { campo: "lote_id", motivo: "limite_do_lote" },
      }),
    ),
  ).toBe("O limite do lote foi atingido.");
  expect(
    mensagemParaUsuario(
      new GatewayErro({
        codigo: "VALIDATION_ERROR",
        status: 400,
        detalhes: { campo: "arquivo", motivo: "zip_protegido" },
      }),
    ),
  ).toBe("ZIP com senha.");
  expect(ROTULO_MOTIVO_LOTE.arquivo_repetido).toBe("Este arquivo já está no lote.");
});

describe("envio em sequência", () => {
  test("cada arquivo vai em multipart, um por requisição", async () => {
    const chamadas: { caminho: string[]; formulario?: unknown }[] = [];
    const sessao = {
      tenant: async () => ({
        papel: "gestor",
        chamar: async (_m: string, caminho: string[], op?: { formulario?: unknown }) => {
          chamadas.push({ caminho, formulario: op?.formulario });
          return {
            dados: {
              arquivos: [
                {
                  arquivo_id: "lar_1",
                  nome: "a.pdf",
                  zip: null,
                  estado: "na_fila",
                  motivo: null,
                },
              ],
              lote: {
                lote_id: "lot_aaaaaaaaaaaaaaaaaaaaaaaa",
                agente_id: "ag_1",
                nome: null,
                estado: "aberto",
                criado_em: null,
                arquivos: {
                  total: 1,
                  na_fila: 1,
                  lido: 0,
                  sem_texto: 0,
                  recusado: 0,
                  falhou: 0,
                  duplicado: 0,
                },
                notas: 0,
                estimativa_s: 2,
              },
            },
          };
        },
      }),
    };
    await executarLotes(sessao as never, {
      empresa: "bykoji",
      acao: "enviar",
      lote_id: "lot_aaaaaaaaaaaaaaaaaaaaaaaa",
      nome: "a.pdf",
      tipo: "application/pdf",
      base64: Buffer.from("%PDF-1.4").toString("base64"),
    });
    await executarLotes(sessao as never, {
      empresa: "bykoji",
      acao: "enviar",
      lote_id: "lot_aaaaaaaaaaaaaaaaaaaaaaaa",
      nome: "b.xml",
      tipo: "application/xml",
      base64: Buffer.from("<nfe/>").toString("base64"),
    });
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]?.caminho).toEqual(["lotes", "lot_aaaaaaaaaaaaaaaaaaaaaaaa", "arquivos"]);
    expect(chamadas[1]?.caminho).toEqual(["lotes", "lot_aaaaaaaaaaaaaaaaaaaaaaaa", "arquivos"]);
    expect(chamadas[0]?.formulario).toMatchObject({
      arquivo: { nome: "a.pdf" },
    });
    expect(chamadas[1]?.formulario).toMatchObject({
      arquivo: { nome: "b.xml" },
    });
  });
});
