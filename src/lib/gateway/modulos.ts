/** Módulos da empresa e do agente (MULTI1-a, ESPEC_MULTI1 §10.3–10.4). */

export type TelaModulo = "cardapio" | "pedidos" | "avisos_de_pedido";

export type ModulosEmpresa = {
  itens: { id: string; nome?: string; ativo?: boolean }[];
  em_uso: string[];
  telas: TelaModulo[];
};

export type ModulosAgente = {
  agente_id: string;
  modelo: { id: string; versao: number; nome: string };
  segmento: string;
  /** Efetivos = permitidos ∩ empresa ∩ ligados no agente. */
  modulos: string[];
  permitidos: string[];
  /** null = usa o padrão do modelo. */
  ligados_no_agente: string[] | null;
  padrao_do_modelo: string[];
  da_empresa: Record<string, boolean>;
};

export const ROTULO_MODULO: Record<string, string> = {
  catalogo: "Catálogo",
  pedidos: "Pedidos",
};

export const ROTULO_TELA: Record<TelaModulo, string> = {
  cardapio: "Cardápio",
  pedidos: "Pedidos",
  avisos_de_pedido: "Avisos de pedido",
};

/** Itens de menu ligados a uma tela declarada pelos módulos. */
export const TELA_DO_CAMINHO: Record<string, TelaModulo> = {
  "/ia/cardapio": "cardapio",
  "/ia/pedidos": "pedidos",
  "/ia/configuracoes/avisos": "avisos_de_pedido",
};

export function rotuloModulo(id: string) {
  return ROTULO_MODULO[id] ?? id.replace(/_/g, " ");
}

export function pedidosEmUso(modulos: Pick<ModulosEmpresa, "em_uso"> | null | undefined) {
  return Boolean(modulos?.em_uso.includes("pedidos"));
}

export function telaLiberada(
  caminho: string,
  telas: readonly string[] | null | undefined,
): boolean {
  const tela = TELA_DO_CAMINHO[caminho];
  if (!tela) return true;
  return (telas ?? []).includes(tela);
}

/** Comportamentos que só existem com o módulo de pedidos. */
export const CAMPOS_PEDIDOS = ["carrinho_expira_h", "acoes_recentes_min"] as const;

export function campoDePedidos(campo: string) {
  return (CAMPOS_PEDIDOS as readonly string[]).includes(campo);
}
