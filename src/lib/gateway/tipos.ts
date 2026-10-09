/** Formatos das respostas do gateway usados pelas telas (sem segredos). */

export type PapelGateway = "plataforma" | "admin" | "membro";

export type Pagina<T> = { itens: T[]; proximo_cursor: string | null };

export type EmpresaGateway = {
  id: string;
  nome: string;
  status: "ativo" | "suspenso";
  plano: string | null;
  limite_turnos_mes: number | null;
  timezone: string;
  retencao_dias: number | null;
  tenant_teste: boolean;
  criado_em: string;
};

export type EmpresaPainel = {
  id: string;
  name: string;
  slug: string;
  status: string;
  gateway_tenant_id: string | null;
};
