/** Convite sem SMTP: o link sai uma vez, vale 24 h e só o servidor guarda o hash. */

export const AVISO_LINK_CONVITE = "Envie este link só para a pessoa convidada";
export const VALIDADE_CONVITE_MS = 24 * 60 * 60 * 1000;

export function convitePorEmail(smtpHost: string | undefined | null) {
  return Boolean(smtpHost?.trim());
}

export function expiraConvite(agora = new Date()) {
  return new Date(agora.getTime() + VALIDADE_CONVITE_MS).toISOString();
}

/** O token fica no fragmento para não ir parar no log de acesso. */
export function linkDoConvite(site: string, token: string) {
  const base = site.replace(/\/+$/, "");
  return `${base}/#convite=${encodeURIComponent(token)}`;
}

export function conviteAberto(
  convite: { usado_em: string | null; revogado_em: string | null; expira_em: string },
  agora = new Date(),
) {
  if (convite.usado_em || convite.revogado_em) return false;
  return new Date(convite.expira_em).getTime() > agora.getTime();
}
