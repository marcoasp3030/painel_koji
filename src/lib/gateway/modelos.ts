/** Regras da tela Modelos de agente. O gateway guarda uma linha por versão de cada modelo. */
import type { ItemRotulado, ModeloAgenteCompleto } from "./tipos";

export type GrupoModelo = {
  id: string;
  atual: ModeloAgenteCompleto;
  versoes: ModeloAgenteCompleto[];
};

/** Agrupa as versões. Situação e nome de um modelo são sempre os da versão mais recente. */
export function agruparVersoes(linhas: readonly ModeloAgenteCompleto[]) {
  const porId = new Map<string, ModeloAgenteCompleto[]>();
  for (const m of linhas) porId.set(m.id, [...(porId.get(m.id) ?? []), m]);
  const grupos: GrupoModelo[] = [...porId.entries()].map(([id, lista]) => {
    const versoes = [...lista].sort((a, b) => b.versao - a.versao);
    return { id, atual: versoes[0]!, versoes };
  });
  return grupos.sort((a, b) => a.atual.nome.localeCompare(b.atual.nome, "pt-BR"));
}

const paraBusca = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarModelos(
  grupos: readonly GrupoModelo[],
  filtros: { busca?: string; situacao?: "ativos" | "inativos" | "" },
) {
  const busca = paraBusca(filtros.busca ?? "").trim();
  return grupos.filter(({ id, atual }) => {
    if (filtros.situacao === "ativos" && !atual.ativo) return false;
    if (filtros.situacao === "inativos" && atual.ativo) return false;
    return !busca || paraBusca(`${atual.nome} ${id} ${atual.segmento}`).includes(busca);
  });
}

/** Id para item novo, a partir do rótulo. O id não muda depois: outros cadastros apontam para ele. */
export function idDeRotulo(rotulo: string, usados: readonly string[]) {
  const base =
    paraBusca(rotulo)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36)
      .replace(/_+$/, "") || "item";
  const limpo = base.length < 2 ? `${base}_item` : base;
  if (!usados.includes(limpo)) return limpo;
  let n = 2;
  while (usados.includes(`${limpo}_${n}`)) n += 1;
  return `${limpo}_${n}`;
}

export type FormModelo = Pick<
  ModeloAgenteCompleto,
  | "nome"
  | "segmento"
  | "tipo"
  | "ativo"
  | "skyone_ref"
  | "modulos_permitidos"
  | "modulos_padrao"
  | "motivos_transferencia"
  | "tipos_solicitacao"
>;

export function formDoModelo(m: ModeloAgenteCompleto): FormModelo {
  return {
    nome: m.nome,
    segmento: m.segmento ?? "",
    tipo: m.tipo,
    ativo: m.ativo,
    skyone_ref: m.skyone_ref ?? null,
    modulos_permitidos: m.modulos_permitidos ?? [],
    modulos_padrao: m.modulos_padrao ?? [],
    motivos_transferencia: m.motivos_transferencia ?? [],
    tipos_solicitacao: m.tipos_solicitacao ?? [],
  };
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ordenado = (l: readonly string[]) => [...l].sort();

/** Só o que mudou: o gateway copia o resto da versão anterior, inclusive o que a tela não mostra. */
export function camposAlterados(base: FormModelo, form: FormModelo) {
  const saida: Partial<FormModelo> = {};
  if (form.nome.trim() !== base.nome) saida.nome = form.nome.trim();
  if (form.segmento !== base.segmento) saida.segmento = form.segmento;
  if (form.tipo !== base.tipo) saida.tipo = form.tipo;
  if (form.ativo !== base.ativo) saida.ativo = form.ativo;
  const ref = form.skyone_ref?.trim() || null;
  if (ref !== base.skyone_ref) saida.skyone_ref = ref;
  if (!igual(ordenado(form.modulos_permitidos), ordenado(base.modulos_permitidos)))
    saida.modulos_permitidos = form.modulos_permitidos;
  if (!igual(ordenado(form.modulos_padrao), ordenado(base.modulos_padrao)))
    saida.modulos_padrao = form.modulos_padrao;
  if (!igual(form.motivos_transferencia, base.motivos_transferencia))
    saida.motivos_transferencia = form.motivos_transferencia;
  if (!igual(form.tipos_solicitacao, base.tipos_solicitacao))
    saida.tipos_solicitacao = form.tipos_solicitacao;
  return saida;
}

const itemInvalido = (i: ItemRotulado) => i.rotulo.trim().length < 2 || i.rotulo.trim().length > 60;

/** O primeiro problema que impede salvar; os limites são os do gateway. */
export function problemaDoModelo(form: FormModelo) {
  if (!form.nome.trim()) return "Informe o nome.";
  if (!/^[a-z0-9_]{2,40}$/.test(form.segmento))
    return "Segmento: use de 2 a 40 letras minúsculas, números ou _.";
  if ([...form.motivos_transferencia, ...form.tipos_solicitacao].some(itemInvalido))
    return "Cada item precisa de um rótulo de 2 a 60 caracteres.";
  if (form.motivos_transferencia.length > 30 || form.tipos_solicitacao.length > 30)
    return "Cada lista aceita até 30 itens.";
  return null;
}
