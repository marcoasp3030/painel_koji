/** Simulador: texto, capacidade de documentos e envio de arquivo. */
import { z } from "zod";
import { GatewayErro } from "./erros";
import type { ModuloGateway } from "./modulo.server";
import { empresa, idRecurso } from "./esquemas";
import {
  AVISO_XML_FORA_DA_NOTA,
  LIMITE_ARQUIVO_BYTES,
  avisoXmlForaDaNota,
  mensagemArquivoInvalido,
  type DocumentoResumo,
} from "./documentos";
import type { ResultadoSimulacao } from "./tipos";

type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;

export type ResultadoDocumentoSimulado = {
  anexo_id: string;
  estado: string;
  motivo: string | null;
  conversation_id: string | null;
  duplicado: boolean;
};

const envioDocumento = z.object({
  empresa,
  agente: idRecurso,
  canal_id: idRecurso,
  identificador: z.string().trim().min(1).max(100),
  mensagem: z.string().trim().max(2000).optional(),
  nome: z.string().trim().min(1).max(180),
  tipo: z.string().max(120),
  base64: z
    .string()
    .min(1)
    .max(Math.ceil(LIMITE_ARQUIVO_BYTES / 3) * 4 + 8),
});

export async function executarEnvioDocumento(s: Sessao, entrada: unknown) {
  const p = envioDocumento.safeParse(entrada);
  if (!p.success) {
    throw new GatewayErro({
      codigo: "VALIDATION_ERROR",
      status: 400,
      mensagem: p.error.issues[0]?.message ?? "Confira os campos.",
    });
  }
  const d = p.data;
  const formato = mensagemArquivoInvalido(d.nome, 1);
  if (formato) {
    throw new GatewayErro({ codigo: "VALIDATION_ERROR", status: 400, mensagem: formato });
  }
  const avisoXml = avisoXmlForaDaNota(trechoInicial(d.base64));
  if (avisoXml) {
    throw new GatewayErro({
      codigo: "VALIDATION_ERROR",
      status: 400,
      mensagem: avisoXml,
      detalhes: { campo: "arquivo", motivo: "xml_nao_nfe" },
    });
  }
  const t = await s.tenant(d.empresa);
  await (await import("./ocultos")).exigirAgenteVisivel(t, d.agente);
  const campos: Record<string, string> = {
    identificador: d.identificador,
    canal_id: d.canal_id,
  };
  if (d.mensagem) campos["mensagem"] = d.mensagem;
  try {
    const { dados } = await t.chamar<ResultadoDocumentoSimulado>(
      "POST",
      ["agentes", d.agente, "simular-documento"],
      {
        corpo: campos,
        formulario: {
          arquivo: { nome: d.nome, tipo: d.tipo || "application/octet-stream", base64: d.base64 },
          campos,
        },
        tempoLimiteMs: 40_000,
      },
    );
    return dados;
  } catch (erro) {
    if (xmlRecusadoPeloGateway(erro, d.nome, d.base64)) {
      throw new GatewayErro({
        codigo: "VALIDATION_ERROR",
        status: 400,
        mensagem: AVISO_XML_FORA_DA_NOTA,
        detalhes: { campo: "arquivo", motivo: "xml_nao_nfe", nome: d.nome },
      });
    }
    throw erro;
  }
}

/** Os primeiros 4 KB, o mesmo trecho em que o gateway procura a NF-e. */
function trechoInicial(base64: string) {
  const fatia = base64.slice(0, Math.ceil(4096 / 3) * 4);
  return Buffer.from(fatia, "base64").subarray(0, 4096).toString("utf8");
}

function xmlRecusadoPeloGateway(erro: unknown, nome: string, base64: string) {
  if (!(erro instanceof GatewayErro) || erro.detalhes["motivo"] !== "tipo_nao_aceito") return false;
  return nome.toLowerCase().endsWith(".xml") || avisoXmlForaDaNota(trechoInicial(base64)) !== null;
}

export async function executarCapacidadeDocumentos(
  s: Sessao,
  empresaId: string | null | undefined,
  agente: string,
) {
  const t = await s.tenant(empresaId);
  await (await import("./ocultos")).exigirAgenteVisivel(t, agente);
  const { dados } = await t.chamar<{ documentos?: { ativo?: boolean } }>("GET", [
    "agentes",
    agente,
    "capacidades",
  ]);
  return { ativo: dados.documentos?.ativo === true };
}

export async function executarAnexosDaConversa(
  s: Sessao,
  empresaId: string | null | undefined,
  conversa: string,
) {
  const t = await s.tenant(empresaId);
  await (await import("./ocultos")).exigirConversaVisivel(t, conversa);
  const { dados } = await t.chamar<{ itens: DocumentoResumo[] }>("GET", ["anexos"], {
    query: { conversation_id: conversa, limite: 50 },
  });
  return dados;
}

export async function executarAnexo(
  s: Sessao,
  empresaId: string | null | undefined,
  anexo: string,
) {
  const t = await s.tenant(empresaId);
  const { dados } = await t.chamar<DocumentoResumo>("GET", ["anexos", anexo]);
  return {
    id: dados.id,
    estado: dados.estado,
    tipo_documento: dados.tipo_documento,
    nome: dados.nome,
    formato: dados.formato,
  };
}

export async function executarMensagemSimulada(
  s: Sessao,
  data: {
    empresa?: string | null | undefined;
    agente: string;
    canal_id: string;
    identificador: string;
    texto: string;
  },
) {
  const t = await s.tenant(data.empresa);
  await (await import("./ocultos")).exigirAgenteVisivel(t, data.agente);
  const { dados } = await t.chamar<ResultadoSimulacao>(
    "POST",
    ["agentes", data.agente, "simular"],
    {
      corpo: {
        canal_id: data.canal_id,
        identificador: data.identificador,
        texto: data.texto,
      },
    },
  );
  return dados;
}
