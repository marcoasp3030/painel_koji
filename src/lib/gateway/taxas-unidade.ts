/** Taxa de entrega da unidade: regras do editor do painel. O cálculo de verdade é do gateway. */
export type ModoTaxa = "fixa" | "bairro" | "cep";

export type LinhaServidor = {
  id?: number;
  tipo: "bairro" | "cep";
  bairro?: string | null;
  apelidos?: string[];
  atendido?: boolean;
  cep_inicio?: string | null;
  cep_fim?: string | null;
  taxa: number | null;
  ativo: boolean;
};
export type VisaoTaxas = {
  modo: ModoTaxa | null;
  taxa_fixa: number | null;
  frete_gratis_acima: number | null;
  itens: LinhaServidor[];
};

export type Bairro = {
  chave: number;
  nome: string;
  apelidos: string;
  atendido: boolean;
  taxa: string;
  ativo: boolean;
};
export type Faixa = { chave: number; inicio: string; fim: string; taxa: string; ativo: boolean };

export type EditorTaxas = {
  modo: ModoTaxa;
  taxaFixa: string;
  freteGratis: string;
  bairros: Bairro[];
  faixas: Faixa[];
};

let proxima = 1;
const chave = () => (proxima += 1);
const texto = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : v.toFixed(2).replace(".", ",");

export const mascaraCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export const bairroNovo = (): Bairro => ({
  chave: chave(),
  nome: "",
  apelidos: "",
  atendido: true,
  taxa: "",
  ativo: true,
});
export const faixaNova = (): Faixa => ({
  chave: chave(),
  inicio: "",
  fim: "",
  taxa: "",
  ativo: true,
});

export function doServidor(v: VisaoTaxas): EditorTaxas {
  return {
    modo: v.modo ?? "fixa",
    taxaFixa: texto(v.taxa_fixa),
    freteGratis: texto(v.frete_gratis_acima),
    bairros: v.itens
      .filter((i) => i.tipo === "bairro")
      .map((i) => ({
        chave: chave(),
        nome: i.bairro ?? "",
        apelidos: (i.apelidos ?? []).join(", "),
        atendido: i.atendido !== false,
        taxa: texto(i.taxa),
        ativo: i.ativo,
      })),
    faixas: v.itens
      .filter((i) => i.tipo === "cep")
      .map((i) => ({
        chave: chave(),
        inicio: mascaraCep(i.cep_inicio ?? ""),
        fim: mascaraCep(i.cep_fim ?? ""),
        taxa: texto(i.taxa),
        ativo: i.ativo,
      })),
  };
}

/** "4,50", "4.5" e "" (vazio). null quando não é um valor aceito. */
export function lerValor(t: string): number | "" | null {
  const v = t.trim().replace(",", ".");
  if (!v) return "";
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  return Number(v);
}

const apelidos = (t: string) =>
  t
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

/** O que impede salvar, em palavras. O gateway confere de novo (sobreposição de faixas, por exemplo). */
export function problemaNasTaxas(e: EditorTaxas) {
  if (lerValor(e.taxaFixa) === null) return "Taxa fixa inválida. Use, por exemplo, 7,50.";
  const frete = lerValor(e.freteGratis);
  if (frete === null || frete === 0) return "Frete grátis: informe um valor maior que zero.";
  for (const b of e.bairros) {
    const nome = b.nome.trim();
    if (nome.length < 2) return "Dê um nome a cada bairro.";
    if (!b.atendido) continue;
    const v = lerValor(b.taxa);
    if (v === "" || v === null) return `${nome}: informe a taxa.`;
    if (v > 999.99) return `${nome}: a taxa vai até R$ 999,99.`;
  }
  for (const f of e.faixas) {
    const i = f.inicio.replace(/\D/g, "");
    const fim = f.fim.replace(/\D/g, "");
    if (i.length !== 8 || fim.length !== 8) return "Informe os 8 dígitos de cada CEP.";
    if (i > fim) return `Faixa ${f.inicio}: o CEP inicial precisa vir antes do final.`;
    const v = lerValor(f.taxa);
    if (v === "" || v === null) return `Faixa ${f.inicio}: informe a taxa.`;
    if (v > 999.99) return `Faixa ${f.inicio}: a taxa vai até R$ 999,99.`;
  }
  if (e.modo === "bairro" && !e.bairros.some((b) => b.ativo))
    return "Inclua ao menos um bairro ativo, ou use valor fixo.";
  if (e.modo === "cep" && !e.faixas.some((f) => f.ativo))
    return "Inclua ao menos uma faixa de CEP ativa, ou use valor fixo.";
  return null;
}

export function linhasParaEnvio(e: EditorTaxas) {
  return [
    ...e.bairros.map((b) => ({
      tipo: "bairro" as const,
      bairro: b.nome.trim(),
      apelidos: apelidos(b.apelidos),
      atendido: b.atendido,
      taxa: b.atendido ? (lerValor(b.taxa) as number) : null,
      ativo: b.ativo,
    })),
    ...e.faixas.map((f) => ({
      tipo: "cep" as const,
      cep_inicio: f.inicio.replace(/\D/g, ""),
      cep_fim: f.fim.replace(/\D/g, ""),
      taxa: lerValor(f.taxa) as number,
      ativo: f.ativo,
    })),
  ];
}

export function camposDaUnidade(e: EditorTaxas) {
  const fixa = lerValor(e.taxaFixa);
  const frete = lerValor(e.freteGratis);
  return {
    taxa_modo: e.modo,
    taxa_entrega: fixa === "" || fixa === null ? null : fixa,
    frete_gratis_acima: frete === "" || frete === null ? null : frete,
  };
}
