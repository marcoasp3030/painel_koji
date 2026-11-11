/** Regras da tela Usuários da plataforma (super admin). */

import { EMAIL_CONTA_EMERGENCIA } from "@/lib/acesso/segunda-etapa";

export type UsuarioPlataformaLinha = {
  user_id: string;
  email: string;
  nome: string | null;
  ultimo_acesso: string | null;
  criado_em: string | null;
  emergencia: boolean;
  eu: boolean;
  /** Dá para tirar o papel de plataforma (não é você, nem emergência, nem o último). */
  podeRemover: boolean;
};

export function filtrarUsuariosPlataforma<T extends { email: string; nome: string | null }>(
  lista: T[],
  busca: string,
) {
  const q = busca.trim().toLowerCase();
  if (!q) return lista;
  return lista.filter(
    (u) =>
      u.email.toLowerCase().includes(q) || (u.nome ?? "").toLowerCase().includes(q),
  );
}

export function ehContaEmergencia(email: string | null | undefined) {
  return email?.trim().toLowerCase() === EMAIL_CONTA_EMERGENCIA;
}

/** Monta flags de proteção: não remove a si, emergência nem o único super admin. */
export function flagsUsuarioPlataforma(entrada: {
  user_id: string;
  email: string;
  euId: string;
  totalPlataforma: number;
}): Pick<UsuarioPlataformaLinha, "eu" | "emergencia" | "podeRemover"> {
  const eu = entrada.user_id === entrada.euId;
  const emergencia = ehContaEmergencia(entrada.email);
  return {
    eu,
    emergencia,
    podeRemover: !eu && !emergencia && entrada.totalPlataforma > 1,
  };
}
