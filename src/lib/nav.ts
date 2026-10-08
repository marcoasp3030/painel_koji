/** Itens do menu lateral, agrupados para o super admin e para o cliente. */

export type IconeMenu = "clientes" | "equipe";

export type ItemMenu = {
  to: string;
  label: string;
  grupo: "Operação";
  icone: IconeMenu;
};

export const ADMIN_NAV: ItemMenu[] = [
  { to: "/admin", label: "Clientes", grupo: "Operação", icone: "clientes" },
];

export const TENANT_NAV: ItemMenu[] = [
  { to: "/equipe", label: "Equipe", grupo: "Operação", icone: "equipe" },
];

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
