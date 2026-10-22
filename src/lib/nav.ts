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
    papeis: ["admin", "membro"],
  },
  {
    to: "/ia/configuracoes/avisos",
    label: "Avisos de pedido",
    grupo: "Configurações",
    icone: "pedidos",
    papeis: ["admin"],
    tela: "avisos_de_pedido",
  },
  {
    to: "/ia/unidades",
    label: "Unidades e horários",
    grupo: "Agentes",
    icone: "empresas",
    papeis: ["admin", "membro"],
  },
  {
    to: "/ia/cardapio",
    label: "Cardápio",
    grupo: "Agentes",
    icone: "pedidos",
    papeis: ["admin", "membro"],
    tela: "cardapio",
  },
  {
    to: "/ia/gestao/alteracoes",
    label: "Histórico de gestão",
    grupo: "Agentes",
    icone: "conversas",
    papeis: ["admin"],
  },
  {
    to: "/ia/conversas",
    label: "Conversas",
    grupo: "Agentes",
    icone: "conversas",
    papeis: ["admin", "membro"],
  },
  {
    to: "/ia/pedidos",
    label: "Pedidos",
    grupo: "Agentes",
    icone: "pedidos",
    papeis: ["admin", "membro"],
    tela: "pedidos",
  },
  {
    to: "/ia/agentes",
    label: "Agentes",
    grupo: "Agentes",
    icone: "agentes",
    papeis: ["admin", "membro"],
  },
  {
    to: "/ia/canais",
    label: "Canais",
    grupo: "Agentes",
    icone: "canais",
    papeis: ["admin", "membro"],
  },
  {
    to: "/ia/simular",
    label: "Simular conversa",
    grupo: "Agentes",
    icone: "simular",
    papeis: ["admin"],
  },
];

export const ADMIN_NAV: ItemMenu[] = [
  { to: "/admin", label: "Clientes", grupo: "Operação", icone: "clientes" },
  ...AGENTES_PLATAFORMA,
];

export const TENANT_NAV: ItemMenu[] = [
  { to: "/equipe", label: "Equipe", grupo: "Operação", icone: "equipe" },
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
