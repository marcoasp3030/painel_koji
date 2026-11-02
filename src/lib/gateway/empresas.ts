/** Filtros da lista de empresas do gateway. */
import type { EmpresaGateway, EmpresaPainel } from "./tipos";

export type FiltroEmpresa = "" | "ativas" | "suspensas" | "teste" | "sem_vinculo";

export const clienteDaEmpresa = (empresa: { id: string }, painel: readonly EmpresaPainel[]) =>
  painel.find((p) => p.gateway_tenant_id === empresa.id) ?? null;

export function casaFiltroEmpresa(
  e: EmpresaGateway,
  filtro: FiltroEmpresa,
  painel: readonly EmpresaPainel[],
) {
  if (filtro === "ativas") return e.status === "ativo";
  if (filtro === "suspensas") return e.status !== "ativo";
  if (filtro === "teste") return e.tenant_teste;
  if (filtro === "sem_vinculo") return !clienteDaEmpresa(e, painel);
  return true;
}

const paraBusca = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarEmpresas(
  empresas: readonly EmpresaGateway[],
  painel: readonly EmpresaPainel[],
  filtros: { busca: string; filtro: FiltroEmpresa },
) {
  const busca = paraBusca(filtros.busca).trim();
  return empresas.filter(
    (e) =>
      casaFiltroEmpresa(e, filtros.filtro, painel) &&
      (!busca ||
        paraBusca(`${e.nome} ${e.id} ${clienteDaEmpresa(e, painel)?.name ?? ""}`).includes(busca)),
  );
}
