/** CARD-REDES: Instagram, Facebook e telefone opcionais da empresa no cardápio. */

export type TipoRede = "instagram" | "facebook" | "telefone";

/** Item ativo na página pública (cardapio/ler e resposta `usado`). */
export type RedePublica = {
  tipo: TipoRede;
  url: string;
  rotulo: string;
};

/** Linha da tela de edição (GET/PUT admin). */
export type RedeAdmin = {
  tipo: TipoRede;
  valor: string;
  ativo: boolean;
  url?: string;
};

export const TIPOS_REDE: readonly TipoRede[] = ["instagram", "facebook", "telefone"];

export const ROTULO_TIPO_REDE: Record<TipoRede, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  telefone: "Telefone",
};

export const AJUDA_TIPO_REDE: Record<TipoRede, string> = {
  instagram: "@usuario ou link do Instagram",
  facebook: "Página ou link do Facebook",
  telefone: "DDD + número, ex.: 11912345678",
};

/** Três linhas fixas da tela, na ordem mostrada ao cliente. */
export function linhasFixasDasRedes(itens: readonly RedeAdmin[] | null | undefined): RedeAdmin[] {
  const porTipo = new Map((itens ?? []).map((i) => [i.tipo, i]));
  return TIPOS_REDE.map((tipo) => {
    const atual = porTipo.get(tipo);
    return {
      tipo,
      valor: atual?.valor ?? "",
      ativo: atual?.ativo ?? true,
      url: atual?.url,
    };
  });
}

/** Corpo do PUT: só o que tem valor; ordem da tela; campo vazio fica de fora. */
export function itensParaSalvarRedes(
  linhas: readonly Pick<RedeAdmin, "tipo" | "valor" | "ativo">[],
): { tipo: TipoRede; valor: string; ativo: boolean }[] {
  return linhas
    .filter((l) => l.valor.trim())
    .map((l) => ({ tipo: l.tipo, valor: l.valor.trim(), ativo: l.ativo }));
}

/** Prévia e cliente: só ativas com valor; monta url/rótulo aproximados até o GET. */
export function redesAtivasParaExibir(
  linhas: readonly Pick<RedeAdmin, "tipo" | "valor" | "ativo" | "url">[],
): RedePublica[] {
  const saida: RedePublica[] = [];
  for (const l of linhas) {
    if (!l.ativo) continue;
    const valor = l.valor.trim();
    if (!valor) continue;
    saida.push(publicoAproximado(l.tipo, valor, l.url));
  }
  return saida;
}

function publicoAproximado(tipo: TipoRede, valor: string, urlSalva?: string): RedePublica {
  if (tipo === "instagram") {
    const usuario = valor.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
    return {
      tipo,
      url: urlSalva || `https://instagram.com/${usuario}`,
      rotulo: usuario.startsWith("@") ? usuario : `@${usuario}`,
    };
  }
  if (tipo === "facebook") {
    const caminho = valor
      .replace(/^https?:\/\/((www|m)\.)?(facebook|fb)\.com\//i, "")
      .replace(/\/$/, "");
    return { tipo, url: urlSalva || `https://facebook.com/${caminho}`, rotulo: caminho };
  }
  const digitos = valor.replace(/\D/g, "");
  const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return {
    tipo,
    url: urlSalva || `tel:+${comPais}`,
    rotulo: valor,
  };
}

export function instagramDasRedes(redes: readonly RedePublica[] | null | undefined) {
  return (redes ?? []).find((r) => r.tipo === "instagram") ?? null;
}

/** aria-label no estilo "Instagram do By Koji". */
export function ariaDaRede(tipo: TipoRede, empresa: string) {
  return `${ROTULO_TIPO_REDE[tipo]} do ${empresa}`;
}

/**
 * Texto sob a linha após 400 do gateway.
 * Motivo telefone: usa a mensagem do envelope; demais: frase curta pelo motivo.
 */
export function mensagemErroRede(motivo: string | null | undefined, mensagem: string | null | undefined) {
  if (motivo === "telefone") {
    return (mensagem && mensagem.trim()) || "Use DDD + número, ex.: 11912345678";
  }
  if (motivo === "endereco_invalido") {
    return "Use o @, o nome da página ou o link oficial da rede.";
  }
  if (motivo === "vazio") return "Preencha o campo ou deixe em branco para não mostrar.";
  if (motivo === "tipo_repetido") return "Cada rede só pode aparecer uma vez.";
  if (motivo === "tipo_invalido") return "Tipo de rede inválido.";
  if (mensagem && mensagem.trim() && mensagem !== "Confira os campos informados.") return mensagem;
  return "Confira este campo.";
}

/** Mapeia detalhes.linha (1-based no corpo enviado) de volta ao tipo da tela. */
export function tipoDaLinhaErro(
  enviados: readonly { tipo: TipoRede }[],
  linha: unknown,
): TipoRede | null {
  if (typeof linha !== "number" || !Number.isInteger(linha) || linha < 1) return null;
  return enviados[linha - 1]?.tipo ?? null;
}
