/** Itens do menu lateral, agrupados para o super admin e para o cliente. */
import type { TelaModulo } from "./gateway/modulos";
import type { PapelGateway } from "./gateway/tipos";

export type IconeMenu =
  | "clientes"
  | "equipe"
  | "empresas"
  | "agentes"
  | "canais"
  | "chaves"
  | "documentos"
  | "webhooks"
  | "simular"
  | "conversas"
  | "pedidos"
  | "modelos";

export type ItemMenu = {
  to: string;
  label: string;
  grupo: "Operação" | "Agentes" | "Configurações";
  icone: IconeMenu;
  /** Papéis no gateway que veem o item; sem a lista, todos veem. */
  papeis?: PapelGateway[];
  /** Só aparece se a empresa tiver essa tela nos módulos em uso (MULTI1-a). */
  tela?: TelaModulo;
};

const AGENTES_PLATAFORMA: ItemMenu[] = [
  {
    to: "/ia/configuracoes/comportamento",
    label: "Comportamento do agente",
    grupo: "Configurações",
    icone: "agentes",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/configuracoes/avisos",
    label: "Avisos de pedido",
    grupo: "Configurações",
    icone: "pedidos",
    papeis: ["plataforma"],
    tela: "avisos_de_pedido",
  },
  {
    to: "/ia/unidades",
    label: "Unidades e horários",
    grupo: "Agentes",
    icone: "empresas",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/cardapio",
    label: "Cardápio",
    grupo: "Agentes",
    icone: "pedidos",
    papeis: ["plataforma"],
    tela: "cardapio",
  },
  {
    to: "/ia/gestao/alteracoes",
    label: "Histórico de gestão",
    grupo: "Agentes",
    icone: "conversas",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/conversas",
    label: "Conversas",
    grupo: "Agentes",
    icone: "conversas",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/pedidos",
    label: "Pedidos",
    grupo: "Agentes",
    icone: "pedidos",
    papeis: ["plataforma"],
    tela: "pedidos",
  },
  {
    to: "/ia/empresas",
    label: "Empresas",
    grupo: "Agentes",
    icone: "empresas",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/modelos",
    label: "Modelos de agente",
    grupo: "Agentes",
    icone: "modelos",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/agentes",
    label: "Agentes",
    grupo: "Agentes",
    icone: "agentes",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/canais",
    label: "Canais",
    grupo: "Agentes",
    icone: "canais",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/chaves",
    label: "Chaves de API",
    grupo: "Agentes",
    icone: "chaves",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/chaves-formulario",
    label: "Chaves de formulário",
    grupo: "Agentes",
    icone: "chaves",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/documentos",
    label: "Documentos",
    grupo: "Agentes",
    icone: "documentos",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/webhooks-saida",
    label: "Webhooks de saída",
    grupo: "Configurações",
    icone: "webhooks",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/simular",
    label: "Simular conversa",
    grupo: "Agentes",
    icone: "simular",
    papeis: ["plataforma"],
  },
];

const AGENTES_EMPRESA: ItemMenu[] = [
  {
    to: "/ia/configuracoes/comportamento",
    label: "Comportamento do agente",
    grupo: "Configurações",
    icone: "agentes",
    papeis: ["gestor", "supervisor"],
  },
  {
    to: "/ia/configuracoes/avisos",
    label: "Avisos de pedido",
    grupo: "Configurações",
    icone: "pedidos",
    papeis: ["gestor", "supervisor"],
    tela: "avisos_de_pedido",
  },
  {
    to: "/ia/unidades",
    label: "Unidades e horários",
    grupo: "Agentes",
    icone: "empresas",
    papeis: ["gestor", "supervisor"],
  },
  {
    to: "/ia/cardapio",
    label: "Cardápio",
    grupo: "Agentes",
    icone: "pedidos",
    papeis: ["gestor", "supervisor", "funcionario"],
    tela: "cardapio",
  },
  {
    to: "/ia/gestao/alteracoes",
    label: "Histórico de gestão",
    grupo: "Agentes",
    icone: "conversas",
    papeis: ["gestor", "supervisor", "funcionario"],
  },
  {
    to: "/ia/conversas",
    label: "Conversas",
    grupo: "Agentes",
    icone: "conversas",
    papeis: ["gestor", "supervisor", "funcionario"],
  },
  {
    to: "/ia/pedidos",
    label: "Pedidos",
    grupo: "Agentes",
    icone: "pedidos",
    papeis: ["gestor", "supervisor", "funcionario"],
    tela: "pedidos",
  },
  {
    to: "/ia/agentes",
    label: "Agentes",
    grupo: "Agentes",
    icone: "agentes",
    papeis: ["gestor", "supervisor"],
  },
  {
    to: "/ia/canais",
    label: "Canais",
    grupo: "Agentes",
    icone: "canais",
    papeis: ["gestor"],
  },
  {
    to: "/ia/chaves-formulario",
    label: "Chaves de formulário",
    grupo: "Agentes",
    icone: "chaves",
    papeis: ["gestor"],
  },
  {
    to: "/ia/documentos",
    label: "Documentos",
    grupo: "Agentes",
    icone: "documentos",
    papeis: ["gestor"],
  },
  {
    to: "/ia/webhooks-saida",
    label: "Webhooks de saída",
    grupo: "Configurações",
    icone: "webhooks",
    papeis: ["gestor"],
  },
  {
    to: "/ia/simular",
    label: "Simular conversa",
    grupo: "Agentes",
    icone: "simular",
    papeis: ["gestor", "supervisor"],
  },
];

export const ADMIN_NAV: ItemMenu[] = [
  { to: "/admin", label: "Clientes", grupo: "Operação", icone: "clientes" },
  {
    to: "/equipe",
    label: "Usuários",
    grupo: "Operação",
    icone: "equipe",
    papeis: ["plataforma"],
  },
  ...AGENTES_PLATAFORMA,
];

export const TENANT_NAV: ItemMenu[] = [
  { to: "/equipe", label: "Usuários", grupo: "Operação", icone: "equipe", papeis: ["gestor", "supervisor"] },
  ...AGENTES_EMPRESA,
];

/** Menu conforme o papel no gateway (a proteção real é a do servidor). */
export function filtrarMenu(itens: ItemMenu[], papel: PapelGateway | null | undefined) {
  return itens.filter((item) => !item.papeis || (papel != null && item.papeis.includes(papel)));
}

/** Esconde Cardápio/Pedidos/Avisos quando o módulo correspondente não está em uso. */
export function filtrarMenuPorTelas(
  itens: ItemMenu[],
  telas: readonly string[] | null | undefined,
) {
  const liberadas = new Set(telas ?? []);
  return itens.filter((item) => !item.tela || liberadas.has(item.tela));
}

/** Mantém a ordem em que os grupos aparecem na lista. */
export function agruparMenu(itens: ItemMenu[]) {
  const grupos: { nome: ItemMenu["grupo"]; itens: ItemMenu[] }[] = [];
  for (const item of itens) {
    const existente = grupos.find((grupo) => grupo.nome === item.grupo);
    if (existente) existente.itens.push(item);
    else grupos.push({ nome: item.grupo, itens: [item] });
  }
  return grupos;
}
