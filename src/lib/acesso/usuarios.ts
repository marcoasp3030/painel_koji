/** Regras da gestão de usuários, usadas pelo servidor e pela tela. */
import { podeConceder, type PapelAcesso } from "./papeis";

type UnidadesDoAtor = "*" | readonly string[];

/**
 * Quem pode mexer em quem: só em papel que a pessoa poderia conceder e, com acesso restrito,
 * só em quem divide ao menos uma unidade com ela. Vale para papel, unidades, convite e desativar.
 */
export function podeGerirUsuario(
  ator: PapelAcesso,
  unidadesAtor: UnidadesDoAtor,
  alvo: { papel: PapelAcesso; unidades: readonly string[] },
) {
  if (!podeConceder(ator, alvo.papel)) return false;
  return unidadesAtor === "*" || alvo.unidades.some((c) => unidadesAtor.includes(c));
}

/** Só as unidades acrescentadas precisam estar ao alcance de quem altera. */
export function unidadesAcrescentadas(atuais: readonly string[], pedidas: readonly string[]) {
  return pedidas.filter((c) => !atuais.includes(c));
}

/** Quem tem acesso restrito não vê nem perde o que está fora dele: essas unidades ficam. */
export function unidadesFinais(
  unidadesAtor: UnidadesDoAtor,
  atuais: readonly string[],
  pedidas: readonly string[],
) {
  if (unidadesAtor === "*") return [...new Set(pedidas)];
  return [...new Set([...pedidas, ...atuais.filter((c) => !unidadesAtor.includes(c))])];
}

export type SituacaoUsuario = "ativo" | "convite" | "nunca_entrou" | "inativo";

export const ROTULO_SITUACAO: Record<SituacaoUsuario, string> = {
  ativo: "Ativo",
  convite: "Convite pendente",
  nunca_entrou: "Nunca entrou",
  inativo: "Inativo",
};

type LinhaBusca = {
  nome: string | null;
  email: string;
  papel: PapelAcesso;
  ativo: boolean;
  unidades: readonly string[];
  ultimo_acesso: string | null;
  convitePendente?: boolean;
};

export function situacaoUsuario(
  u: Pick<LinhaBusca, "ativo" | "ultimo_acesso" | "convitePendente">,
) {
  if (!u.ativo) return "inativo" as const;
  if (u.convitePendente) return "convite" as const;
  return u.ultimo_acesso ? ("ativo" as const) : ("nunca_entrou" as const);
}

const paraBusca = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarUsuarios<T extends LinhaBusca>(
  usuarios: readonly T[],
  filtros: { busca?: string; papel?: string; situacao?: string; unidade?: string },
) {
  const busca = paraBusca(filtros.busca ?? "").trim();
  return usuarios.filter((u) => {
    if (filtros.papel && u.papel !== filtros.papel) return false;
    if (filtros.situacao && situacaoUsuario(u) !== filtros.situacao) return false;
    if (filtros.unidade && u.papel !== "gestor" && !u.unidades.includes(filtros.unidade))
      return false;
    return !busca || paraBusca(`${u.nome ?? ""} ${u.email}`).includes(busca);
  });
}
