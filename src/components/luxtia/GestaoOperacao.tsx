import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { peloMenos } from "@/lib/acesso/papeis";
import type { ContextoGateway } from "./Gateway";
import { Etiqueta } from "./Gateway";
import { useGestao, EditorFaixas } from "./gestao-base";
import { Cartao } from "./Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  anoCivil,
  feriadosNacionais,
  instanteLocal,
  pendentesDe,
  problemaGrade,
  textoSituacao,
  FUSO_PAINEL,
  type Agenda,
  type Feriado,
  type PedidoGestao,
  type Unidade,
} from "@/lib/gateway/gestao";

type Resultado = { chave: string; id: string; ok: boolean; mensagem?: string; data?: string };

function dataCurta(iso: string) {
  return iso.split("-").reverse().join("/");
}

export function VisaoHoje({
  ctx,
  itens,
  onAbrir,
}: {
  ctx: ContextoGateway;
  itens: Unidade[];
  onAbrir: (id: string) => void;
}) {
  const g = useGestao(ctx);
  const agendas = useQueries({
    queries: itens.map((u) => ({
      queryKey: ["gestao", ctx.empresa, u.id, "agenda"],
      queryFn: () => g.ler<Agenda>({ acao: "agenda", id: u.id } as PedidoGestao),
      staleTime: 20_000,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    })),
  });
  const pausas = itens.filter((u) => u.situacao.motivo === "pausa");
  const excecoes = itens.flatMap((u, i) =>
    (agendas[i]?.data?.dias ?? [])
      .filter((d) => d.origem === "excecao")
      .map((d) => ({ unidade: u, dia: d })),
  );
  return (
    <Cartao className="space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-2xl text-purple-800">Hoje</h2>
        <p className="text-sm text-ink-500">
          Situação e pausas vêm da lista. Exceções vêm da agenda de sete dias de cada unidade.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {itens.map((u) => (
          <button key={u.id} type="button" className="min-h-11" onClick={() => onAbrir(u.id)}>
            <Etiqueta
              tom={
                u.situacao.aberta_agora === true
                  ? "sucesso"
                  : u.situacao.motivo === "pausa"
                    ? "alerta"
                    : "neutro"
              }
            >
              {u.nome}: {textoSituacao(u.situacao)}
            </Etiqueta>
          </button>
        ))}
      </div>
      <div>
        <h3 className="font-semibold">Pausas ativas</h3>
        {pausas.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhuma pausa ativa.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {pausas.map((u) => (
              <li key={u.id}>
                {u.nome}: {textoSituacao(u.situacao)}
                {u.pausa_motivo ? ` · ${u.pausa_motivo}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Exceções nos próximos 7 dias</h3>
        {agendas.some((a) => a.isPending) && excecoes.length === 0 ? (
          <Skeleton className="mt-2 h-8" />
        ) : null}
        {itens.map((u, i) =>
          agendas[i]?.error ? (
            <p key={u.id} role="alert" className="text-sm">
              Não foi possível ler a agenda de {u.nome}. {agendas[i]?.error.message}{" "}
              <button type="button" className="underline" onClick={() => agendas[i]?.refetch()}>
                Tentar novamente
              </button>
            </p>
          ) : null,
        )}
        {agendas.every((a) => !a.isPending) && excecoes.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhuma exceção nos próximos 7 dias.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {excecoes.map(({ unidade, dia }) => (
              <li key={`${unidade.id}:${dia.data}`}>
                {dataCurta(dia.data)} · {unidade.nome} ·{" "}
                {dia.fechado
                  ? "Fechado o dia inteiro"
                  : dia.faixas.map((f) => f.join("–")).join(", ") || "Sem faixa"}
                {dia.motivo ? ` · ${dia.motivo}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Cartao>
  );
}

export function OperacaoVarias({
  ctx,
  unidades,
  selecionadas,
  onLimpar,
}: {
  ctx: ContextoGateway;
  unidades: Unidade[];
  selecionadas: string[];
  onLimpar: () => void;
}) {
  const [modo, setModo] = useState<"pausa" | "excecao" | "feriados" | null>(null);
  if (!peloMenos(ctx.papel, "supervisor")) return null;
  const escolhidas = unidades.filter((u) => selecionadas.includes(u.id));
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11" variant="outline" onClick={() => setModo("feriados")}>
          Sugerir feriados nacionais
        </Button>
        {escolhidas.length > 0 && (
          <>
            <Button className="min-h-11" onClick={() => setModo("pausa")}>
              Pausar {escolhidas.length} selecionada(s)
            </Button>
            <Button className="min-h-11" variant="outline" onClick={() => setModo("excecao")}>
              Exceção nas selecionadas
            </Button>
            <Button className="min-h-11" variant="ghost" onClick={onLimpar}>
              Limpar seleção
            </Button>
          </>
        )}
      </div>
      {modo === "pausa" && (
        <DialogoPausa ctx={ctx} unidades={escolhidas} fechar={() => setModo(null)} />
      )}
      {modo === "excecao" && (
        <DialogoExcecao ctx={ctx} unidades={escolhidas} fechar={() => setModo(null)} />
      )}
      {modo === "feriados" && (
        <DialogoFeriados
          ctx={ctx}
          unidades={unidades}
          preselecionadas={selecionadas}
          fechar={() => setModo(null)}
        />
      )}
    </>
  );
}

function nomes(unidades: Unidade[], ids: string[]) {
  return ids.map((id) => unidades.find((u) => u.id === id)?.nome ?? id).join(", ");
}

function ListaResultados({ itens, unidades }: { itens: Resultado[]; unidades: Unidade[] }) {
  if (!itens.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {itens.map((r) => (
        <li key={r.chave}>
          {r.ok ? "Salvo" : "Falhou"} · {unidades.find((u) => u.id === r.id)?.nome ?? r.id}
          {r.data ? ` · ${dataCurta(r.data)}` : ""}
          {r.mensagem ? ` · ${r.mensagem}` : ""}
        </li>
      ))}
    </ul>
  );
}

function DialogoPausa({
  ctx,
  unidades,
  fechar,
}: {
  ctx: ContextoGateway;
  unidades: Unidade[];
  fechar: () => void;
}) {
  const g = useGestao(ctx);
  const [ind, setInd] = useState(false);
  const [ate, setAte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [feitos, setFeitos] = useState<Resultado[]>([]);
  const ids = unidades.map((u) => u.id);
  const faltam = pendentesDe(
    ids.map((id) => ({ chave: id, id })),
    feitos.filter((r) => r.ok).map((r) => r.chave),
  );
  return (
    <Dialog open onOpenChange={(a) => !a && !g.busy && fechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pausar {unidades.length} unidades</DialogTitle>
          <DialogDescription>
            Uma pausa por unidade. Se alguma falhar, tentar de novo não repete as que já foram
            salvas. {nomes(unidades, ids)}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!faltam.length) return;
            try {
              const prazo = ind
                ? { indefinida: true as const }
                : { ate: instanteLocal(ate, unidades[0]?.fuso_efetivo || FUSO_PAINEL) };
              const r = await g.executar({
                acao: "aplicar_pausas",
                ids: faltam.map((f) => f.id).slice(0, 40),
                ...prazo,
                motivo,
              });
              if (!r.ok) return;
              const novos = (r.dados as { resultados: Resultado[] }).resultados;
              setFeitos((prev) => [
                ...prev.filter((p) => !novos.some((n) => n.chave === p.chave)),
                ...novos,
              ]);
              if (novos.every((n) => n.ok)) toast.success("Pausas salvas.");
            } catch (err) {
              g.setErro({
                campo: "ate",
                mensagem: err instanceof Error ? err.message : "Confira o horário.",
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
              <Label htmlFor="lote-ate">Pausar até</Label>
              <Input
                id="lote-ate"
                className="min-h-11"
                type="datetime-local"
                required
                value={ate}
                onChange={(e) => setAte(e.target.value)}
                disabled={g.busy}
              />
              <p className="text-xs text-ink-500">
                O horário é lido no fuso de {unidades[0]?.fuso_efetivo}. Unidades com outro fuso
                recebem o mesmo instante.
              </p>
            </div>
          )}
          <Label htmlFor="lote-motivo">Motivo (opcional)</Label>
          <Input
            id="lote-motivo"
            className="min-h-11"
            value={motivo}
            maxLength={200}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={g.busy}
          />
          {g.erro && (
            <p role="alert" className="text-sm text-red-700">
              {g.erro.mensagem}
            </p>
          )}
          <ListaResultados itens={feitos} unidades={unidades} />
          <Button className="min-h-11" disabled={g.busy || !faltam.length}>
            {feitos.some((r) => !r.ok) ? `Tentar de novo (${faltam.length})` : "Confirmar pausa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoExcecao({
  ctx,
  unidades,
  fechar,
}: {
  ctx: ContextoGateway;
  unidades: Unidade[];
  fechar: () => void;
}) {
  const g = useGestao(ctx);
  const [data, setData] = useState("");
  const [fechado, setFechado] = useState(true);
  const [faixas, setFaixas] = useState<[string, string][]>([["12:00", "16:00"]]);
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [feitos, setFeitos] = useState<Resultado[]>([]);
  const pedidos = unidades.map((u) => ({ chave: `${u.id}:${data}`, id: u.id, data }));
  const faltam = pendentesDe(
    pedidos,
    feitos.filter((r) => r.ok).map((r) => r.chave),
  );
  return (
    <Dialog open onOpenChange={(a) => !a && !g.busy && fechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exceção em {unidades.length} unidades</DialogTitle>
          <DialogDescription>
            Uma gravação por unidade. Data que já tenha exceção é substituída. Nada é criado antes
            da confirmação.
          </DialogDescription>
        </DialogHeader>
        {!confirmar ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!fechado) {
                const p = problemaGrade({ seg: faixas });
                if (p) {
                  g.setErro({ campo: "faixas", mensagem: p });
                  return;
                }
              }
              setConfirmar(true);
            }}
          >
            <Label htmlFor="lote-data">Data</Label>
            <Input
              id="lote-data"
              className="min-h-11"
              type="date"
              required
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={fechado}
                onChange={(e) => setFechado(e.target.checked)}
              />
              Fechado o dia inteiro
            </label>
            {!fechado && <EditorFaixas faixas={faixas} onChange={setFaixas} />}
            {g.erro && (
              <p role="alert" className="text-sm text-red-700">
                {g.erro.mensagem}
              </p>
            )}
            <Label htmlFor="lote-ex-motivo">Motivo (opcional)</Label>
            <Input
              id="lote-ex-motivo"
              className="min-h-11"
              value={motivo}
              maxLength={200}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <Button className="min-h-11">Revisar antes de criar</Button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!faltam.length) return;
              const r = await g.executar({
                acao: "aplicar_excecoes",
                itens: faltam.slice(0, 80).map((f) => ({
                  id: f.id,
                  data,
                  ...(fechado ? { fechado: true } : { faixas }),
                  motivo,
                })),
              });
              if (!r.ok) return;
              const novos = (r.dados as { resultados: Resultado[] }).resultados;
              setFeitos((prev) => [
                ...prev.filter((p) => !novos.some((n) => n.chave === p.chave)),
                ...novos,
              ]);
              if (novos.every((n) => n.ok)) toast.success("Exceções salvas.");
            }}
          >
            <p>
              Criar em {dataCurta(data)} para{" "}
              {nomes(
                unidades,
                faltam.map((f) => f.id),
              )}
              .{" "}
              {fechado
                ? "Fechado o dia inteiro."
                : `Horário especial ${faixas.map((f) => f.join("–")).join(", ")}.`}
            </p>
            {g.erro && (
              <p role="alert" className="text-sm text-red-700">
                {g.erro.mensagem}
              </p>
            )}
            <ListaResultados itens={feitos} unidades={unidades} />
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                type="button"
                variant="outline"
                onClick={() => setConfirmar(false)}
              >
                Voltar
              </Button>
              <Button className="min-h-11" disabled={g.busy || !faltam.length}>
                {feitos.length ? `Tentar de novo (${faltam.length})` : "Confirmar e criar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogoFeriados({
  ctx,
  unidades,
  preselecionadas,
  fechar,
}: {
  ctx: ContextoGateway;
  unidades: Unidade[];
  preselecionadas: string[];
  fechar: () => void;
}) {
  const g = useGestao(ctx);
  const [ano, setAno] = useState(anoCivil(FUSO_PAINEL));
  let lista: Feriado[] = [];
  try {
    lista = feriadosNacionais(ano);
  } catch {
    lista = [];
  }
  const [marcados, setMarcados] = useState<string[]>([]);
  const [alvos, setAlvos] = useState<string[]>(preselecionadas);
  const [fechado, setFechado] = useState(true);
  const [faixas, setFaixas] = useState<[string, string][]>([["12:00", "16:00"]]);
  const [confirmar, setConfirmar] = useState(false);
  const [feitos, setFeitos] = useState<Resultado[]>([]);
  const feriados = lista.filter((f) => marcados.includes(f.data + f.nome));
  const pedidos = feriados.flatMap((f) =>
    alvos.map((id) => ({ chave: `${id}:${f.data}`, id, data: f.data, nome: f.nome })),
  );
  const faltam = pendentesDe(
    pedidos,
    feitos.filter((r) => r.ok).map((r) => r.chave),
  );
  function chaveFeriado(f: Feriado) {
    return f.data + f.nome;
  }
  return (
    <Dialog open onOpenChange={(a) => !a && !g.busy && fechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feriados nacionais de {ano}</DialogTitle>
          <DialogDescription>
            Marque os dias, as unidades e se ficam fechadas ou com horário especial. Nada é criado
            sem a confirmação.
          </DialogDescription>
        </DialogHeader>
        {!confirmar ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!feriados.length || !alvos.length) {
                g.setErro({
                  campo: "corpo",
                  mensagem: "Marque ao menos um feriado e uma unidade.",
                });
                return;
              }
              if (!fechado) {
                const p = problemaGrade({ seg: faixas });
                if (p) {
                  g.setErro({ campo: "faixas", mensagem: p });
                  return;
                }
              }
              g.setErro(null);
              setConfirmar(true);
            }}
          >
            <Label htmlFor="ano-feriado">Ano</Label>
            <Input
              id="ano-feriado"
              className="min-h-11"
              type="number"
              min={2000}
              max={2100}
              value={ano}
              onChange={(e) => {
                setAno(Number(e.target.value));
                setMarcados([]);
                setFeitos([]);
              }}
            />
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {lista.map((f) => (
                <label key={chaveFeriado(f)} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={marcados.includes(chaveFeriado(f))}
                    onChange={(e) =>
                      setMarcados(
                        e.target.checked
                          ? [...marcados, chaveFeriado(f)]
                          : marcados.filter((x) => x !== chaveFeriado(f)),
                      )
                    }
                  />
                  {dataCurta(f.data)} · {f.nome}
                </label>
              ))}
            </div>
            <p className="text-sm font-medium">Unidades</p>
            {unidades.map((u) => (
              <label key={u.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={alvos.includes(u.id)}
                  onChange={(e) =>
                    setAlvos(e.target.checked ? [...alvos, u.id] : alvos.filter((x) => x !== u.id))
                  }
                />
                {u.nome}
              </label>
            ))}
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={fechado}
                onChange={(e) => setFechado(e.target.checked)}
              />
              Fechado o dia inteiro
            </label>
            {!fechado && <EditorFaixas faixas={faixas} onChange={setFaixas} />}
            {g.erro && (
              <p role="alert" className="text-sm text-red-700">
                {g.erro.mensagem}
              </p>
            )}
            <Button className="min-h-11">Revisar antes de criar</Button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!faltam.length) return;
              const r = await g.executar({
                acao: "aplicar_excecoes",
                itens: faltam.slice(0, 80).map((f) => ({
                  id: f.id,
                  data: f.data,
                  ...(fechado ? { fechado: true } : { faixas }),
                  motivo: f.nome,
                })),
              });
              if (!r.ok) return;
              const novos = (r.dados as { resultados: Resultado[] }).resultados;
              setFeitos((prev) => [
                ...prev.filter((p) => !novos.some((n) => n.chave === p.chave)),
                ...novos,
              ]);
              if (novos.every((n) => n.ok)) toast.success("Feriados salvos.");
            }}
          >
            <p>
              {faltam.length} gravação(ões):{" "}
              {feriados.map((f) => `${f.nome} (${dataCurta(f.data)})`).join(", ")} em{" "}
              {nomes(unidades, alvos)}. Uma exceção já existente na data será substituída.
            </p>
            {g.erro && (
              <p role="alert" className="text-sm text-red-700">
                {g.erro.mensagem}
              </p>
            )}
            <ListaResultados itens={feitos} unidades={unidades} />
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                type="button"
                variant="outline"
                onClick={() => setConfirmar(false)}
              >
                Voltar
              </Button>
              <Button className="min-h-11" disabled={g.busy || !faltam.length}>
                {feitos.length ? `Tentar de novo (${faltam.length})` : "Confirmar e criar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
