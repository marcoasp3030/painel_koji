/**
 * Permissões do painel sobre o gateway. O tenant sai do perfil carregado no
 * servidor; o que o navegador envia só é aceito se bater com esse perfil.
 * Só o admin da plataforma escolhe livremente o tenant.
 */
import type { ClienteGateway, MetodoGateway, RequisicaoGateway } from "./cliente.server";
import { GatewayErro } from "./erros";

export const FORMATO_TENANT = /^[a-z0-9_]{3,40}$/;

export type PerfilGateway = {
  userId: string;
  email: string | null;
  superAdmin: boolean;
  /** Tenants do gateway vinculados às empresas do usuário. */
  vinculos: { gatewayTenantId: string; ativo: boolean }[];
};

export type UsuarioSessao = { userId: string; email: string | null };

type Opcoes = Omit<RequisicaoGateway, "metodo" | "caminho" | "ator">;

/** Rotas globais que um usuário de empresa lê sempre filtradas pelo próprio tenant. */
const GLOBAIS_FILTRADAS = new Set(["modelos-agente", "modulos"]);

export class AcessoNegado extends GatewayErro {
  constructor(mensagem: string) {
    super({ codigo: "FORBIDDEN", status: 403, mensagem });
    this.name = "AcessoNegado";
  }
}

/** Decide o tenant efetivo a partir do perfil e do tenant pedido pela tela. */
export function resolverTenant(perfil: PerfilGateway, solicitado?: string | null): string {
  if (solicitado != null && !FORMATO_TENANT.test(solicitado)) {
    throw new AcessoNegado("Empresa inválida.");
  }
  if (perfil.superAdmin) {
    if (!solicitado) throw new AcessoNegado("Escolha a empresa.");
    return solicitado;
  }

  const permitidos = perfil.vinculos.filter((v) => v.ativo).map((v) => v.gatewayTenantId);
  if (permitidos.length === 0) {
    throw new AcessoNegado("Sua empresa não está vinculada ao gateway de agentes.");
  }
  if (solicitado) {
    if (!permitidos.includes(solicitado)) {
      throw new AcessoNegado("Você não tem permissão para acessar dados de outra empresa.");
    }
    return solicitado;
  }
  if (permitidos.length > 1) throw new AcessoNegado("Escolha a empresa.");
  return permitidos[0]!;
}

export function criarModuloGateway(deps: {
  cliente: ClienteGateway;
  carregarPerfil: (usuario: UsuarioSessao) => Promise<PerfilGateway>;
  registrarBloqueio?: (perfil: PerfilGateway, solicitado: string | null) => Promise<void>;
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
          await deps.registrarBloqueio(perfil, solicitado).catch(() => undefined);
        }
        throw erro;
      };

      return {
        perfil,

        /** Rotas /tenants/{tenant}/... do tenant efetivo. */
        async tenant(solicitado?: string | null) {
          let id: string;
          try {
            id = resolverTenant(perfil, solicitado);
          } catch (erro) {
            return negar(solicitado ?? null, erro);
          }
          return {
            id,
            chamar<T = unknown>(metodo: MetodoGateway, partes: string[] = [], opcoes: Opcoes = {}) {
              return chamar<T>(metodo, ["tenants", id, ...partes], opcoes);
            },
            /** Leitura de /modelos-agente e /modulos com ?tenant= forçado. */
            lerGlobal<T = unknown>(partes: string[], opcoes: Opcoes = {}) {
              if (!GLOBAIS_FILTRADAS.has(partes[0] ?? "")) {
                throw new AcessoNegado("Rota não disponível para a empresa.");
              }
              return chamar<T>("GET", partes, {
                ...opcoes,
                query: { ...opcoes.query, tenant: id },
              });
            },
          };
        },

        /** Rotas globais (/tenants, /modelos-agente, /auditoria/plataforma...). */
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
