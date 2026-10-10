import { z } from "zod";
export const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
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
const dadosUnidade = z
  .object({
    nome: z.string().trim().min(1).max(200).optional(),
    codigo: z.string().trim().min(1).max(80).nullable().optional(),
    endereco: z.string().max(1000).nullable().optional(),
    telefone: telefone.optional(),
    whatsapp_pedidos: telefone.optional(),
    ativo: z.boolean().optional(),
    fuso: fuso.optional(),
  })
  .strict();
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
