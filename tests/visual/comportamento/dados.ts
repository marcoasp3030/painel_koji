/**
 * Respostas fictícias no formato do gateway. O esquema é o de produção, só com
 * metadados curtos; nomes, telefones e textos daqui são de exemplo.
 */
import esquemaJson from "./esquema.json";
import type { CampoEsquema, Esquema, Visao } from "@/lib/gateway/atendimento";
import { gradeJanela } from "@/lib/gateway/followup";
import type { Json } from "@/lib/gateway/tipos";

type Preview = { papel?: string; whatsapp?: boolean };

function preview(): Preview {
  return (globalThis as { __PREVIEW?: Preview }).__PREVIEW ?? {};
}

const esquema = esquemaJson as Esquema;

function valores(parte: "perfil" | "comportamentos"): Record<string, Json> {
  const saida: Record<string, Json> = {};
  for (const [campo, def] of Object.entries(esquema[parte]) as [string, CampoEsquema][]) {
    saida[campo] = (def.padrao as Json | undefined) ?? null;
  }
  return saida;
}

const perfil = valores("perfil");
const comportamentos = valores("comportamentos");
const janela = gradeJanela("09:00", "22:00");
if (janela) comportamentos["follow_up_janela"] = janela;
const origemVazia = { perfil: {}, comportamentos: {} };

function visao(agente: string | undefined): Visao {
  const papel = preview().papel ?? "admin";
  const perfilRascunho = { ...perfil, tom: "formal" };
  const comportamentosRascunho = {
    ...comportamentos,
    debounce_s: 8,
    fallback: "Não consegui agora. Pode tentar de novo?",
  };
  return {
    escopo: agente ? "agente" : "empresa",
    segmento: "restaurante",
    versao_publicada: 3,
    publicado_em: "2026-10-11T19:56:00.000Z",
    publicado_por: "Ana",
    perfil_versao: "v3",
    publicado: { perfil, comportamentos },
    personalizado: { perfil: [], comportamentos: [] },
    efetivo: { perfil, comportamentos, origem: origemVazia },
    rascunho: {
      baseado_em: 3,
      desatualizado: false,
      atualizado_em: "2026-10-20T15:26:00.000Z",
      atualizado_por: "Ana",
      perfil: { tom: "formal" },
      comportamentos: {
        debounce_s: 8,
        fallback: "Não consegui agora. Pode tentar de novo?",
      },
      efetivo: {
        perfil: perfilRascunho,
        comportamentos: comportamentosRascunho,
        origem: origemVazia,
      },
      alteracoes: [
        { campo: "perfil.tom", antes: "equilibrado", depois: "formal" },
        { campo: "comportamentos.debounce_s", antes: 4, depois: 8 },
        {
          campo: "comportamentos.fallback",
          antes: null,
          depois: "Não consegui agora. Pode tentar de novo?",
        },
      ],
      bloqueios: [],
      avisos: [],
    },
    esquema,
    pode_editar: papel !== "membro",
  };
}

export async function atendimento(entrada: { data?: { acao?: string; agente?: string } }) {
  const acao = entrada.data?.acao;
  if (acao === "previa") {
    return {
      ok: true as const,
      dados: {
        fonte: "publicado",
        perfil_versao: "v3",
        perfil_atendimento: {
          nome_empresa: "Exemplo",
          nome_atendente: "Ana",
          tom: "equilibrado",
          emojis: "moderado",
        },
      },
    };
  }
  if (acao === "versoes") return { ok: true as const, dados: { itens: [], proximo_cursor: null } };
  return { ok: true as const, dados: visao(entrada.data?.agente) };
}

export async function listarAgentes() {
  return { itens: [{ id: "ag_exemplo", nome: "By Koji" }], proximo_cursor: null };
}

export async function listarCanais() {
  const tipo = preview().whatsapp ? "uazapi" : "webchat";
  return { itens: [{ id: "can_1", tipo, agente_id: "ag_exemplo", ativo: true }] };
}

export async function obterModulosEmpresa() {
  return { em_uso: [] as string[] };
}

export async function obterAcessoGateway() {
  return { papel: preview().papel ?? "admin" };
}

export async function listarEmpresasGateway() {
  return { itens: [{ id: "exemplo", nome: "Exemplo", status: "ativo" }] };
}

export async function salvarComportamento() {
  return { ok: true as const };
}

export async function testarAgente() {
  return { ok: true as const, resposta: "Exemplo." };
}
