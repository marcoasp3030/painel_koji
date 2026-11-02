/** Regras da lista de clientes da plataforma. */
export type ClienteLinha = {
  id: string;
  name: string;
  slug: string;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  userCount: number;
  activeIntegrations: number;
  gateway_tenant_id?: string | null;
};

const paraBusca = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarClientes<T extends ClienteLinha>(
  lista: readonly T[],
  filtros: { busca: string; status: string; ordem: string },
) {
  const termo = paraBusca(filtros.busca).trim();
  const saida = lista.filter(
    (t) =>
      (!filtros.status || t.status === filtros.status) &&
      (!termo ||
        paraBusca(
          [t.name, t.slug, t.contact_name, t.contact_email, t.gateway_tenant_id]
            .filter(Boolean)
            .join(" "),
        ).includes(termo)),
  );
  if (filtros.ordem === "nome") saida.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return saida;
}

/** Excluir é definitivo: só libera com o nome exato do cliente. */
export function confirmaExclusao(digitado: string, nome: string) {
  return digitado.trim() === nome.trim() && nome.trim().length > 0;
}
