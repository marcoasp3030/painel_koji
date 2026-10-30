/** Respostas fictícias. A prévia não fala com o gateway nem grava pagamento. */
const agora = "2026-10-29T22:10:00-03:00";
const situacao = {
  aberta_agora: true,
  motivo: null,
  fecha_as: null,
  proxima_abertura: null,
  pausada_ate: null,
};
const unidade = {
  id: "uni_morumbi",
  nome: "Morumbi",
  codigo: "morumbi",
  endereco: "Av. Exemplo, 100",
  telefone: null,
  ativo: true,
  fuso: "America/Sao_Paulo",
  fuso_efetivo: "America/Sao_Paulo",
  cidade: "São Paulo",
  uf: "SP",
  situacao,
};

const pagamentos = {
  itens: [
    {
      codigo: "pix",
      rotulo: "Pix",
      ativo: true,
      aceita_troco: false,
      instrucoes: null,
    },
    {
      codigo: "dinheiro",
      rotulo: "Dinheiro",
      ativo: true,
      aceita_troco: true,
      instrucoes: null,
    },
    {
      codigo: "cartao_entrega",
      rotulo: "Cartão na entrega",
      ativo: false,
      aceita_troco: false,
      instrucoes: null,
    },
  ],
  sugestoes: [
    { codigo: "pix", rotulo: "Pix" },
    { codigo: "cartao_entrega", rotulo: "Cartão na entrega" },
    { codigo: "dinheiro", rotulo: "Dinheiro" },
    { codigo: "vale_refeicao", rotulo: "Vale-refeição" },
    { codigo: "pagamento_online", rotulo: "Pagamento online" },
  ],
};

function pedido(
  numero: string,
  pagamento: { forma: string; rotulo: string; troco_para: number | null; troco: number | null } | null,
  status: string,
) {
  return {
    id: Number(numero),
    numero,
    status,
    modalidade: "delivery",
    unidade: "morumbi",
    unidade_nome: "Morumbi",
    origem: "real",
    canal: "whatsapp",
    cliente: { nome: "Ana Lima", telefone: "11912345678", canal: null },
    conversation_id: null,
    numero_itens: 2,
    total: 42,
    previsao_min: null,
    criado_em: agora,
    atualizado_em: agora,
    horario: "19:30",
    aviso: { status: "enviado" },
    pagamento,
    itens: [
      { codigo: "temaki", nome: "Temaki", quantidade: 2, subtotal: 36, observacao: null, alcoolico: false },
    ],
    subtotal: 36,
    taxa_entrega: 6,
    observacao: null,
    endereco: "Rua Exemplo, 20",
    motivo: null,
    status_descricao: null,
    entrega: {
      modalidade: "delivery",
      endereco: "Rua Exemplo, 20",
      horario: "19:30",
      observacao: null,
    },
    proximos_status: ["confirmado"],
    linha_do_tempo: [],
  };
}

const pedidosLista = [
  pedido("1042", { forma: "dinheiro", rotulo: "Dinheiro", troco_para: 50, troco: 8 }, "aguardando_loja"),
  pedido("1041", { forma: "pix", rotulo: "Pix", troco_para: null, troco: null }, "confirmado"),
  pedido("900", null, "concluido"),
];

export async function gestao({ data }: { data: { acao?: string } }) {
  if (data.acao === "listar") return { ok: true, dados: { itens: [unidade] } };
  if (data.acao === "obter" || data.acao === "agenda")
    return { ok: true, dados: data.acao === "agenda" ? { fuso: "America/Sao_Paulo", situacao, dias: [] } : unidade };
  if (data.acao === "pagamentos") return { ok: true, dados: pagamentos };
  if (data.acao === "fuso_empresa")
    return { ok: true, dados: { timezone: "America/Sao_Paulo", origem: "empresa" } };
  return { ok: true, dados: {} };
}

export async function pedidos({ data }: { data: { acao?: string; numero?: string } }) {
  if (data.acao === "contagem") {
    return {
      ok: true,
      dados: {
        aguardando_loja: { total: 0, mais_antigo_em: agora, por_unidade: [] },
        em_andamento: { confirmado: 1, em_preparo: 0, pronto_retirada: 0, saiu_entrega: 0 },
        avisos_com_falha: 0,
      },
    };
  }
  if (data.acao === "detalhe") {
    const item = pedidosLista.find((p) => p.numero === data.numero) ?? pedidosLista[0];
    return { ok: true, dados: item };
  }
  return { ok: true, dados: { itens: pedidosLista, proximo_cursor: null } };
}

export async function avisos() {
  return { ok: true, dados: {} };
}

export async function obterModulosEmpresa() {
  return { em_uso: ["pedidos"], telas: ["pedidos", "unidades"] };
}

async function vazio() {
  return { ok: true, dados: {} };
}

export const listarEmpresasGateway = vazio;
export const obterAcessoGateway = vazio;
export const gerirAtendimentos = vazio;
export const cancelarFollowUps = vazio;
export const listarFollowUps = vazio;
export const reativarOptOut = vazio;
export const listarAgentes = vazio;
export const listarCanais = vazio;
export const historicoConversa = vazio;
export const acompanharConversas = vazio;
export const atenderConversa = vazio;
export const editarNomeContato = vazio;
export const listarConversas = vazio;
export const obterCursorEventos = vazio;
