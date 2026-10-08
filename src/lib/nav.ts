/** Itens do menu lateral, agrupados para o super admin e para o cliente. */

export type IconeMenu = "clientes" | "integracoes" | "ifood" | "food99" | "equipe" | "auditoria";

export type ItemMenu = {
  to: string;
  label: string;
  grupo: "Operação" | "Diagnóstico" | "Governança";
  icone: IconeMenu;
};

export const ADMIN_NAV: ItemMenu[] = [
  { to: "/admin", label: "Clientes", grupo: "Operação", icone: "clientes" },
  { to: "/integracoes", label: "Integrações", grupo: "Operação", icone: "integracoes" },
  { to: "/ifood-debug", label: "Debug iFood", grupo: "Diagnóstico", icone: "ifood" },
  { to: "/99food-debug", label: "Debug 99Food", grupo: "Diagnóstico", icone: "food99" },
  { to: "/auditoria", label: "Auditoria", grupo: "Governança", icone: "auditoria" },
];

export const TENANT_NAV: ItemMenu[] = [
  { to: "/integracoes", label: "Integrações", grupo: "Operação", icone: "integracoes" },
  { to: "/equipe", label: "Equipe", grupo: "Operação", icone: "equipe" },
  { to: "/ifood-debug", label: "Debug iFood", grupo: "Diagnóstico", icone: "ifood" },
  { to: "/99food-debug", label: "Debug 99Food", grupo: "Diagnóstico", icone: "food99" },
  { to: "/auditoria", label: "Auditoria", grupo: "Governança", icone: "auditoria" },
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
