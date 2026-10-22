import { expect, test } from "bun:test";
import { ESCOPOS } from "../gateway-chaves.functions";
import {
  diaBrasilia,
  filtrarDocumentos,
  normalizarOrigem,
  origensDoTexto,
  type DocumentoResumo,
} from "./documentos";
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
