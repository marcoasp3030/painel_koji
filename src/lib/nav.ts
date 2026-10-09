/** Itens do menu lateral, agrupados para o super admin e para o cliente. */
import type { PapelGateway } from "./gateway/tipos";

export type IconeMenu = "clientes" | "equipe" | "empresas" | "agentes" | "canais" | "chaves" | "simular";

export type ItemMenu = {
  to: string;
  label: string;
  grupo: "Operação" | "Agentes";
  icone: IconeMenu;
  /** Papéis no gateway que veem o item; sem a lista, todos veem. */
  papeis?: PapelGateway[];
};

const AGENTES_PLATAFORMA: ItemMenu[] = [
  { to: "/gateway/empresas", label: "Empresas", grupo: "Agentes", icone: "empresas", papeis: ["plataforma"] },
  { to: "/gateway/agentes", label: "Agentes", grupo: "Agentes", icone: "agentes", papeis: ["plataforma"] },
  { to: "/gateway/canais", label: "Canais", grupo: "Agentes", icone: "canais", papeis: ["plataforma"] },
  { to: "/gateway/chaves", label: "Chaves de API", grupo: "Agentes", icone: "chaves", papeis: ["plataforma"] },
  { to: "/gateway/simular", label: "Simular conversa", grupo: "Agentes", icone: "simular", papeis: ["plataforma"] },
];

const AGENTES_EMPRESA: ItemMenu[] = [
  { to: "/gateway/agentes", label: "Agentes", grupo: "Agentes", icone: "agentes", papeis: ["admin", "membro"] },
  { to: "/gateway/canais", label: "Canais", grupo: "Agentes", icone: "canais", papeis: ["admin", "membro"] },
  { to: "/gateway/simular", label: "Simular conversa", grupo: "Agentes", icone: "simular", papeis: ["admin"] },
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
