import { z } from "zod";
export const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
export const NOMES_DIA: Record<(typeof DIAS)[number], string> = {
  seg: "Segunda-feira",
  ter: "Terça-feira",
  qua: "Quarta-feira",
  qui: "Quinta-feira",
  sex: "Sexta-feira",
  sab: "Sábado",
  dom: "Domingo",
};
/** Fuso do painel para filtros de histórico. O registro em si continua com o offset recebido. */
export const FUSO_PAINEL = "America/Sao_Paulo";
export type Grade = Partial<Record<(typeof DIAS)[number], [string, string][]>>;
export type Situacao = {
  aberta_agora: boolean | null;
  motivo: string | null;
  fecha_as: string | null;
  proxima_abertura: string | null;
  pausada_ate: string | null;
};
export type Unidade = {
  id: string;
  nome: string;
  codigo: string | null;
  endereco: string | null;
  telefone: string | null;
  whatsapp_pedidos?: string | null;
  ativo: boolean;
  fuso: string | null;
  fuso_efetivo: string;
  cidade?: string | null;
  uf?: string | null;
  /** Só com o módulo de pedidos em uso (MULTI1-a). */
  taxa_entrega?: number | null;
  pedido_minimo?: number | null;
  area_entrega?: string | null;
  aceita_retirada?: boolean | null;
  formas_pagamento?: string | null;
  horarios?: Grade;
  situacao: Situacao;
  pausa_motivo?: string | null;
};
export type Agenda = {
  fuso: string;
  situacao: Situacao;
  dias: {
    data: string;
    dia: string;
    origem: string;
    fechado: boolean;
    faixas: [string, string][];
    motivo: string | null;
  }[];
};
export type Excecao = {
  id: number;
  data: string;
  fechado: boolean;
  faixas: [string, string][];
  motivo: string | null;
};
export type Alteracao = {
  id: number;
  actor: string;
  entidade: string;
  entidade_id: string;
  acao: string;
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
  criado_em: string;
};
export function dataRecebida(v: string | null) {
  if (!v) return "Não informado";
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:T| )(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.exec(
      v,
    );
  return m
    ? `${m[3]}/${m[2]}/${m[1]} ${m[4]} (${m[5] === "Z" ? "UTC" : m[5] ? "UTC" + m[5] : "horário do servidor"})`
    : v;
}
export type SecaoUnidade = "agenda" | "horarios" | "excecoes" | "pagamentos";
export function textoSituacao(s: Situacao) {
  if (s.aberta_agora === null) return "Horário não informado";
  if (s.aberta_agora) return "Aberta";
  if (s.motivo === "pausa")
    return s.pausada_ate
      ? `Pedidos pausados até ${dataRecebida(s.pausada_ate)}`
      : "Pedidos pausados até reabrir";
  return (
    (
      {
        inativa: "Unidade inativa",
        excecao: "Fechada por horário especial/exceção",
        horario: "Fechada neste horário",
        sem_horario: "Horário não informado",
      } as Record<string, string>
    )[s.motivo ?? ""] ?? "Fechada · motivo não informado"
  );
}
export function problemaGrade(grade: Grade): string | null {
  const intervalos: [number, number][] = [];
  for (const [dia, faixas] of Object.entries(grade)) {
    if (
      !DIAS.includes(dia as (typeof DIAS)[number]) ||
      !Array.isArray(faixas) ||
      faixas.length > 12
    )
      return "Use até 12 turnos por dia.";
    for (const faixa of faixas) {
      if (faixa.length !== 2 || faixa.some((h) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(h)))
        return "Informe as horas no formato HH:MM.";
      const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
      const inicio = minutos(faixa[0]);
      let fim = minutos(faixa[1]);
      if (fim === inicio) return "Início e fim do turno devem ser diferentes.";
      if (fim < inicio) fim += 1440;
      const base = DIAS.indexOf(dia as (typeof DIAS)[number]) * 1440;
      intervalos.push([base + inicio, base + fim]);
    }
  }
  const estendidos = intervalos
    .flatMap(([a, b]) => [
      [a, b],
      [a + 10080, b + 10080],
    ])
    .sort((a, b) => a[0]! - b[0]!);
  for (let i = 1; i < estendidos.length; i++)
    if (estendidos[i]![0]! < estendidos[i - 1]![1]!)
      return "Há turnos sobrepostos, inclusive na passagem para o dia seguinte.";
  return null;
}
const telefone = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => /^\d{10,15}$/.test(v), "Informe telefone com DDI, de 10 a 15 dígitos.")
  .nullable();
const fuso = z
  .string()
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Fuso inválido.")
  .nullable();
/** As 27 UFs. O gateway só confere duas letras maiúsculas; a lista fechada fica no painel. */
export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export function cidadeUf(u: { cidade?: string | null; uf?: string | null }) {
  if (!u.cidade) return null;
  return u.uf ? `${u.cidade}/${u.uf}` : u.cidade;
}
const faixa = z.tuple([z.string(), z.string()]);
export const gradeSchema = z
  .object(Object.fromEntries(DIAS.map((d) => [d, z.array(faixa).max(12).optional()])))
  .strict()
  .superRefine((g, ctx) => {
    const erro = problemaGrade(g as Grade);
    if (erro) ctx.addIssue({ code: "custom", message: erro, path: ["horarios"] });
  });
const alvo = {
  empresa: z
    .string()
    .regex(/^[a-z0-9_]{3,40}$/)
    .nullish(),
};
const uid = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const dinheiro = z.number().nonnegative().max(999999).nullable().optional();
const dadosUnidade = z
  .object({
    nome: z.string().trim().min(1).max(200).optional(),
    codigo: z.string().trim().min(1).max(80).nullable().optional(),
    endereco: z.string().max(1000).nullable().optional(),
    telefone: telefone.optional(),
    whatsapp_pedidos: telefone.optional(),
    ativo: z.boolean().optional(),
    fuso: fuso.optional(),
    cidade: z.string().trim().min(1).max(80).nullable().optional(),
    uf: z.enum(UFS).nullable().optional(),
    // Entrega/pagamento: o servidor só encaminha com pedidos em uso.
    taxa_entrega: dinheiro,
    pedido_minimo: dinheiro,
    area_entrega: z.string().trim().max(2000).nullable().optional(),
    aceita_retirada: z.boolean().nullable().optional(),
    formas_pagamento: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
const formaPagamento = z
  .object({
    codigo: z
      .string()
      .regex(/^[a-z0-9_]{2,30}$/, "Código: 2 a 30 letras minúsculas, números ou _."),
    rotulo: z.string().trim().min(2, "O rótulo precisa de 2 a 40 caracteres.").max(40),
    ativo: z.boolean(),
    aceita_troco: z.boolean(),
    instrucoes: z.string().max(300).nullable().optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.aceita_troco && item.codigo !== "dinheiro")
      ctx.addIssue({
        code: "custom",
        message: "Troco só vale para dinheiro.",
        path: ["aceita_troco"],
      });
  });
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const gestaoSchema = z.discriminatedUnion("acao", [
  z.object({ ...alvo, acao: z.literal("listar") }).strict(),
  z.object({ ...alvo, acao: z.literal("obter"), id: uid }).strict(),
  z.object({ ...alvo, acao: z.literal("agenda"), id: uid }).strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("criar"),
      dados: dadosUnidade.extend({ nome: z.string().trim().min(1).max(200) }),
    })
    .strict(),
  z.object({ ...alvo, acao: z.literal("editar"), id: uid, dados: dadosUnidade }).strict(),
  z.object({ ...alvo, acao: z.literal("horarios"), id: uid, grade: gradeSchema }).strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("pausar"),
      id: uid,
      ate: z.string().optional(),
      indefinida: z.literal(true).optional(),
      motivo: z.string().max(200).optional(),
    })
    .strict(),
  z.object({ ...alvo, acao: z.literal("reabrir"), id: uid }).strict(),
  z.object({ ...alvo, acao: z.literal("pagamentos"), id: uid }).strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("salvar_pagamentos"),
      id: uid,
      itens: z
        .array(formaPagamento)
        .max(12, "No máximo 12 formas.")
        .superRefine((itens, ctx) => {
          const vistos = new Map<string, number>();
          itens.forEach((item, i) => {
            const anterior = vistos.get(item.codigo);
            if (anterior !== undefined)
              ctx.addIssue({
                code: "custom",
                message: "Este código já está na lista.",
                path: [i, "codigo"],
              });
            vistos.set(item.codigo, i);
          });
        }),
    })
    .strict(),
  z.object({ ...alvo, acao: z.literal("fuso_empresa") }).strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("aplicar_pausas"),
      ids: z.array(uid).min(1).max(40),
      ate: z.string().optional(),
      indefinida: z.literal(true).optional(),
      motivo: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("aplicar_excecoes"),
      itens: z
        .array(
          z
            .object({
              id: uid,
              data: dia,
              fechado: z.literal(true).optional(),
              faixas: z.array(faixa).max(12).optional(),
              motivo: z.string().max(200).optional(),
            })
            .strict(),
        )
        .min(1)
        .max(80),
    })
    .strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("excecoes"),
      id: uid,
      desde: dia.optional(),
      ate: dia.optional(),
    })
    .strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("excecao"),
      id: uid,
      data: dia,
      fechado: z.literal(true).optional(),
      faixas: z.array(faixa).max(12).optional(),
      motivo: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("excluir_excecao"),
      id: uid,
      eid: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("historico"),
      entidade: z.enum(["unidade", "excecao"]).optional(),
      entidade_id: z.string().max(150).optional(),
      unidade_id: uid.optional(),
      desde: z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
          "Informe data e hora com fuso.",
        )
        .optional(),
      ate: z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
          "Informe data e hora com fuso.",
        )
        .optional(),
      cursor: z.number().int().positive().optional(),
    })
    .strict(),
]);
export type PedidoGestao = z.infer<typeof gestaoSchema>;
// Converte entrada civil no fuso escolhido, sem depender do fuso do navegador.
export function instanteLocal(valor: string, fuso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) throw new Error("Informe data e hora.");
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const civil = (ms: number) => fmt.format(new Date(ms)).replace(" ", "T");
  const base = Date.parse(valor + ":00Z");
  const candidatos = new Set<number>();
  for (let h = -36; h <= 36; h++) {
    const t = base + h * 3600000;
    const offset = Date.parse(civil(t) + ":00Z") - t;
    const candidato = base - offset;
    if (civil(candidato) === valor) candidatos.add(candidato);
  }
  if (candidatos.size !== 1)
    throw new Error("Horário inexistente ou ambíguo neste fuso. Escolha outro horário.");
  const instante = [...candidatos][0]!;
  const offset = Math.round((base - instante) / 60000);
  const abs = Math.abs(offset);
  return `${valor}:00${offset < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
function diaCivilSeguinte(data: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) throw new Error("Informe a data.");
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}
/** Período do histórico: início inclusivo e fim exclusivo, no fuso informado. */
export function periodoNoFuso(desde?: string, ate?: string, fuso = FUSO_PAINEL) {
  return {
    ...(desde ? { desde: instanteLocal(`${desde}T00:00`, fuso) } : {}),
    ...(ate ? { ate: instanteLocal(`${diaCivilSeguinte(ate)}T00:00`, fuso) } : {}),
  };
}
function relogioNoFuso(ms: number, fuso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(ms))
    .replace(" ", "T");
}
/** Prazo de pausa a partir de agora, no fuso da unidade, com offset. */
export function instanteDaqui(minutos: number, fuso: string, agora = Date.now()) {
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 60 * 24 * 60)
    throw new Error("Escolha um prazo em minutos.");
  return instanteLocal(relogioNoFuso(agora + minutos * 60_000, fuso), fuso);
}
/** Usa o fecha_as recebido. Nulo se não houver, se já passou ou se passar de 60 dias. */
export function fimDeTurnoUtil(fechaAs: string | null, agora = Date.now()) {
  if (!fechaAs || !/(Z|[+-]\d{2}:\d{2})$/.test(fechaAs) || !Number.isFinite(Date.parse(fechaAs)))
    return null;
  const t = Date.parse(fechaAs);
  if (t <= agora || t > agora + 60 * 86400000) return null;
  return fechaAs;
}
export function anoCivil(fuso: string, agora = Date.now()) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: fuso, year: "numeric" }).format(agora),
  );
}
export type Feriado = { data: string; nome: string; tipo: "fixo" | "movel" };
function pascoa(ano: number) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}
function deslocar(ano: number, mes: number, dia: number, dias: number) {
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  dt.setUTCDate(dt.getUTCDate() + dias);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
/** Feriados nacionais: datas fixas e móveis (Carnaval, Sexta-feira Santa, Corpus Christi). */
export function feriadosNacionais(ano: number): Feriado[] {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new Error("Escolha um ano válido.");
  const p = pascoa(ano);
  const fixos: [string, string][] = [
    ["01-01", "Confraternização Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclamação da República"],
    ["11-20", "Consciência Negra"],
    ["12-25", "Natal"],
  ];
  const lista: Feriado[] = [
    ...fixos.map(([md, nome]) => ({ data: `${ano}-${md}`, nome, tipo: "fixo" as const })),
    { data: deslocar(ano, p.mes, p.dia, -48), nome: "Segunda-feira de Carnaval", tipo: "movel" },
    { data: deslocar(ano, p.mes, p.dia, -47), nome: "Terça-feira de Carnaval", tipo: "movel" },
    { data: deslocar(ano, p.mes, p.dia, -2), nome: "Sexta-feira Santa", tipo: "movel" },
    { data: deslocar(ano, p.mes, p.dia, 60), nome: "Corpus Christi", tipo: "movel" },
  ];
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}
export function alertasUnidade(
  u: {
    ativo: boolean;
    situacao: Situacao;
    whatsapp_pedidos?: string | null;
    cidade?: string | null;
  },
  verWhatsapp: boolean,
) {
  return {
    semHorario:
      u.ativo && (u.situacao.aberta_agora === null || u.situacao.motivo === "sem_horario"),
    semWhatsapp: verWhatsapp && u.ativo && !u.whatsapp_pedidos,
    semCidade: u.ativo && !u.cidade,
  };
}
export function gradeCopiada(origem: Grade | undefined): Grade {
  const n: Grade = {};
  for (const d of DIAS) if (origem?.[d]?.length) n[d] = origem[d]!.map((f) => [f[0], f[1]]);
  return n;
}
export function pendentesDe<T extends { chave: string }>(
  itens: T[],
  concluidos: readonly string[],
) {
  const ok = new Set(concluidos);
  return itens.filter((item) => !ok.has(item.chave));
}
