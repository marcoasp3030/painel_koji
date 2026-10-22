/**
 * Palavras que aparecem na tela para os conceitos do gateway. Nada de nomes
 * técnicos para o usuário: toda tela usa estes rótulos e ajudas.
 */

export type Tom = "neutro" | "sucesso" | "alerta" | "roxo" | "perigo";

export const SITUACAO_AGENTE: Record<string, { rotulo: string; tom: Tom }> = {
  ativo: { rotulo: "Ativo", tom: "sucesso" },
  pausado: { rotulo: "Pausado", tom: "alerta" },
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
};

/** agente_mode */
export const RESPOSTAS: Record<string, string> = {
  mock: "Simulação",
  live: "IA real (Skyone)",
};

/** send_mode */
export const ENVIO: Record<string, string> = {
  dry: "Em teste",
  live: "Real",
};

export const TIPO_CANAL: Record<string, string> = {
  api: "API (para testes)",
  uazapi: "WhatsApp (Uazapi)",
  meta: "WhatsApp oficial (Meta)",
  site: "Site",
  email: "E-mail",
  teams: "Teams",
  luxbrain: "Luxbrain",
};

export const PUBLICO_CANAL: Record<string, string> = {
  clientes: "Clientes",
  interno: "Equipe interna",
};

export const ESCOPO: Record<string, { rotulo: string; ajuda: string }> = {
  conversar: {
    rotulo: "Enviar mensagens",
    ajuda: "O sistema envia mensagens de clientes ao agente.",
  },
  "eventos:ler": { rotulo: "Ler histórico", ajuda: "O sistema lê o histórico das conversas." },
  notificar: {
    rotulo: "Pedir avisos ao agente",
    ajuda: "O sistema pede ao agente que avise o cliente (ex.: pedido saiu).",
  },
  "ferramentas:catalogo": {
    rotulo: "Buscar no catálogo",
    ajuda: "Consulta ao catálogo, quando o módulo estiver ligado na empresa.",
  },
  callback: { rotulo: "Resposta assíncrona (em breve)", ajuda: "Ainda não disponível no gateway." },
  "documentos:enviar": {
    rotulo: "Enviar documentos",
    ajuda:
      "O sistema manda boleto, nota ou comprovante para leitura. Vale em servidor ou n8n — o navegador é recusado.",
  },
};

/** De onde vem o valor herdado de um campo do agente (origem_config). */
export const ORIGEM_VALOR: Record<string, string> = {
  plataforma: "da plataforma",
  modelo: "do modelo",
  tenant: "da empresa",
  agente: "deste agente",
};

/** Quem escreveu cada mensagem (origem do histórico do gateway). */
export const ORIGEM_MENSAGEM: Record<string, string> = {
  cliente: "Cliente",
  bot: "IA",
  humano: "Atendente",
  sistema: "Sistema",
};

type Campo = { rotulo: string; ajuda: string };

/** Campos do agente que aparecem nas telas. */
export const CAMPO_AGENTE = {
  nome: { rotulo: "Nome", ajuda: "Como o agente aparece no painel." },
  status: {
    rotulo: "Situação",
    ajuda: "Ativo responde às mensagens; Pausado e Rascunho ignoram as mensagens recebidas.",
  },
  aviso_demora: {
    rotulo: "Mensagem se demorar",
    ajuda: "Enviada quando a resposta demora mais que o tempo abaixo.",
  },
  slow_notice_s: {
    rotulo: "Avisar demora depois de (segundos)",
    ajuda: "Tempo até mandar a mensagem acima.",
  },
  fallback: {
    rotulo: "Mensagem se der erro",
    ajuda: "Enviada quando o agente não consegue responder.",
  },
  debounce_s: {
    rotulo: "Esperar o cliente terminar de digitar (segundos)",
    ajuda: "Junta mensagens enviadas em sequência antes de responder. De 1 a 15.",
  },
  max_wait_s: {
    rotulo: "Espera máxima para responder (segundos)",
    ajuda: "Mesmo que o cliente continue escrevendo, o agente responde depois disso. Até 30.",
  },
  pause_minutes: {
    rotulo: "Quando um atendente assumir, o robô fica pausado por (minutos)",
    ajuda: "Depois desse tempo o robô volta a responder sozinho.",
  },
  modo_piloto: {
    rotulo: "Responder só a alguns contatos",
    ajuda: "Para testar com poucas pessoas antes de liberar para todos.",
  },
  contatos_permitidos: {
    rotulo: "Contatos do piloto",
    ajuda: "Um telefone por linha, só números com DDD.",
  },
  alerta_telefone: {
    rotulo: "Telefone para alertas",
    ajuda: "Recebe aviso quando o agente falha. Só números, com DDD.",
  },
  agente_mode: {
    rotulo: "Respostas",
    ajuda: "Simulação responde sem chamar a IA; IA real chama o fluxo no Skyone.",
  },
  skyone_webhook_url: {
    rotulo: "URL do fluxo",
    ajuda: "Crie o fluxo do zero no Skyone e copie a URL do webhook (https://…).",
  },
  skyone_auth_usuario: { rotulo: "Usuário", ajuda: "Gerado pelo Skyone: flow-<id>@luxtia." },
  skyone_auth: {
    rotulo: "Senha",
    ajuda: "Definida por você no Skyone. Fica guardada cifrada; o painel nunca a mostra.",
  },
  timeout_s: {
    rotulo: "Tempo limite (segundos)",
    ajuda: "Quanto esperar a resposta do Skyone. Padrão 90.",
  },
  instrucoes_agente: {
    rotulo: "Instruções complementares",
    ajuda: "Texto enviado ao fluxo junto com cada mensagem.",
  },
} satisfies Record<string, Campo>;

export const CAMPO_EMPRESA = {
  nome: { rotulo: "Nome", ajuda: "Como a empresa aparece no painel." },
  id: { rotulo: "Identificador", ajuda: "Usado nos endereços e integrações. Não muda depois." },
  plano: { rotulo: "Plano", ajuda: "Nome do plano contratado, só para referência." },
  limite_turnos_mes: {
    rotulo: "Limite de atendimentos por mês",
    ajuda: "Avisamos em 80% e 100%; o atendimento não é cortado. Vazio: sem limite.",
  },
  timezone: {
    rotulo: "Fuso horário",
    ajuda: "Usado nos horários das unidades e na contagem do mês. Ex.: America/Sao_Paulo.",
  },
  retencao_dias: {
    rotulo: "Guardar conversas por (dias)",
    ajuda: "Depois desse prazo as conversas antigas podem ser apagadas.",
  },
  tenant_teste: {
    rotulo: "Empresa de teste",
    ajuda: "Permite usar a IA real sem senha do Skyone. Não use para clientes reais.",
  },
  vinculo: {
    rotulo: "Cliente do painel",
    ajuda: "Quem entra no painel por esse cliente vê só esta empresa.",
  },
} satisfies Record<string, Campo>;

export const CAMPO_CANAL = {
  tipo: {
    rotulo: "Tipo",
    ajuda:
      "API serve para testar pelo Simular ou ligar um sistema; WhatsApp conecta um número pela Uazapi.",
  },
  publico: { rotulo: "Quem conversa", ajuda: "Clientes da empresa ou a equipe interna." },
  nome: { rotulo: "Nome", ajuda: "Só para você reconhecer o canal. Ex.: WhatsApp loja centro." },
  agente: {
    rotulo: "Agente que responde",
    ajuda: "As mensagens deste canal vão para este agente.",
  },
  base_url: {
    rotulo: "Endereço da instância",
    ajuda: "Endereço da sua instância na Uazapi (https://…).",
  },
  token: { rotulo: "Token da instância", ajuda: "Fica guardado cifrado; o painel nunca o mostra." },
  ativo: {
    rotulo: "Ativar agora",
    ajuda:
      "Canal desativado não responde às mensagens recebidas. Ative depois de cadastrar a URL no provedor.",
  },
} satisfies Record<string, Campo>;

export const CAMPO_CHAVE = {
  nome: {
    rotulo: "Nome",
    ajuda: "Para reconhecer quem usa a chave. Ex.: sistema de pedidos.",
  },
  agente: {
    rotulo: "Restringir a um agente",
    ajuda: "A chave só funciona nas conversas deste agente.",
  },
  validade: { rotulo: "Validade", ajuda: "Vazio: a chave não expira." },
  ips: {
    rotulo: "Endereços IP permitidos",
    ajuda: "Um por linha (ex.: 200.10.20.0/24). Vazio: qualquer endereço.",
  },
} satisfies Record<string, Campo>;
