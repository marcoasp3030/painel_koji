/** Formatos das respostas do gateway usados pelas telas (sem segredos). */

export type PapelGateway = "plataforma" | "gestor" | "supervisor" | "funcionario";

export type Pagina<T> = { itens: T[]; proximo_cursor: string | null };

export type EmpresaGateway = {
  id: string;
  nome: string;
  status: "ativo" | "suspenso";
  plano: string | null;
  limite_turnos_mes: number | null;
  timezone: string;
  retencao_dias: number | null;
  tenant_teste: boolean;
  criado_em: string;
};

export type EmpresaPainel = {
  id: string;
  name: string;
  slug: string;
  status: string;
  gateway_tenant_id: string | null;
};

export type CanalResumo = { id: string; tipo: string; ativo: boolean };

export type AgenteGateway = {
  id: string;
  tenant_id: string;
  modelo_id: string;
  modelo_versao: number;
  nome: string;
  status: "rascunho" | "ativo" | "pausado";
  provedor: "mock" | "skyone";
  skyone_estrategia: string | null;
  skyone_webhook_url: string | null;
  skyone_auth_tipo: "nenhuma" | "cabecalho" | "bearer" | "basic";
  skyone_auth_configurado?: boolean;
  skyone_auth_usuario_configurado?: boolean;
  timeout_s: number | null;
  instrucoes_agente: string | null;
  debounce_s: number | null;
  max_wait_s: number | null;
  pause_minutes: number | null;
  slow_notice_s: number | null;
  aviso_demora: string | null;
  fallback: string | null;
  alerta_telefone: string | null;
  send_mode: "dry" | "live" | null;
  agente_mode: "mock" | "live" | null;
  modo_piloto: boolean | null;
  contatos_permitidos: string[] | null;
  circuito_estado?: "fechado" | "aberto" | "meio_aberto";
  canais?: CanalResumo[];
};

export type Json = string | number | boolean | null | Json[] | { [chave: string]: Json };

export type AgenteDetalhe = AgenteGateway & {
  configuracao_efetiva?: Record<string, Json>;
};

/** Item das listas motivos_transferencia / tipos_solicitacao do modelo. */
export type ItemRotulado = {
  id: string;
  rotulo: string;
  /** Motivo que vira aviso à equipe em vez de pausar o bot. */
  converte_em_solicitacao?: boolean;
};

/** Resumo mínimo retornado em listagens que não precisam de todos os campos. */
export type ModeloAgente = { id: string; versao: number; nome: string; tenant_id: string | null };

/** Modelo completo retornado por GET /modelos-agente e GET /modelos-agente/{id} (§10.2). */
export type ModeloAgenteCompleto = ModeloAgente & {
  tipo: "atendimento" | "interno";
  segmento: string;
  ativo: boolean;
  skyone_ref: string | null;
  modulos_permitidos: string[];
  modulos_padrao: string[];
  /** Sinônimo de modulos_permitidos (campo antigo). */
  modulos: string[];
  motivos_transferencia: ItemRotulado[];
  tipos_solicitacao: ItemRotulado[];
  comportamento_padrao: Record<string, Json>;
  perfil_padrao: Record<string, Json>;
  desfechos: Json[];
  followups_padrao: Json[];
  skyone_fluxo_modelo: string | null;
  criado_em: string;
};

export type ResultadoTeste = { ok: boolean; latencia_ms: number; resposta: string[] };

/** Resultado do cadastro do webhook na instância uazapi (MULTI1-a §10.7). */
export type WebhookUazapi = {
  registrado: boolean;
  motivo?:
    | "sem_credenciais"
    | "provedor_recusou"
    | "provedor_inacessivel"
    | "endereco_publico_ausente"
    | string;
};

export type CanalGateway = {
  id: string;
  tenant_id: string;
  tipo: "uazapi" | "meta" | "site" | "email" | "teams" | "luxbrain" | "api";
  nome: string;
  agente_id: string | null;
  publico: "clientes" | "interno";
  ativo: boolean;
  webhook_secret_configurado?: boolean;
  credenciais_configurado?: boolean;
  status_conexao?: string | null;
  ultimo_evento_em?: string | null;
  webhook_uazapi?: WebhookUazapi;
};

export type ChaveGateway = {
  id: string;
  nome: string;
  escopos: string[];
  agente_id: string | null;
  expira_em: string | null;
  ips_permitidos: string[] | null;
  ultimo_uso_em: string | null;
  criado_em: string;
  revogada_em: string | null;
};

export type MensagemGateway = {
  id: number;
  conteudo: string | null;
  direcao: "entrada" | "saida";
  origem: string;
  enviada_em: string | null;
};

export type ResultadoSimulacao = {
  ok: boolean;
  duplicada: boolean;
  conversation_id: string;
  mensagem_id: number;
};

export type CircuitoAgente = {
  estado: "fechado" | "aberto" | "meio_aberto";
  falhas: number;
  aberto_ate: string | null;
  ultimo_alerta: string | null;
};
