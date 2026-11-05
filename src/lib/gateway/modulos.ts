/** Módulos da empresa e do agente (MULTI1-a, ESPEC_MULTI1 §10.3–10.4). */

export type TelaModulo = "cardapio" | "pedidos" | "avisos_de_pedido";

export type ModulosEmpresa = {
  itens: { id: string; nome?: string; ativo?: boolean }[];
  em_uso: string[];
  telas: TelaModulo[];
  /** Módulos do painel que a plataforma bloqueou nesta empresa (TELAS1). Vazio = tudo liberado. */
  bloqueadas: ModuloPainel[];
};

/**
 * Cada opção do menu da empresa é um módulo que o super admin libera ou bloqueia (TELAS1).
 * A lista precisa bater com `TELAS` em app/nucleo/telas.py no gateway.
 */
export const MODULOS_PAINEL = [
  { id: "conversas", rotulo: "Conversas", grupo: "Atendimento" },
  { id: "pedidos", rotulo: "Pedidos", grupo: "Atendimento" },
  { id: "operacao", rotulo: "Operação", grupo: "Atendimento" },
  { id: "cardapio", rotulo: "Cardápio", grupo: "Loja" },
  { id: "unidades", rotulo: "Unidades e horários", grupo: "Loja" },
  { id: "avisos_de_pedido", rotulo: "Avisos de pedido", grupo: "Loja" },
  { id: "aparencia", rotulo: "Aparência do cardápio", grupo: "Loja" },
  { id: "agentes", rotulo: "Agentes", grupo: "Agente" },
  { id: "comportamento", rotulo: "Comportamento do agente", grupo: "Agente" },
  { id: "documentos", rotulo: "Documentos", grupo: "Agente" },
  { id: "simular", rotulo: "Simular conversa", grupo: "Agente" },
  { id: "canais", rotulo: "Canais", grupo: "Integrações" },
  { id: "chaves_formulario", rotulo: "Chaves de formulário", grupo: "Integrações" },
  { id: "webhooks", rotulo: "Webhooks de saída", grupo: "Integrações" },
  { id: "historico", rotulo: "Histórico de gestão", grupo: "Gestão" },
  { id: "usuarios", rotulo: "Usuários", grupo: "Gestão" },
] as const;

export type ModuloPainel = (typeof MODULOS_PAINEL)[number]["id"];

const IDS_MODULOS_PAINEL = new Set<string>(MODULOS_PAINEL.map((m) => m.id));

export function ehModuloPainel(id: unknown): id is ModuloPainel {
  return typeof id === "string" && IDS_MODULOS_PAINEL.has(id);
}

/** Módulos do painel agrupados como no menu, na ordem do catálogo. */
export function gruposModulosPainel() {
  const grupos: { nome: string; itens: (typeof MODULOS_PAINEL)[number][] }[] = [];
  for (const m of MODULOS_PAINEL) {
    const g = grupos.find((x) => x.nome === m.grupo);
    if (g) g.itens.push(m);
    else grupos.push({ nome: m.grupo, itens: [m] });
  }
  return grupos;
}

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
  "/ia/configuracoes/aparencia": "cardapio",
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
