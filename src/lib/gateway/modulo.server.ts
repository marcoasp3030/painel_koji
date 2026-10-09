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

type Opcoes = Omit<RequisicaoGateway, "metodo" | "caminho" | "ator">;

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
  const status = (corpo as Record<string, unknown>)["status"];
  if (status !== undefined && status !== "ativo" && status !== "pausado") {
    throw new AcessoNegado("Como admin da empresa você só pode deixar o agente ativo ou pausado.");
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

const REGRAS: Regra[] = [
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
  { metodo: "GET", caminho: ["unidades"], papeis: ADMIN },
  { metodo: "POST", caminho: ["unidades"], papeis: ADMIN },
  { metodo: "GET", caminho: ["unidades", "*"], papeis: ADMIN },
  { metodo: "PATCH", caminho: ["unidades", "*"], papeis: ADMIN },
  { metodo: "DELETE", caminho: ["unidades", "*"], papeis: ADMIN },
  // Conversas e atendimento humano.
  { metodo: "GET", caminho: ["conversas"], papeis: AMBOS },
  { metodo: "GET", caminho: ["conversas", "*", "mensagens"], papeis: AMBOS },
  { metodo: "POST", caminho: ["conversas", "*", "mensagens"], papeis: AMBOS },
  { metodo: "POST", caminho: ["conversas", "*", "assumir"], papeis: AMBOS },
  { metodo: "POST", caminho: ["conversas", "*", "devolver"], papeis: AMBOS },
  { metodo: "GET", caminho: ["eventos"], papeis: AMBOS },
  { metodo: "GET", caminho: ["eventos", "cursor"], papeis: AMBOS },
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
      const chamar = <T>(metodo: MetodoGateway, caminho: string[], opcoes: Opcoes = {}) =>
        deps.cliente.requisitar<T>({ ...opcoes, metodo, caminho, ator });

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
              return chamar<T>(metodo, ["tenants", id, ...partes], opcoes);
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
              return chamar<T>(metodo, partes, opcoes);
            },
          };
        },
      };
    },
  };
}

export type ModuloGateway = ReturnType<typeof criarModuloGateway>;
