/**
 * Erros da integração com o gateway de agentes.
 * Este arquivo não conhece URL nem chave e pode ser usado pelo navegador.
 */
import { AVISO_XML_FORA_DA_NOTA } from "./documentos";

export type CodigoGateway =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "CREDENTIAL_REJECTED"
  | "NOT_IMPLEMENTED"
  | "UNAVAILABLE";

const MENSAGEM_PADRAO: Record<CodigoGateway, string> = {
  VALIDATION_ERROR: "Confira os campos informados.",
  NOT_FOUND: "Recurso não encontrado.",
  CONFLICT: "A operação conflita com o estado atual do recurso.",
  UNAUTHORIZED: "Credencial de acesso ausente ou inválida.",
  FORBIDDEN: "Você não tem permissão para esta operação.",
  RATE_LIMITED: "Limite de requisições atingido. Aguarde e tente novamente.",
  UPSTREAM_ERROR: "Não foi possível concluir a chamada ao provedor.",
  CREDENTIAL_REJECTED: "Credencial do Skyone recusada.",
  NOT_IMPLEMENTED: "Esta operação ainda não está disponível.",
  UNAVAILABLE: "Gateway de agentes temporariamente indisponível.",
};

const CODIGOS = new Set(Object.keys(MENSAGEM_PADRAO));

export class GatewayErro extends Error {
  readonly itemAtual: unknown;
  readonly codigo: CodigoGateway;
  readonly status: number;
  readonly detalhes: Record<string, unknown>;
  /** Segundos sugeridos pelo gateway em 429 (Retry-After). */
  readonly tentarApos: number | null;

  constructor(opcoes: {
    itemAtual?: unknown;
    codigo: CodigoGateway;
    status: number;
    mensagem?: string | null;
    detalhes?: Record<string, unknown>;
    tentarApos?: number | null;
  }) {
    super(opcoes.mensagem || MENSAGEM_PADRAO[opcoes.codigo]);
    this.name = "GatewayErro";
    this.itemAtual = opcoes.itemAtual;
    this.codigo = opcoes.codigo;
    this.status = opcoes.status;
    this.detalhes = opcoes.detalhes ?? {};
    this.tentarApos = opcoes.tentarApos ?? null;
  }
}

export function codigoPorStatus(status: number): CodigoGateway {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 400 || status === 413 || status === 422) return "VALIDATION_ERROR";
  if (status === 405 || status === 501) return "NOT_IMPLEMENTED";
  if (status === 502) return "UPSTREAM_ERROR";
  return "UNAVAILABLE";
}

/**
 * Converte a resposta de erro do gateway: envelope {"erro":{codigo,mensagem,detalhes}}
 * (atual) e, por compatibilidade barata, o formato antigo {"detail":...}.
 * Do formato "detail" só aproveitamos o campo; o texto não é repassado.
 */
export function interpretarErro(
  status: number,
  corpo: unknown,
  tentarApos: number | null = null,
): GatewayErro {
  const objeto = corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>) : null;
  const erro = objeto?.["erro"];
  if (erro && typeof erro === "object") {
    const e = erro as Record<string, unknown>;
    const codigo =
      typeof e["codigo"] === "string" && CODIGOS.has(e["codigo"])
        ? (e["codigo"] as CodigoGateway)
        : codigoPorStatus(status);
    const detalhes =
      e["detalhes"] && typeof e["detalhes"] === "object"
        ? (e["detalhes"] as Record<string, unknown>)
        : {};
    // Compatibilidade barata com gateways anteriores ao 8f387be, que repetiam o
    // código em "mensagem" (ex.: TENANT_NOT_FOUND): vale o texto padrão.
    const mensagem =
      typeof e["mensagem"] === "string" && !/^[A-Z0-9_]+$/.test(e["mensagem"])
        ? e["mensagem"]
        : null;
    return new GatewayErro({
      codigo,
      status,
      mensagem,
      detalhes,
      tentarApos,
      itemAtual: status === 409 ? objeto?.["item"] : undefined,
    });
  }

  const detalhes: Record<string, unknown> = {};
  const detail = objeto?.["detail"];
  if (Array.isArray(detail)) {
    const loc = (detail[0] as { loc?: unknown } | undefined)?.loc;
    const campo = Array.isArray(loc) ? loc[loc.length - 1] : null;
    if (typeof campo === "string") detalhes["campo"] = campo;
  }
  return new GatewayErro({ codigo: codigoPorStatus(status), status, detalhes, tentarApos });
}

/** O que fazer quando o gateway aponta um campo (detalhes.campo) sem explicar. */
const AJUDA_POR_CAMPO: Record<string, string> = {
  disponibilidade:
    "Confira a disponibilidade: dias da semana e faixas de horário em HH:MM, sem sobreposição.",
  fallback:
    "Escreva pelo menos 15 caracteres, incluindo uma letra, ou deixe vazio para usar o padrão.",
  skyone_webhook_url:
    "Para usar a IA real, cadastre antes a URL do fluxo no Skyone (https, sem usuário e senha na URL).",
  skyone_auth: "Para usar a IA real, cadastre antes o usuário e a senha do fluxo no Skyone.",
  provedor:
    "Para usar a IA real, configure antes a conexão com o Skyone neste agente (URL do fluxo, usuário e senha).",
  skyone_auth_usuario: "Para usar a IA real, cadastre antes o usuário do fluxo no Skyone.",
  send_mode:
    "A conversa de teste fica bloqueada porque o envio aos clientes deste agente está real.",
  skyone_auth_cabecalho: "O nome do cabeçalho de autenticação do Skyone é inválido.",
  agente_mode:
    "A simulação só funciona com o agente em Simulação e envio de teste. Troque as respostas para Simulação e tente de novo.",
  max_wait_s:
    "A espera máxima precisa ser maior ou igual ao tempo de esperar o cliente terminar de digitar.",
  debounce_s: "O tempo de esperar o cliente terminar de digitar vai de 1 a 15 segundos.",
  contatos_permitidos: "Use DDD + número, ex.: 11912345678",
  alerta_telefone: "Use DDD + número, ex.: 11912345678",
  timeout_s: "O tempo limite vai de 1 a 600 segundos.",
  modelo_id: "Este modelo usa módulos que a empresa não tem habilitados, ou o modelo não existe.",
  nome: "Informe um nome.",
  id: "Identificador inválido ou já usado: 3 a 40 letras minúsculas, números ou _.",
  timezone: "Fuso horário inválido. Exemplo: America/Sao_Paulo.",
  escopos: "Escolha ao menos um escopo válido.",
  expira_em: "Data de validade inválida.",
  agente_id: "Escolha um agente desta empresa.",
  tipo: "O tipo do canal não pode ser alterado.",
  texto: "Escreva a mensagem.",
  identificador: "Informe quem é o cliente simulado.",
  canal_id: "Escolha um canal API ligado a este agente.",
};

/** Texto curto para o usuário: motivo real quando o gateway aponta o campo, e a espera em 429. */
export function mensagemParaUsuario(erro: GatewayErro): string {
  // Recurso de outra unidade chega como 404. Não confirma que existe nem fala em permissão.
  if (erro.status === 404 || erro.codigo === "NOT_FOUND") return "Não encontrado.";
  if (erro.codigo === "RATE_LIMITED" && erro.tentarApos) {
    return `${erro.message} Tente em ${erro.tentarApos} s.`;
  }
  const motivo = typeof erro.detalhes["motivo"] === "string" ? erro.detalhes["motivo"] : null;
  if (motivo === "tamanho" || erro.status === 413) return "O arquivo é grande demais.";
  if (motivo === "xml_nao_nfe") return AVISO_XML_FORA_DA_NOTA;
  if (motivo === "tipo_nao_aceito") {
    const nome = typeof erro.detalhes["nome"] === "string" ? erro.detalhes["nome"] : "";
    if (nome.toLowerCase().endsWith(".xml")) return AVISO_XML_FORA_DA_NOTA;
    return "Formato não aceito. Use PDF, XML, JPG, PNG ou WEBP.";
  }
  if (motivo === "capacidade_desligada")
    return "A capacidade de documentos está desligada neste agente.";
  if (motivo === "vazio") return "O arquivo está vazio.";
  const campo = typeof erro.detalhes["campo"] === "string" ? erro.detalhes["campo"] : null;
  // Só substitui a mensagem genérica do gateway; mensagens do próprio painel já explicam.
  if (campo && erro.message === MENSAGEM_PADRAO[erro.codigo]) {
    const ajuda = AJUDA_POR_CAMPO[campo];
    if (ajuda) return ajuda;
    if (campo !== "corpo") return `${erro.message} Campo: ${campo}.`;
  }
  return erro.message;
}

const CAMPOS_TELEFONE = new Set(["contatos_permitidos", "alerta_telefone"]);

/**
 * 400 de telefone na ficha (piloto ou alerta): a frase do gateway, presa ao campo.
 * Se o envelope vier só com o texto genérico, usa a mesma frase fixa do TEL1.
 */
export function erroDeTelefone(erro: GatewayErro): { campo: string; mensagem: string } | null {
  if (erro.status !== 400) return null;
  const campo = typeof erro.detalhes["campo"] === "string" ? erro.detalhes["campo"] : "";
  if (!CAMPOS_TELEFONE.has(campo)) return null;
  const propria = erro.message.trim();
  const mensagem =
    propria && propria !== MENSAGEM_PADRAO[erro.codigo]
      ? propria
      : (AJUDA_POR_CAMPO[campo] ?? propria);
  if (!mensagem || mensagem.length > 200) return null;
  return { campo, mensagem };
}
