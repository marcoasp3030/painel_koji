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
  | "operacao"
  | "modelos"
  | "configuracoes"
  | "unidades"
  | "cardapio"
  | "avisos"
  | "historico"
  | "comportamento"
  | "formulario"
  | "aparencia";

export type ItemMenu = {
  to: string;
  label: string;
  grupo: "Atendimento" | "Loja" | "Agente" | "Integrações" | "Gestão";
  icone: IconeMenu;
  /** Papéis no gateway que veem o item; sem a lista, todos veem. */
  papeis?: PapelGateway[];
  /** Só aparece se a empresa tiver essa tela nos módulos em uso (MULTI1-a). */
  tela?: TelaModulo;
};

const AGENTES_PLATAFORMA: ItemMenu[] = [
  {
    to: "/ia/conversas",
    label: "Conversas",
    grupo: "Atendimento",
    icone: "conversas",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/pedidos",
    label: "Pedidos",
    grupo: "Atendimento",
    icone: "pedidos",
    papeis: ["plataforma"],
    tela: "pedidos",
  },
  {
    to: "/ia/operacao",
    label: "Operação",
    grupo: "Atendimento",
    icone: "operacao",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/cardapio",
    label: "Cardápio",
    grupo: "Loja",
    icone: "cardapio",
    papeis: ["plataforma"],
    tela: "cardapio",
  },
  {
    to: "/ia/unidades",
    label: "Unidades e horários",
    grupo: "Loja",
    icone: "unidades",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/configuracoes/avisos",
    label: "Avisos de pedido",
    grupo: "Loja",
    icone: "avisos",
    papeis: ["plataforma"],
    tela: "avisos_de_pedido",
  },
  {
    to: "/ia/configuracoes/aparencia",
    label: "Aparência do cardápio",
    grupo: "Loja",
    icone: "aparencia",
    papeis: ["plataforma"],
    tela: "cardapio",
  },
  {
    to: "/ia/agentes",
    label: "Agentes",
    grupo: "Agente",
    icone: "agentes",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/configuracoes/comportamento",
    label: "Comportamento do agente",
    grupo: "Agente",
    icone: "comportamento",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/documentos",
    label: "Documentos",
    grupo: "Agente",
    icone: "documentos",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/simular",
    label: "Simular conversa",
    grupo: "Agente",
    icone: "simular",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/modelos",
    label: "Modelos de agente",
    grupo: "Agente",
    icone: "modelos",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/canais",
    label: "Canais",
    grupo: "Integrações",
    icone: "canais",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/chaves",
    label: "Chaves de API",
    grupo: "Integrações",
    icone: "chaves",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/chaves-formulario",
    label: "Chaves de formulário",
    grupo: "Integrações",
    icone: "formulario",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/webhooks-saida",
    label: "Webhooks de saída",
    grupo: "Integrações",
    icone: "webhooks",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/empresas",
    label: "Empresas",
    grupo: "Gestão",
    icone: "empresas",
    papeis: ["plataforma"],
  },
  {
    to: "/ia/gestao/alteracoes",
    label: "Histórico de gestão",
    grupo: "Gestão",
    icone: "historico",
    papeis: ["plataforma"],
  },
];

const AGENTES_EMPRESA: ItemMenu[] = [
  {
    to: "/ia/conversas",
    label: "Conversas",
    grupo: "Atendimento",
    icone: "conversas",
    papeis: ["gestor", "supervisor", "funcionario"],
  },
  {
    to: "/ia/pedidos",
    label: "Pedidos",
    grupo: "Atendimento",
    icone: "pedidos",
    papeis: ["gestor", "supervisor", "funcionario"],
    tela: "pedidos",
  },
  {
    to: "/ia/operacao",
    label: "Operação",
    grupo: "Atendimento",
    icone: "operacao",
    papeis: ["gestor", "supervisor"],
  },
  {
    to: "/ia/cardapio",
    label: "Cardápio",
    grupo: "Loja",
    icone: "cardapio",
    papeis: ["gestor", "supervisor", "funcionario"],
    tela: "cardapio",
  },
  {
    to: "/ia/unidades",
    label: "Unidades e horários",
    grupo: "Loja",
    icone: "unidades",
    papeis: ["gestor", "supervisor"],
  },
  {
    to: "/ia/configuracoes/avisos",
    label: "Avisos de pedido",
    grupo: "Loja",
    icone: "avisos",
    papeis: ["gestor", "supervisor"],
    tela: "avisos_de_pedido",
  },
  {
    to: "/ia/configuracoes/aparencia",
    label: "Aparência do cardápio",
    grupo: "Loja",
    icone: "aparencia",
    papeis: ["gestor"],
    tela: "cardapio",
  },
  {
    to: "/ia/agentes",
    label: "Agentes",
    grupo: "Agente",
    icone: "agentes",
    papeis: ["gestor", "supervisor"],
  },
  {
    to: "/ia/configuracoes/comportamento",
    label: "Comportamento do agente",
    grupo: "Agente",
    icone: "comportamento",
    papeis: ["gestor", "supervisor"],
  },
  {
    to: "/ia/documentos",
    label: "Documentos",
    grupo: "Agente",
    icone: "documentos",
    papeis: ["gestor"],
  },
  {
    to: "/ia/simular",
    label: "Simular conversa",
    grupo: "Agente",
    icone: "simular",
    papeis: ["gestor", "supervisor"],
  },
  {
    to: "/ia/canais",
    label: "Canais",
    grupo: "Integrações",
    icone: "canais",
    papeis: ["gestor"],
  },
  {
    to: "/ia/chaves-formulario",
    label: "Chaves de formulário",
    grupo: "Integrações",
    icone: "formulario",
    papeis: ["gestor"],
  },
  {
    to: "/ia/webhooks-saida",
    label: "Webhooks de saída",
    grupo: "Integrações",
    icone: "webhooks",
    papeis: ["gestor"],
  },
  {
    to: "/ia/gestao/alteracoes",
    label: "Histórico de gestão",
    grupo: "Gestão",
    icone: "historico",
    papeis: ["gestor", "supervisor"],
  },
];

/** O super admin começa pelos clientes; a empresa, pelo atendimento do dia. */
const primeiroGestao = (itens: ItemMenu[]) => [
  ...itens.filter((item) => item.grupo === "Gestão"),
  ...itens.filter((item) => item.grupo !== "Gestão"),
];

export const ADMIN_NAV: ItemMenu[] = primeiroGestao([
  { to: "/admin", label: "Clientes", grupo: "Gestão", icone: "clientes" },
  {
    to: "/equipe",
    label: "Usuários",
    grupo: "Gestão",
    icone: "equipe",
    papeis: ["plataforma"],
  },
  {
    to: "/admin/configuracoes",
    label: "Configurações",
    grupo: "Gestão",
    icone: "configuracoes",
  },
  ...AGENTES_PLATAFORMA,
]);

export const TENANT_NAV: ItemMenu[] = [
  ...AGENTES_EMPRESA,
  {
    to: "/equipe",
    label: "Usuários",
    grupo: "Gestão",
    icone: "equipe",
    papeis: ["gestor", "supervisor"],
  },
];

/** Menu conforme o papel no gateway (a proteção real é a do servidor). */
export function filtrarMenu(itens: ItemMenu[], papel: PapelGateway | null | undefined) {
  return itens.filter((item) => !item.papeis || (papel != null && item.papeis.includes(papel)));
}

/**
 * Esconde Cardápio/Pedidos/Avisos quando o módulo correspondente não está em uso.
 * `null`/`undefined` = ainda sem resposta: mantém itens com `tela` (não esconde).
 * Array (mesmo vazio) = resposta chegou: só libera o que estiver na lista.
 */
export function filtrarMenuPorTelas(
  itens: ItemMenu[],
  telas: readonly string[] | null | undefined,
) {
  if (telas == null) return itens;
  const liberadas = new Set(telas);
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
