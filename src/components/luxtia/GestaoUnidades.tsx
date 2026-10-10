import { useEffect, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { gestao } from "@/lib/gateway-gestao.functions";
import {
  DIAS,
  dataRecebida,
  textoSituacao,
  instanteLocal,
  problemaGrade,
  type Unidade,
  type Grade,
  type Agenda,
  type Excecao,
  type PedidoGestao,
} from "@/lib/gateway/gestao";
import type { ContextoGateway } from "./Gateway";
import { Cartao } from "./Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function useGestao(ctx: ContextoGateway) {
  const fn = useServerFn(gestao);
  const qc = useQueryClient();
  const [erro, setErro] = useState<{ campo: string; mensagem: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function ler<T>(d: Omit<PedidoGestao, "empresa">): Promise<T> {
    const r = await fn({ data: { ...d, empresa: ctx.empresa } });
    if (!r.ok) throw new Error(r.erro.mensagem);
    return r.dados as T;
  }
  async function salvar(d: Record<string, unknown>) {
    setBusy(true);
    setErro(null);
    try {
      const r = await fn({ data: { ...d, empresa: ctx.empresa } });
      if (!r.ok) {
        setErro(r.erro);
        return false;
      }
      await qc.invalidateQueries({ queryKey: ["gestao", ctx.empresa] });
      toast.success("Alteração salva.");
      return true;
    } catch (e) {
      setErro({
        campo: "corpo",
        mensagem: e instanceof Error ? e.message : "Não foi possível salvar.",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { ler, salvar, erro, setErro, busy };
}
type G = ReturnType<typeof useGestao>;
function Erro({ g, campo }: { g: G; campo?: string }) {
  return g.erro && (!campo || g.erro.campo === campo) ? (
    <p role="alert" className="text-sm text-red-700">
      {g.erro.mensagem}
    </p>
  ) : null;
}
function ProtegeRascunho({ sujo }: { sujo: boolean }) {
  useBlocker({ shouldBlockFn: () => sujo && !window.confirm("Descartar alterações não salvas?") });
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const trocar = (e: Event) => {
      if (!window.confirm("Descartar alterações não salvas?")) e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    window.addEventListener("gestao:trocar", trocar);
    return () => {
      window.removeEventListener("beforeunload", f);
      window.removeEventListener("gestao:trocar", trocar);
    };
  }, [sujo]);
  return null;
}
export function SituacaoUnidade({ u }: { u: Unidade }) {
  return (
    <div className="space-y-1 text-sm">
      <strong className={u.situacao.aberta_agora === true ? "text-green-800" : "text-amber-900"}>
        {textoSituacao(u.situacao)}
      </strong>
      {u.situacao.fecha_as && <p>Fecha: {dataRecebida(u.situacao.fecha_as)}</p>}
      {u.situacao.proxima_abertura && (
        <p>Próxima abertura: {dataRecebida(u.situacao.proxima_abertura)}</p>
      )}
      {u.pausa_motivo && u.situacao.motivo === "pausa" && <p>Motivo: {u.pausa_motivo}</p>}
      <p>Fuso: {u.fuso_efetivo}</p>
    </div>
  );
}
export function GestaoUnidades({ ctx }: { ctx: ContextoGateway }) {
  const g = useGestao(ctx);
  const [id, setId] = useState<string | null>(null);
  const [editar, setEditar] = useState<Unidade | "nova" | null>(null);
  const [pausar, setPausar] = useState<Unidade | null>(null);
  const q = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades"],
    queryFn: () => g.ler<{ itens: Unidade[] }>({ acao: "listar" }),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const admin = ctx.papel !== "membro";
  if (id) return <Detalhe key={id} ctx={ctx} id={id} voltar={() => setId(null)} />;
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p>Unidades da empresa · situação informada pelo gateway</p>
        {admin && <Button onClick={() => setEditar("nova")}>Nova unidade</Button>}
      </div>
      {q.isPending ? <p>Carregando unidades…</p> : null}
      {q.error ? (
        <p role="alert">
          {q.error.message} {q.data ? "A informação abaixo pode estar desatualizada." : ""}{" "}
          <Button variant="outline" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : null}
      {q.data?.itens.length === 0 ? <Cartao>Nenhuma unidade cadastrada.</Cartao> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {q.data?.itens.map((u) => (
          <Cartao key={u.id}>
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{u.nome}</h2>
              <p className="text-sm">
                {u.codigo} · {u.endereco ?? "Endereço não informado"}
              </p>
              <SituacaoUnidade u={u} />
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" variant="outline" onClick={() => setId(u.id)}>
                  Ver unidade e agenda
                </Button>
                <Button
                  className="min-h-11"
                  disabled={g.busy}
                  onClick={() =>
                    u.situacao.motivo === "pausa"
                      ? window.confirm(
                          "Remover a pausa? O horário cadastrado continuará valendo.",
                        ) && g.salvar({ acao: "reabrir", id: u.id })
                      : setPausar(u)
                  }
                >
                  {u.situacao.motivo === "pausa" ? "Reabrir pedidos" : "Pausar pedidos"}
                </Button>
                {admin && (
                  <Button variant="outline" onClick={() => setEditar(u)}>
                    Editar dados
                  </Button>
                )}
              </div>
            </div>
          </Cartao>
        ))}
      </div>
      <Erro g={g} />
      {editar && (
        <DadosUnidade
          ctx={ctx}
          u={editar === "nova" ? null : editar}
          fechar={() => setEditar(null)}
        />
      )}
      {pausar && <Pausa ctx={ctx} u={pausar} fechar={() => setPausar(null)} />}
    </div>
  );
}
function DadosUnidade({
  ctx,
  u,
  fechar,
}: {
  ctx: ContextoGateway;
  u: Unidade | null;
  fechar: () => void;
}) {
  const g = useGestao(ctx);
  const inicial = {
    nome: u?.nome ?? "",
    codigo: u?.codigo ?? "",
    endereco: u?.endereco ?? "",
    telefone: u?.telefone ?? "",
    whatsapp_pedidos: u?.whatsapp_pedidos ?? "",
    fuso: u?.fuso ?? "",
  };
  const [v, setV] = useState(inicial);
  const [ativo, setAtivo] = useState(u?.ativo ?? true);
  const sujo = JSON.stringify(v) !== JSON.stringify(inicial) || ativo !== (u?.ativo ?? true);
  const sair = () => {
    if (!sujo || window.confirm("Descartar alterações não salvas?")) fechar();
  };
  return (
    <Dialog open onOpenChange={(a) => !a && !g.busy && sair()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <ProtegeRascunho sujo={sujo} />
        <DialogHeader>
          <DialogTitle>{u ? `Editar ${u.nome}` : "Nova unidade"}</DialogTitle>
          <DialogDescription>
            Dados da unidade. Fuso vazio usa o da empresa. Telefone com DDI (10 a 15 dígitos).
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const dados: Record<string, unknown> = {};
            for (const k of Object.keys(v) as (keyof typeof v)[]) {
              if (!u || v[k] !== inicial[k])
                dados[k] = k === "nome" ? v[k].trim() : v[k].trim() || null;
            }
            if (!u || ativo !== u.ativo) dados["ativo"] = ativo;
            if (
              u &&
              v.fuso !== inicial.fuso &&
              !window.confirm("Alterar o fuso? Os horários HH:MM cadastrados serão mantidos.")
            )
              return;
            if (await g.salvar(u ? { acao: "editar", id: u.id, dados } : { acao: "criar", dados }))
              fechar();
          }}
        >
          {Object.entries({
            nome: "Nome",
            codigo: "Código",
            endereco: "Endereço",
            telefone: "Telefone com DDI",
            whatsapp_pedidos: "WhatsApp de pedidos com DDI",
            fuso: "Fuso IANA (vazio herda empresa)",
          }).map(([k, label]) => (
            <div key={k}>
              <Label htmlFor={`un-${k}`}>{label}</Label>
              <Input
                id={`un-${k}`}
                required={k === "nome"}
                value={v[k as keyof typeof v]}
                disabled={g.busy}
                aria-invalid={g.erro?.campo === k}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
              <Erro g={g} campo={k} />
            </div>
          ))}
          <p className="text-sm text-ink-500">
            WhatsApp vazio: pedidos ficam no painel, sem aviso para esse número.{" "}
            {u && `Fuso em vigor: ${u.fuso_efetivo}.`}
          </p>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={ativo}
              disabled={g.busy}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Unidade ativa
          </label>
          <Erro g={g} />
          <Button disabled={g.busy}>Salvar dados</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Pausa({ ctx, u, fechar }: { ctx: ContextoGateway; u: Unidade; fechar: () => void }) {
  const g = useGestao(ctx);
  const [ind, setInd] = useState(false);
  const [ate, setAte] = useState("");
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open onOpenChange={(a) => !a && !g.busy && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pausar pedidos · {u.nome}</DialogTitle>
          <DialogDescription>
            Data e hora no fuso {u.fuso_efetivo}. Prazo máximo de 60 dias; termina sozinho e volta a
            seguir a grade.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const prazo = ind
                ? { indefinida: true }
                : { ate: instanteLocal(ate, u.fuso_efetivo) };
              if (await g.salvar({ acao: "pausar", id: u.id, ...prazo, motivo })) fechar();
            } catch (e) {
              g.setErro({
                campo: "ate",
                mensagem: e instanceof Error ? e.message : "Confira o horário.",
              });
            }
          }}
        >
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={ind}
              onChange={(e) => setInd(e.target.checked)}
              disabled={g.busy}
            />
            Até eu reabrir
          </label>
          {!ind && (
            <div>
              <Label htmlFor="pausa-ate">Pausar até (hoje ou outra data)</Label>
              <Input
                id="pausa-ate"
                type="datetime-local"
                required
                value={ate}
                onChange={(e) => setAte(e.target.value)}
                disabled={g.busy}
                aria-invalid={g.erro?.campo === "ate"}
              />
              <Erro g={g} campo="ate" />
            </div>
          )}
          <div>
            <Label htmlFor="pausa-motivo">Motivo (opcional)</Label>
            <Input
              id="pausa-motivo"
              value={motivo}
              maxLength={200}
              disabled={g.busy}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <Erro g={g} campo="motivo" />
          </div>
          <Erro g={g} />
          <Button className="min-h-11 w-full" disabled={g.busy}>
            Confirmar pausa
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Detalhe({ ctx, id, voltar }: { ctx: ContextoGateway; id: string; voltar: () => void }) {
  const g = useGestao(ctx);
  const [aba, setAba] = useState("agenda");
  const [pausa, setPausa] = useState(false);
  const [editar, setEditar] = useState(false);
  const q = useQuery({
    queryKey: ["gestao", ctx.empresa, id],
    queryFn: () => g.ler<Unidade>({ acao: "obter", id } as PedidoGestao),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const u = q.data;
  return (
    <div className="mt-6 space-y-4">
      <Button
        variant="outline"
        onClick={() => {
          if (window.dispatchEvent(new Event("gestao:trocar", { cancelable: true }))) voltar();
        }}
      >
        ← Unidades
      </Button>
      {q.error && (
        <p role="alert">
          {q.error.message} <Button onClick={() => q.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {!u ? (
        <p>Carregando unidade…</p>
      ) : (
        <>
          <Cartao>
            <h2 className="text-xl font-semibold">{u.nome}</h2>
            <p>{u.endereco}</p>
            <SituacaoUnidade u={u} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                disabled={g.busy}
                onClick={() =>
                  u.situacao.motivo === "pausa"
                    ? window.confirm("Remover a pausa? O horário cadastrado continuará valendo.") &&
                      g.salvar({ acao: "reabrir", id })
                    : setPausa(true)
                }
              >
                {u.situacao.motivo === "pausa" ? "Reabrir pedidos" : "Pausar pedidos"}
              </Button>
              {ctx.papel !== "membro" && (
                <Button variant="outline" onClick={() => setEditar(true)}>
                  Editar dados
                </Button>
              )}
            </div>
            <Erro g={g} />
          </Cartao>
          <div className="flex flex-wrap gap-2">
            {(ctx.papel === "membro" ? ["agenda"] : ["agenda", "horarios", "excecoes"]).map((a) => (
              <Button
                variant={aba === a ? "default" : "outline"}
                key={a}
                onClick={() => {
                  if (
                    aba === a ||
                    window.confirm("Trocar de seção? Alterações não salvas serão descartadas.")
                  )
                    setAba(a);
                }}
              >
                {
                  {
                    agenda: "Agenda · 7 dias",
                    horarios: "Grade semanal",
                    excecoes: "Exceções por data",
                  }[a]
                }
              </Button>
            ))}
          </div>
          {aba === "agenda" ? (
            <Previa ctx={ctx} id={id} />
          ) : aba === "horarios" && ctx.papel !== "membro" ? (
            <Horarios ctx={ctx} u={u} />
          ) : ctx.papel !== "membro" ? (
            <Excecoes ctx={ctx} u={u} />
          ) : null}
          {pausa && <Pausa ctx={ctx} u={u} fechar={() => setPausa(false)} />}{" "}
          {editar && <DadosUnidade ctx={ctx} u={u} fechar={() => setEditar(false)} />}
        </>
      )}
    </div>
  );
}
function Previa({ ctx, id }: { ctx: ContextoGateway; id: string }) {
  const g = useGestao(ctx);
  const q = useQuery({
    queryKey: ["gestao", ctx.empresa, id, "agenda"],
    queryFn: () => g.ler<Agenda>({ acao: "agenda", id } as PedidoGestao),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  return (
    <Cartao>
      <h3 className="font-semibold">Próximos 7 dias · configuração salva</h3>
      {q.isPending && <p>Carregando agenda…</p>}
      {q.error && (
        <p role="alert">
          {q.error.message} <Button onClick={() => q.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {q.data && (
        <>
          <p>
            Fuso: {q.data.fuso} · {textoSituacao(q.data.situacao)}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {q.data.dias.map((d) => (
              <div key={d.data} className="rounded border p-3">
                <strong>
                  {d.data.split("-").reverse().join("/")} · {d.dia}
                </strong>
                <p>{d.origem === "excecao" ? "Exceção" : "Grade semanal"}</p>
                <p>
                  {q.data.situacao.aberta_agora === null && d.origem !== "excecao"
                    ? "Horário não informado"
                    : d.fechado
                      ? "Fechado"
                      : d.faixas
                          .map(([a, b]) => `${a}–${b}${b < a ? " (dia seguinte)" : ""}`)
                          .join(", ")}
                </p>
                {d.motivo && <p>{d.motivo}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </Cartao>
  );
}
export function EditorFaixas({
  faixas,
  onChange,
  disabled = false,
}: {
  faixas: [string, string][];
  onChange: (v: [string, string][]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {faixas.map(([a, b], i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            className="w-28"
            aria-label={`Início do turno ${i + 1}`}
            type="time"
            value={a}
            disabled={disabled}
            onChange={(e) => onChange(faixas.map((f, j) => (j === i ? [e.target.value, b] : f)))}
          />
          <span>até</span>
          <Input
            className="w-28"
            aria-label={`Fim do turno ${i + 1}`}
            type="time"
            value={b}
            disabled={disabled}
            onChange={(e) => onChange(faixas.map((f, j) => (j === i ? [a, e.target.value] : f)))}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange(faixas.filter((_, j) => j !== i))}
          >
            Remover turno {i + 1}
          </Button>
          {b < a && <span className="text-sm">Termina no dia seguinte</span>}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled || faixas.length >= 12}
        onClick={() => onChange([...faixas, ["12:00", "15:00"]])}
      >
        Adicionar turno
      </Button>
    </div>
  );
}
function Horarios({ ctx, u }: { ctx: ContextoGateway; u: Unidade }) {
  const g = useGestao(ctx);
  const [grade, setGrade] = useState<Grade>(u.horarios ?? {});
  const [salva, setSalva] = useState(JSON.stringify(u.horarios ?? {}));
  const [copiar, setCopiar] = useState<(typeof DIAS)[number] | null>(null);
  const [destinos, setDestinos] = useState<string[]>([]);
  const problema = problemaGrade(grade);
  const sujo = JSON.stringify(grade) !== salva;
  return (
    <Cartao>
      <ProtegeRascunho sujo={sujo} />
      <h3 className="font-semibold">Grade semanal · {u.fuso_efetivo}</h3>
      <p className="text-sm">
        Até 12 turnos por dia. Fim menor que início termina no dia seguinte. Sem nenhum turno:
        horário não informado.
      </p>
      {sujo && (
        <p role="status">Alterações não salvas; a agenda ainda mostra a configuração salva.</p>
      )}
      <div className="my-4 space-y-4">
        {DIAS.map((d) => (
          <fieldset key={d} className="rounded border p-3">
            <legend className="px-2 font-semibold">
              {
                {
                  seg: "Segunda",
                  ter: "Terça",
                  qua: "Quarta",
                  qui: "Quinta",
                  sex: "Sexta",
                  sab: "Sábado",
                  dom: "Domingo",
                }[d]
              }
            </legend>
            {!grade[d]?.length && (
              <p className="text-sm">Fechado neste dia (se houver grade cadastrada).</p>
            )}
            <EditorFaixas
              disabled={g.busy}
              faixas={grade[d] ?? []}
              onChange={(v) =>
                setGrade((prev) => {
                  const n = { ...prev };
                  if (v.length) n[d] = v;
                  else delete n[d];
                  return n;
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCopiar(d);
                setDestinos([]);
              }}
            >
              Copiar para outros dias
            </Button>
          </fieldset>
        ))}
      </div>
      {problema && (
        <p role="alert" className="text-red-700">
          {problema}
        </p>
      )}
      <Erro g={g} />
      <Button
        disabled={!!problema || g.busy}
        onClick={async () => {
          if (await g.salvar({ acao: "horarios", id: u.id, grade }))
            setSalva(JSON.stringify(grade));
        }}
      >
        Salvar grade inteira
      </Button>
      {copiar && (
        <Dialog open onOpenChange={(a) => !a && setCopiar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copiar turnos de {copiar}</DialogTitle>
              <DialogDescription>
                Substitui os turnos dos dias selecionados, inclusive por fechado se a origem estiver
                vazia.
              </DialogDescription>
            </DialogHeader>
            {DIAS.filter((d) => d !== copiar).map((d) => (
              <label key={d} className="flex min-h-11 gap-2">
                <input
                  type="checkbox"
                  checked={destinos.includes(d)}
                  onChange={(e) =>
                    setDestinos(
                      e.target.checked ? [...destinos, d] : destinos.filter((x) => x !== d),
                    )
                  }
                />
                {d}
              </label>
            ))}
            <Button
              disabled={!destinos.length}
              onClick={() => {
                setGrade((prev) => {
                  const n = { ...prev };
                  for (const d of destinos as (typeof DIAS)[number][])
                    if (prev[copiar]?.length) n[d] = prev[copiar]!.map((f) => [...f]);
                    else delete n[d];
                  return n;
                });
                setCopiar(null);
              }}
            >
              Confirmar substituição nos dias escolhidos
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </Cartao>
  );
}
function Excecoes({ ctx, u }: { ctx: ContextoGateway; u: Unidade }) {
  const g = useGestao(ctx);
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [data, setData] = useState("");
  const [fechado, setFechado] = useState(true);
  const [faixas, setFaixas] = useState<[string, string][]>([["12:00", "16:00"]]);
  const [motivo, setMotivo] = useState("");
  const q = useQuery({
    queryKey: ["gestao", ctx.empresa, u.id, "excecoes", desde, ate],
    queryFn: () =>
      g.ler<{ itens: Excecao[] }>({
        acao: "excecoes",
        id: u.id,
        ...(desde ? { desde } : {}),
        ...(ate ? { ate } : {}),
      } as PedidoGestao),
  });
  return (
    <Cartao>
      <ProtegeRascunho sujo={!!data || !!motivo} />
      <h3 className="font-semibold">Exceções · {u.fuso_efetivo}</h3>
      <p className="text-sm">
        Sem filtros: de ontem em diante. Exceção não corta um turno iniciado na véspera.
      </p>
      <div className="my-3 flex flex-wrap gap-3">
        <label>
          Desde
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Até
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
      </div>
      {q.isPending && <p>Carregando exceções…</p>}
      {q.error && (
        <p role="alert">
          {q.error.message}
          <Button onClick={() => q.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {q.data?.itens.length === 0 && <p>Nenhuma exceção neste período.</p>}
      {q.data?.itens.map((e) => (
        <div key={e.id} className="my-2 rounded border p-3">
          <strong>{e.data}</strong>
          <p>
            {e.fechado ? "Fechado o dia inteiro" : e.faixas.map((f) => f.join("–")).join(", ")} ·{" "}
            {e.motivo}
          </p>
          <Button
            disabled={g.busy}
            variant="outline"
            onClick={() => {
              setData(e.data);
              setFechado(e.fechado);
              setFaixas(e.faixas.length ? e.faixas : [["12:00", "16:00"]]);
              setMotivo(e.motivo ?? "");
            }}
          >
            Editar/substituir
          </Button>{" "}
          <Button
            disabled={g.busy}
            variant="outline"
            onClick={() =>
              window.confirm(`Excluir exceção de ${e.data}? A grade volta a valer.`) &&
              g.salvar({ acao: "excluir_excecao", id: u.id, eid: e.id })
            }
          >
            Excluir
          </Button>
        </div>
      ))}
      <form
        className="mt-5 space-y-3 border-t pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fechado) {
            const p = problemaGrade({ seg: faixas });
            if (p) {
              g.setErro({ campo: "faixas", mensagem: p });
              return;
            }
          }
          try {
            const atual = await g.ler<{ itens: Excecao[] }>({
              acao: "excecoes",
              id: u.id,
              desde: data,
              ate: data,
            } as PedidoGestao);
            if (
              atual.itens.length &&
              !window.confirm(
                `Substituir a exceção de ${data}? Atual: ${atual.itens[0]!.fechado ? "Fechado" : atual.itens[0]!.faixas.map((f) => f.join("–")).join(", ")}.`,
              )
            )
              return;
            if (
              await g.salvar({
                acao: "excecao",
                id: u.id,
                data,
                ...(fechado ? { fechado: true } : { faixas }),
                motivo,
              })
            ) {
              setData("");
              setMotivo("");
            }
          } catch (err) {
            g.setErro({
              campo: "corpo",
              mensagem: err instanceof Error ? err.message : "Não foi possível conferir a data.",
            });
          }
        }}
      >
        <Label htmlFor="ex-data">Data da exceção</Label>
        <Input
          id="ex-data"
          type="date"
          required
          value={data}
          onChange={(e) => setData(e.target.value)}
          disabled={g.busy}
        />
        <Erro g={g} campo="data" />
        <label className="flex min-h-11 gap-2 items-center">
          <input
            type="checkbox"
            checked={fechado}
            onChange={(e) => setFechado(e.target.checked)}
            disabled={g.busy}
          />
          Fechado o dia inteiro
        </label>
        {!fechado && <EditorFaixas faixas={faixas} onChange={setFaixas} disabled={g.busy} />}
        <Erro g={g} campo="faixas" />
        <Label htmlFor="ex-motivo">Motivo (opcional)</Label>
        <Input
          id="ex-motivo"
          value={motivo}
          maxLength={200}
          onChange={(e) => setMotivo(e.target.value)}
          disabled={g.busy}
        />
        <Erro g={g} campo="motivo" />
        <Erro g={g} />
        <Button disabled={g.busy}>Salvar exceção</Button>
      </form>
    </Cartao>
  );
}
