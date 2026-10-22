/**
 * Permissões do painel sobre o gateway. O tenant e o papel saem do perfil
 * carregado no servidor; o que o navegador envia só é aceito se bater com
 * esse perfil. Tudo que não está na tabela de regras é recusado para
 * usuários de empresa, antes de qualquer chamada ao gateway.
 */
import type { ClienteGateway, MetodoGateway, RequisicaoGateway } from "./cliente.server";
import { GatewayErro } from "./erros";

export const FORMATO_TENANT = /^[a-z0-9_]{3,40}$/;

/** plataforma = super_admin; admin = admin da empresa; membro = atendente. */
export type PapelGateway = "plataforma" | "admin" | "membro";

export type PerfilGateway = {
  userId: string;
  email: string | null;
  superAdmin: boolean;
  /** Tenants do gateway vinculados às empresas do usuário. */
  vinculos: { gatewayTenantId: string; ativo: boolean; admin: boolean }[];
};

export type UsuarioSessao = { userId: string; email: string | null };

type Opcoes = Omit<RequisicaoGateway, "metodo" | "caminho" | "ator" | "papel">;

export class AcessoNegado extends GatewayErro {
  constructor(mensagem: string) {
    super({ codigo: "FORBIDDEN", status: 403, mensagem });
    this.name = "AcessoNegado";
  }
}

/** Campos do agente que o admin da empresa pode alterar. */
export const CAMPOS_AGENTE_EMPRESA = [
  "aviso_demora",
  "fallback",
  "modo_piloto",
  "contatos_permitidos",
  "debounce_s",
  "max_wait_s",
  "pause_minutes",
  "slow_notice_s",
  "alerta_telefone",
  "status",
  // Lista ou null (= padrão do modelo). Fora dos permitidos o gateway recusa.
  "modulos_ligados",
] as const;

function validarPatchAgenteEmpresa(corpo: unknown) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new AcessoNegado("Envie os campos do agente a alterar.");
  }
  const permitidos = new Set<string>(CAMPOS_AGENTE_EMPRESA);
  const recusados = Object.keys(corpo).filter((campo) => !permitidos.has(campo));
  if (recusados.length > 0) {
    throw new AcessoNegado(
      `Como admin da empresa você não pode alterar: ${recusados.join(", ")}. ` +
        `Campos permitidos: ${CAMPOS_AGENTE_EMPRESA.join(", ")}.`,
    );
  }
  const dados = corpo as Record<string, unknown>;
  const status = dados["status"];
  if (status !== undefined && status !== "ativo" && status !== "pausado") {
    throw new AcessoNegado("Como admin da empresa você só pode deixar o agente ativo ou pausado.");
  }
  const ligados = dados["modulos_ligados"];
  if (
    ligados !== undefined &&
    ligados !== null &&
    !(
      Array.isArray(ligados) &&
      ligados.every((m) => typeof m === "string" && /^[a-z0-9_]{2,40}$/.test(m))
    )
  ) {
    throw new AcessoNegado(
      "Módulos do agente: envie a lista de identificadores ou null para o padrão do modelo.",
    );
  }
}

function semCorpo(corpo: unknown) {
  if (
    corpo !== undefined &&
    corpo !== null &&
    !(typeof corpo === "object" && Object.keys(corpo).length === 0)
  ) {
    throw new AcessoNegado("Esta opção de teste é restrita ao admin da plataforma.");
  }
}

type Regra = {
  metodo: MetodoGateway;
  /** Segmentos após /tenants/{tenant}; "*" vale qualquer segmento. */
  caminho: string[];
  papeis: Exclude<PapelGateway, "plataforma">[];
  corpo?: (corpo: unknown) => void;
};

const AMBOS: Regra["papeis"] = ["admin", "membro"];
const ADMIN: Regra["papeis"] = ["admin"];

function soChaves(permitidas: string[], mensagem: string) {
  return (c: unknown) => {
    if (c === undefined || c === null) return;
    if (
      typeof c !== "object" ||
      Array.isArray(c) ||
      Object.keys(c).some((k) => !permitidas.includes(k))
    )
      throw new AcessoNegado(mensagem);
  };
}
function regrasAtendimento(prefixo: string[]): Regra[] {
  const a = [...prefixo, "atendimento"];
  return [
    { metodo: "GET", caminho: a, papeis: AMBOS },
    {
      metodo: "PUT",
      caminho: [...a, "rascunho"],
      papeis: ADMIN,
      corpo: soChaves(["baseado_em", "perfil", "comportamentos"], "Campos de rascunho inválidos."),
    },
    { metodo: "DELETE", caminho: [...a, "rascunho"], papeis: ADMIN },
    {
      metodo: "POST",
      caminho: [...a, "publicar"],
      papeis: ADMIN,
      corpo: soChaves(
        ["baseado_em", "nota", "confirmar_avisos"],
        "Campos de publicação inválidos.",
      ),
    },
    { metodo: "GET", caminho: [...a, "versoes"], papeis: AMBOS },
    { metodo: "GET", caminho: [...a, "versoes", "*"], papeis: AMBOS },
    {
      metodo: "POST",
      caminho: [...a, "versoes", "*", "restaurar"],
      papeis: ADMIN,
      corpo: soChaves(["nota"], "Campos de restauração inválidos."),
    },
    {
      metodo: "POST",
      caminho: [...a, "previa"],
      papeis: AMBOS,
      corpo: soChaves(["fonte"], "Campos de prévia inválidos."),
    },
  ];
}

const REGRAS: Regra[] = [
  // Leitura do tenant só para o fuso (`timezone`). A função de gestão devolve apenas esse campo.
  { metodo: "GET", caminho: [], papeis: ADMIN },
  // Agentes: leitura para todos; edição restrita; testar e simular só admin.
  { metodo: "GET", caminho: ["agentes"], papeis: AMBOS },
  { metodo: "GET", caminho: ["agentes", "*"], papeis: AMBOS },
  { metodo: "GET", caminho: ["agentes", "*", "circuito"], papeis: AMBOS },
  { metodo: "PATCH", caminho: ["agentes", "*"], papeis: ADMIN, corpo: validarPatchAgenteEmpresa },
  // Testar como a empresa: sem corpo. Opções de teste (ex.: provedor real) são da plataforma.
  { metodo: "POST", caminho: ["agentes", "*", "testar"], papeis: ADMIN, corpo: semCorpo },
  { metodo: "POST", caminho: ["agentes", "*", "simular"], papeis: ADMIN },
  // Canais e consumo: só leitura.
  { metodo: "GET", caminho: ["canais"], papeis: AMBOS },
  { metodo: "GET", caminho: ["canais", "*"], papeis: AMBOS },
  { metodo: "GET", caminho: ["consumo"], papeis: AMBOS },
  // Unidades e horários: admin da empresa.
  { metodo: "GET", caminho: ["unidades"], papeis: AMBOS },
  { metodo: "POST", caminho: ["unidades"], papeis: ADMIN },
  { metodo: "GET", caminho: ["unidades", "*"], papeis: AMBOS },
  { metodo: "PATCH", caminho: ["unidades", "*"], papeis: ADMIN },
  { metodo: "DELETE", caminho: ["unidades", "*"], papeis: ADMIN },
  { metodo: "GET", caminho: ["unidades", "*", "agenda"], papeis: AMBOS },
  {
    metodo: "POST",
    caminho: ["unidades", "*", "pausar"],
    papeis: AMBOS,
    corpo: (c) => {
      if (
        !c ||
        typeof c !== "object" ||
        Object.keys(c).some((k) => !["ate", "indefinida", "motivo"].includes(k))
      )
        throw new AcessoNegado("Campos de pausa inválidos.");
    },
  },
  { metodo: "POST", caminho: ["unidades", "*", "reabrir"], papeis: AMBOS, corpo: semCorpo },
  { metodo: "PUT", caminho: ["unidades", "*", "horarios"], papeis: ADMIN },
  { metodo: "GET", caminho: ["unidades", "*", "excecoes"], papeis: ADMIN },
  { metodo: "POST", caminho: ["unidades", "*", "excecoes"], papeis: ADMIN },
  { metodo: "DELETE", caminho: ["unidades", "*", "excecoes", "*"], papeis: ADMIN },
  { metodo: "GET", caminho: ["gestao", "alteracoes"], papeis: ADMIN },
  // Conversas e atendimento humano.
  { metodo: "GET", caminho: ["conversas"], papeis: AMBOS },
  { metodo: "GET", caminho: ["conversas", "*", "mensagens"], papeis: AMBOS },
  { metodo: "POST", caminho: ["conversas", "*", "mensagens"], papeis: AMBOS },
  { metodo: "POST", caminho: ["conversas", "*", "assumir"], papeis: AMBOS },
  { metodo: "POST", caminho: ["conversas", "*", "devolver"], papeis: AMBOS },
  // Nome de cadastro do contato (PED1-c): qualquer papel, só a chave `nome`.
  {
    metodo: "PATCH",
    caminho: ["contatos", "*"],
    papeis: AMBOS,
    corpo: (c) => {
      const nome = c && typeof c === "object" ? (c as Record<string, unknown>)["nome"] : undefined;
      if (
        !c ||
        typeof c !== "object" ||
        Object.keys(c).length !== 1 ||
        !(nome === null || typeof nome === "string")
      )
        throw new AcessoNegado("Só o nome do contato pode ser alterado.");
    },
  },
  { metodo: "GET", caminho: ["eventos"], papeis: AMBOS },
  { metodo: "GET", caminho: ["eventos", "cursor"], papeis: AMBOS },
  // ARQ1-a1: ler documentos, qualquer papel; apagar e chave de formulário, só admin.
  { metodo: "GET", caminho: ["anexos"], papeis: AMBOS },
  { metodo: "GET", caminho: ["anexos", "*"], papeis: AMBOS },
  { metodo: "GET", caminho: ["anexos", "*", "texto"], papeis: AMBOS },
  { metodo: "GET", caminho: ["anexos", "*", "original"], papeis: AMBOS },
  { metodo: "DELETE", caminho: ["anexos", "*"], papeis: ADMIN },
  { metodo: "GET", caminho: ["chaves-formulario"], papeis: AMBOS },
  {
    metodo: "POST",
    caminho: ["chaves-formulario"],
    papeis: ADMIN,
    corpo: soChaves(
      [
        "nome",
        "agente_id",
        "limite_por_minuto",
        "max_bytes",
        "tipos",
        "modos",
        "origens",
        "expira_em",
      ],
      "Campos da chave de formulário inválidos.",
    ),
  },
  { metodo: "DELETE", caminho: ["chaves-formulario", "*"], papeis: ADMIN },
  // Webhooks de saída: admin escolhe os eventos. Membro não configura.
  { metodo: "GET", caminho: ["webhooks-saida"], papeis: ADMIN },
  { metodo: "GET", caminho: ["webhooks-saida", "*"], papeis: ADMIN },
  { metodo: "GET", caminho: ["webhooks-saida", "*", "entregas"], papeis: ADMIN },
  {
    metodo: "POST",
    caminho: ["webhooks-saida"],
    papeis: ADMIN,
    corpo: soChaves(["url", "eventos", "ativo"], "Campos do webhook inválidos."),
  },
  {
    metodo: "PATCH",
    caminho: ["webhooks-saida", "*"],
    papeis: ADMIN,
    corpo: soChaves(["url", "eventos", "ativo"], "Campos do webhook inválidos."),
  },
  { metodo: "DELETE", caminho: ["webhooks-saida", "*"], papeis: ADMIN },
  {
    metodo: "POST",
    caminho: ["webhooks-saida", "*", "testar"],
    papeis: ADMIN,
    corpo: semCorpo,
  },
  {
    metodo: "POST",
    caminho: ["webhooks-saida", "*", "rotacionar-segredo"],
    papeis: ADMIN,
    corpo: semCorpo,
  },
  // FUP1-a: ver e cancelar, admin e membro. Reativar o contato, só admin.
  { metodo: "GET", caminho: ["conversas", "*", "follow-ups"], papeis: AMBOS },
  {
    metodo: "POST",
    caminho: ["conversas", "*", "follow-ups", "cancelar"],
    papeis: AMBOS,
    corpo: soChaves(["motivo"], "Campos de cancelamento inválidos."),
  },
  { metodo: "GET", caminho: ["contatos", "*", "opt-out-follow-up"], papeis: AMBOS },
  { metodo: "DELETE", caminho: ["contatos", "*", "opt-out-follow-up"], papeis: ADMIN },
  // MULTI1-a: módulos da empresa e do agente; webhook uazapi.
  { metodo: "GET", caminho: ["modulos"], papeis: AMBOS },
  { metodo: "GET", caminho: ["agentes", "*", "modulos"], papeis: AMBOS },
  {
    metodo: "POST",
    caminho: ["canais", "*", "webhook"],
    papeis: ADMIN,
    corpo: semCorpo,
  },
  {
    metodo: "PUT",
    caminho: ["pedidos", "avisos", "*"],
    papeis: ADMIN,
    corpo: (c) => {
      if (
        !c ||
        typeof c !== "object" ||
        Array.isArray(c) ||
        Object.keys(c).some((k) => !["texto", "ativo", "modalidade"].includes(k))
      )
        throw new AcessoNegado("Campos de aviso inválidos.");
    },
  },
  { metodo: "POST", caminho: ["pedidos", "avisos", "*", "previa"], papeis: ADMIN },
  {
    metodo: "POST",
    caminho: ["pedidos", "*", "avisos", "*", "reenviar"],
    papeis: AMBOS,
    corpo: (c) => {
      if (c && (typeof c !== "object" || Object.keys(c).some((k) => k !== "mesmo_incerto")))
        throw new AcessoNegado("Campos de reenvio inválidos.");
    },
  },
  // Comportamento do agente (CFG1-a), na empresa e no agente: todos leem e veem a prévia; só admin escreve.
  ...regrasAtendimento([]),
  ...regrasAtendimento(["agentes", "*"]),
  // CAT2: consulta e prévia para todos; edição e histórico apenas administradores.
  { metodo: "GET", caminho: ["catalogo", "itens", "*"], papeis: AMBOS },
  { metodo: "GET", caminho: ["catalogo", "categorias"], papeis: AMBOS },
  {
    metodo: "POST",
    caminho: ["catalogo", "disponibilidade", "previa"],
    papeis: AMBOS,
    corpo: (c) => {
      if (
        !c ||
        typeof c !== "object" ||
        Object.keys(c).some((k) => !["unidade", "disponibilidade"].includes(k))
      )
        throw new AcessoNegado("Campos de prévia inválidos.");
    },
  },
  { metodo: "GET", caminho: ["catalogo", "itens"], papeis: AMBOS },
  {
    metodo: "PATCH",
    caminho: ["catalogo", "itens", "*"],
    papeis: ADMIN,
    corpo: (c) => {
      if (
        !c ||
        typeof c !== "object" ||
        Array.isArray(c) ||
        Object.keys(c).some(
          (k) =>
            ![
              "nome",
              "descricao",
              "preco",
              "ativo",
              "categoria",
              "disponibilidade",
              "atualizado_em",
              "codigo",
              "tipo",
              "alcoolico",
              "delivery",
              "observacao",
              "categoria_id",
              "posicao",
              "aplicar_em",
            ].includes(k),
        )
      )
        throw new AcessoNegado("Campos de edição do item inválidos.");
    },
  },
  // CAT3-a: operações explícitas, sem liberar PATCH/lote para membro.
  {
    metodo: "POST",
    caminho: ["catalogo", "itens"],
    papeis: ADMIN,
    corpo: soChaves(
      [
        "unidade",
        "categoria_id",
        "nome",
        "descricao",
        "preco",
        "codigo",
        "tipo",
        "alcoolico",
        "delivery",
        "ativo",
        "observacao",
        "disponibilidade",
        "posicao",
      ],
      "Campos do item inválidos.",
    ),
  },
  ...["esgotar", "repor"].map((op): Regra => ({
    metodo: "POST",
    caminho: ["catalogo", "itens", "*", op],
    papeis: AMBOS,
    corpo: soChaves(
      op === "esgotar" ? ["ate", "motivo", "aplicar_em"] : ["aplicar_em"],
      "Campos inválidos.",
    ),
  })),
  ...["arquivar", "desarquivar", "duplicar"].map((op): Regra => ({
    metodo: "POST",
    caminho: ["catalogo", "itens", "*", op],
    papeis: ADMIN,
    corpo: soChaves(
      op === "duplicar" ? ["unidade", "categoria_id", "nome"] : [],
      "Campos inválidos.",
    ),
  })),
  {
    metodo: "POST",
    caminho: ["catalogo", "categorias"],
    papeis: ADMIN,
    corpo: soChaves(["unidade", "nome", "posicao"], "Campos de categoria inválidos."),
  },
  {
    metodo: "PATCH",
    caminho: ["catalogo", "categorias", "*"],
    papeis: ADMIN,
    corpo: soChaves(["nome"], "Campos de categoria inválidos."),
  },
  {
    metodo: "PUT",
    caminho: ["catalogo", "categorias", "ordem"],
    papeis: ADMIN,
    corpo: soChaves(["unidade", "categorias"], "Ordem inválida."),
  },
  {
    metodo: "PUT",
    caminho: ["catalogo", "categorias", "*", "ordem"],
    papeis: ADMIN,
    corpo: soChaves(["itens"], "Ordem inválida."),
  },
  {
    metodo: "POST",
    caminho: ["catalogo", "categorias", "*", "arquivar"],
    papeis: ADMIN,
    corpo: soChaves(["itens", "destino"], "Campos inválidos."),
  },
  {
    metodo: "POST",
    caminho: ["catalogo", "copiar"],
    papeis: ADMIN,
    corpo: soChaves(["itens", "destino", "ligar"], "Campos de cópia inválidos."),
  },
  {
    metodo: "POST",
    caminho: ["catalogo", "lote"],
    papeis: ADMIN,
    corpo: soChaves(
      ["itens", "acao", "simulacao", "percentual", "valor", "categoria_id", "ate", "motivo"],
      "Campos do lote inválidos.",
    ),
  },
  { metodo: "GET", caminho: ["catalogo", "pratos", "sugestoes"], papeis: AMBOS },
  ...["confirmar", "ignorar", "restaurar"].map((op): Regra => ({
    metodo: "POST",
    caminho: ["catalogo", "pratos", "sugestoes", op],
    papeis: ADMIN,
    corpo: soChaves(op === "confirmar" ? ["grupos"] : ["chaves"], "Campos de sugestão inválidos."),
  })),
  { metodo: "GET", caminho: ["conversas", "*", "atendimentos"], papeis: AMBOS },
  {
    metodo: "POST",
    caminho: ["conversas", "*", "encerrar"],
    papeis: AMBOS,
    corpo: soChaves(["motivo"], "Campos inválidos."),
  },
  { metodo: "POST", caminho: ["conversas", "*", "reabrir"], papeis: AMBOS, corpo: semCorpo },
  // Pedidos PED1-a: leitura e mudança de status para admin e atendente.
  { metodo: "GET", caminho: ["pedidos"], papeis: AMBOS },
  { metodo: "GET", caminho: ["pedidos", "*"], papeis: AMBOS },
  {
    metodo: "POST",
    caminho: ["pedidos", "*", "status"],
    papeis: AMBOS,
    corpo: (c) => {
      if (!c || typeof c !== "object" || Array.isArray(c))
        throw new AcessoNegado("Informe o status do pedido.");
      const status = (c as { status?: unknown }).status;
      if (
        typeof status !== "string" ||
        Object.keys(c).some((k) => !["status", "motivo", "previsao_min"].includes(k))
      )
        throw new AcessoNegado("Campos de status do pedido inválidos.");
    },
  },
];

function casa(regra: Regra, metodo: MetodoGateway, partes: string[]) {
  return (
    regra.metodo === metodo &&
    regra.caminho.length === partes.length &&
    regra.caminho.every((seg, i) => seg === "*" || seg === partes[i])
  );
}

/** Confere a operação contra o papel; o admin da plataforma pode tudo. */
export function autorizar(
  papel: PapelGateway,
  metodo: MetodoGateway,
  partes: string[],
  corpo?: unknown,
) {
  if (papel === "plataforma") return;
  const regra = REGRAS.find((r) => casa(r, metodo, partes));
  if (!regra || !regra.papeis.includes(papel)) {
    throw new AcessoNegado(
      papel === "membro"
        ? "Seu acesso permite apenas consultar agentes, canais e consumo e atender conversas."
        : "Esta operação é restrita ao admin da plataforma.",
    );
  }
  regra.corpo?.(corpo);
}

/** Decide o tenant efetivo e o papel a partir do perfil e do tenant pedido. */
export function resolverTenant(
  perfil: PerfilGateway,
  solicitado?: string | null,
): { id: string; papel: PapelGateway } {
  if (solicitado != null && !FORMATO_TENANT.test(solicitado)) {
    throw new AcessoNegado("Empresa inválida.");
  }
  if (perfil.superAdmin) {
    if (!solicitado) throw new AcessoNegado("Escolha a empresa.");
    return { id: solicitado, papel: "plataforma" };
  }

  const permitidos = perfil.vinculos.filter((v) => v.ativo);
  if (permitidos.length === 0) {
    throw new AcessoNegado("Sua empresa não está vinculada ao gateway de agentes.");
  }
  let vinculo = permitidos[0]!;
  if (solicitado) {
    const encontrado = permitidos.find((v) => v.gatewayTenantId === solicitado);
    if (!encontrado) {
      throw new AcessoNegado("Você não tem permissão para acessar dados de outra empresa.");
    }
    vinculo = encontrado;
  } else if (permitidos.length > 1) {
    throw new AcessoNegado("Escolha a empresa.");
  }
  return { id: vinculo.gatewayTenantId, papel: vinculo.admin ? "admin" : "membro" };
}

export function criarModuloGateway(deps: {
  cliente: ClienteGateway;
  carregarPerfil: (usuario: UsuarioSessao) => Promise<PerfilGateway>;
  registrarBloqueio?: (
    perfil: PerfilGateway,
    solicitado: string | null,
    motivo: string,
  ) => Promise<void>;
}) {
  return {
    /** Sessão do usuário logado; toda chamada ao gateway parte daqui. */
    async sessao(usuario: UsuarioSessao) {
      const perfil = await deps.carregarPerfil(usuario);
      const ator = perfil.email ?? perfil.userId;
      const chamar = <T>(
        papel: PapelGateway,
        metodo: MetodoGateway,
        caminho: string[],
        opcoes: Opcoes = {},
      ) => deps.cliente.requisitar<T>({ ...opcoes, metodo, caminho, ator, papel });

      const negar = async (solicitado: string | null, erro: unknown): Promise<never> => {
        if (erro instanceof AcessoNegado && deps.registrarBloqueio && !perfil.superAdmin) {
          await deps.registrarBloqueio(perfil, solicitado, erro.message).catch(() => undefined);
        }
        throw erro;
      };

      return {
        perfil,

        /** Rotas /tenants/{tenant}/... do tenant efetivo, conferidas pelo papel. */
        async tenant(solicitado?: string | null) {
          let id: string;
          let papel: PapelGateway;
          try {
            ({ id, papel } = resolverTenant(perfil, solicitado));
          } catch (erro) {
            return negar(solicitado ?? null, erro);
          }
          return {
            id,
            papel,
            async chamar<T = unknown>(
              metodo: MetodoGateway,
              partes: string[] = [],
              opcoes: Opcoes = {},
            ) {
              try {
                autorizar(papel, metodo, partes, opcoes.corpo);
              } catch (erro) {
                return negar(id, erro);
              }
              // Escopo = empresa já conferida na sessão; não reusa o texto do navegador.
              return chamar<T>(papel, metodo, ["tenants", id, ...partes], {
                ...opcoes,
                ...(papel === "plataforma" ? {} : { escopoEmpresa: id }),
              });
            },
          };
        },

        /** Rotas globais (/tenants, /modelos-agente...): só admin da plataforma. */
        async plataforma() {
          if (!perfil.superAdmin) {
            return negar(null, new AcessoNegado("Acesso restrito ao admin da plataforma."));
          }
          return {
            chamar<T = unknown>(metodo: MetodoGateway, partes: string[], opcoes: Opcoes = {}) {
              // Plataforma não envia X-Tenant-Scope (vê todas as empresas).
              return chamar<T>("plataforma", metodo, partes, opcoes);
            },
          };
        },
      };
    },
  };
}

export type ModuloGateway = ReturnType<typeof criarModuloGateway>;
