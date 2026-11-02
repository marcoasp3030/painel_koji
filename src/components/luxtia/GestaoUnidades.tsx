import { useEffect, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { peloMenos } from "@/lib/acesso/papeis";
import { useGestao, EditorFaixas, botoesPausaRapida, textoPrazo } from "./gestao-base";
import { PagamentosUnidade } from "./PagamentosUnidade";
import { TaxasUnidade } from "./TaxasUnidade";
import { obterModulosEmpresa } from "@/lib/gateway-modulos.functions";
import { pedidosEmUso } from "@/lib/gateway/modulos";
import { VisaoHoje, OperacaoVarias } from "./GestaoOperacao";
import {
  DIAS,
  NOMES_DIA,
  dataRecebida,
  linhaSituacao,
  resumoSituacao,
  instanteLocal,
  gradeCopiada,
  alertasUnidade,
  cidadeUf,
  UFS,
  problemaGrade,
  type SecaoUnidade,
  type Unidade,
  type Grade,
  type Agenda,
  type Excecao,
  type PedidoGestao,
} from "@/lib/gateway/gestao";
import type { ContextoGateway } from "./Gateway";
import { Etiqueta } from "./Gateway";
import { EstadoVazio } from "./Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Search, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const UTEIS = ["seg", "ter", "qua", "qui", "sex"] as const;

export { useGestao, EditorFaixas };
type G = ReturnType<typeof useGestao>;
function Erro({ g, campo }: { g: G; campo?: string }) {
  return g.erro && (!campo || g.erro.campo === campo) ? (
    <p role="alert" className="text-sm text-red-700">
      {g.erro.mensagem}
    </p>
  ) : null;
}
function ProtegeRascunho({ sujo }: { sujo: boolean }) {
  useBlocker({
    shouldBlockFn: () => sujo && !window.confirm("Descartar alterações não salvas?"),
    enableBeforeUnload: () => sujo,
  });
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
const PONTO_SITUACAO = {
  sucesso: "bg-success",
  alerta: "bg-gold-500",
  roxo: "bg-purple-300",
  neutro: "bg-ink-300",
  perigo: "bg-destructive",
} as const;
function tomSituacao(u: Unidade) {
  if (u.situacao.aberta_agora === true) return "sucesso" as const;
  if (u.situacao.motivo === "pausa") return "alerta" as const;
  if (u.situacao.aberta_agora === null || u.situacao.motivo === "sem_horario")
    return "roxo" as const;
  if (u.situacao.motivo === "inativa") return "neutro" as const;
  return "perigo" as const;
}
function dataCurta(iso: string) {
  return iso.split("-").reverse().join("/");
}
function resumoTurnos(faixas: [string, string][] | undefined, gradeVazia: boolean) {
  if (!faixas?.length) return gradeVazia ? "Sem horário" : "Fechado";
  return faixas.map(([a, b]) => `${a}–${b}${b < a ? " (dia seguinte)" : ""}`).join(", ");
}
function podeTrocar() {
  return window.dispatchEvent(new Event("gestao:trocar", { cancelable: true }));
}

export function GestaoUnidades({
  ctx,
  unidadeId,
  secao,
  aoNavegar,
}: {
  ctx: ContextoGateway;
  unidadeId: string | null;
  secao: SecaoUnidade;
  aoNavegar: (destino: { unidade?: string; secao?: SecaoUnidade }) => void;
}) {
  const g = useGestao(ctx);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "abertas" | "pausadas" | "sem">("todas");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [editar, setEditar] = useState<Unidade | "nova" | null>(null);
  const [pausar, setPausar] = useState<Unidade | null>(null);
  const q = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades"],
    queryFn: () => g.ler<{ itens: Unidade[] }>({ acao: "listar" }),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const gestor = peloMenos(ctx.papel, "gestor");
  const admin = peloMenos(ctx.papel, "supervisor");
  const secaoEfetiva: SecaoUnidade =
    secao === "pagamentos"
      ? "pagamentos"
      : !admin || (secao === "horarios" && !gestor)
        ? "agenda"
        : secao;
  const itens = q.data?.itens ?? [];
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const semHorario = (u: Unidade) =>
    u.situacao.aberta_agora === null || u.situacao.motivo === "sem_horario";
  const visiveis = itens.filter(
    (u) =>
      [u.nome, u.codigo, u.endereco].some((v) =>
        (v ?? "").toLocaleLowerCase("pt-BR").includes(termo),
      ) &&
      (filtro === "todas" ||
        (filtro === "abertas" && u.situacao.aberta_agora === true) ||
        (filtro === "pausadas" && u.situacao.motivo === "pausa") ||
        (filtro === "sem" && semHorario(u))),
  );
  const contagem = {
    abertas: itens.filter((u) => u.situacao.aberta_agora === true).length,
    pausadas: itens.filter((u) => u.situacao.motivo === "pausa").length,
    sem: itens.filter(semHorario).length,
  };
  function seguir(id: string | null, proxima: SecaoUnidade = "agenda") {
    if (id === unidadeId && (id === null || proxima === secaoEfetiva)) return;
    if (!podeTrocar()) return;
    aoNavegar(id ? { unidade: id, secao: proxima } : {});
  }
  function reabrir(id: string) {
    if (window.confirm("Remover a pausa? O horário cadastrado continuará valendo."))
      void g.salvar({ acao: "reabrir", id });
  }
  return (
    <div className="flex min-h-0 flex-1 bg-card">
      <section
        aria-label="Lista de unidades"
        className={`min-h-0 w-full flex-col border-base-200 lg:flex lg:w-80 lg:shrink-0 lg:border-r ${unidadeId ? "hidden" : "flex"}`}
      >
        <div className="shrink-0 space-y-1 border-b border-base-200 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-500"
                aria-hidden
              />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar unidade"
                placeholder="Buscar unidade"
                className="h-8 bg-base-50 pl-8 text-sm"
              />
            </div>
            {gestor && (
              <Button size="sm" className="h-8 shrink-0 px-2.5" onClick={() => setEditar("nova")}>
                <Plus className="size-3.5" aria-hidden />
                Nova
              </Button>
            )}
          </div>
          <div className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
            {(
              [
                ["todas", "Todas", itens.length],
                ["abertas", "Abertas", contagem.abertas],
                ["pausadas", "Pausadas", contagem.pausadas],
                ["sem", "Sem horário", contagem.sem],
              ] as const
            ).map(([id, rotulo, valor]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filtro === id}
                onClick={() => setFiltro(id)}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1 text-xs font-medium transition-colors ${
                  filtro === id ? "bg-purple-100 text-purple-950" : "text-ink-600 hover:bg-base-100"
                }`}
              >
                {rotulo}
                <span className="font-semibold tabular-nums">{q.data ? valor : "—"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {q.isPending ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : null}
          {q.error ? (
            <p role="alert" className="px-3 py-2 text-sm">
              {q.error.message} {q.data ? "A informação abaixo pode estar desatualizada." : ""}{" "}
              <button type="button" className="underline" onClick={() => q.refetch()}>
                Tentar novamente
              </button>
            </p>
          ) : null}
          {g.erro ? (
            <div className="px-3 py-2">
              <Erro g={g} />
            </div>
          ) : null}
          {q.data && !visiveis.length ? (
            <p className="px-3 py-6 text-center text-sm text-ink-500">
              {itens.length ? "Nenhuma unidade encontrada." : "Nenhuma unidade cadastrada."}
            </p>
          ) : null}
          {visiveis.map((u) => {
            const alertas = textosAlerta(u, admin);
            const pausada = u.situacao.motivo === "pausa";
            return (
              <div
                key={u.id}
                className={`flex items-center gap-2 border-b border-base-200/70 px-3 py-1.5 transition-colors hover:bg-purple-50/60 ${
                  unidadeId === u.id
                    ? "bg-purple-100/60 shadow-[inset_3px_0_0_0_var(--purple-700)]"
                    : ""
                }`}
              >
                {admin && (
                  <input
                    type="checkbox"
                    aria-label={`Incluir ${u.nome} ao aplicar em várias`}
                    className="size-3.5 shrink-0 accent-purple-800"
                    checked={selecionadas.includes(u.id)}
                    onChange={(e) =>
                      setSelecionadas(
                        e.target.checked
                          ? [...selecionadas, u.id]
                          : selecionadas.filter((id) => id !== u.id),
                      )
                    }
                  />
                )}
                <button
                  type="button"
                  aria-current={unidadeId === u.id ? "true" : undefined}
                  className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                  title={[u.nome, u.codigo, u.endereco, cidadeUf(u)].filter(Boolean).join(" · ")}
                  onClick={() => seguir(u.id, unidadeId ? secaoEfetiva : "agenda")}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`size-2 shrink-0 rounded-full ${PONTO_SITUACAO[tomSituacao(u)]}`}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate text-sm font-medium text-ink-900">
                      {u.nome}
                    </span>
                    {alertas.length ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-gold-700"
                        title={alertas.join(" · ")}
                      >
                        <TriangleAlert className="size-3" aria-hidden />
                        {alertas.length}
                        <span className="sr-only">{alertas.join(" · ")}</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs leading-4 text-ink-500">
                    {linhaSituacao(u.situacao)}
                  </span>
                </button>
                {admin && (
                  <Button
                    size="sm"
                    variant={pausada ? "default" : "outline"}
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={g.busy}
                    aria-label={`${pausada ? "Reabrir pedidos de" : "Pausar pedidos de"} ${u.nome}`}
                    onClick={() => (pausada ? reabrir(u.id) : setPausar(u))}
                  >
                    {pausada ? "Reabrir" : "Pausar"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {admin && itens.length > 0 ? (
          <OperacaoVarias
            ctx={ctx}
            unidades={itens}
            selecionadas={selecionadas}
            onLimpar={() => setSelecionadas([])}
          />
        ) : null}
      </section>
      <div className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${unidadeId ? "flex" : "hidden"}`}>
        {unidadeId ? (
          <Detalhe
            key={unidadeId}
            ctx={ctx}
            id={unidadeId}
            secao={secaoEfetiva}
            admin={admin}
            gestor={gestor}
            ocupado={g.busy}
            onSecao={(proxima) => seguir(unidadeId, proxima)}
            onVoltar={() => seguir(null)}
            onPausar={setPausar}
            onEditar={setEditar}
            onReabrir={reabrir}
          />
        ) : itens.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-base-100 p-3">
            <VisaoHoje ctx={ctx} itens={itens} onAbrir={(id) => seguir(id, "agenda")} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-base-100 p-6">
            <EstadoVazio
              titulo="Nenhuma unidade cadastrada"
              texto="Crie uma unidade para definir a agenda, a grade semanal e as exceções."
            />
          </div>
        )}
      </div>
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
  const buscarModulos = useServerFn(obterModulosEmpresa);
  const modulos = useQuery({
    queryKey: ["gateway", "modulos", ctx.empresa],
    queryFn: () => buscarModulos({ data: { empresa: ctx.empresa } }),
    staleTime: 30_000,
  });
  const comPedidos = pedidosEmUso(modulos.data);
  const inicial = {
    nome: u?.nome ?? "",
    codigo: u?.codigo ?? "",
    endereco: u?.endereco ?? "",
    telefone: u?.telefone ?? "",
    whatsapp_pedidos: u?.whatsapp_pedidos ?? "",
    fuso: u?.fuso ?? "",
    cidade: u?.cidade ?? "",
    uf: u?.uf ?? "",
    pedido_minimo: u?.pedido_minimo != null ? String(u.pedido_minimo) : "",
    area_entrega: u?.area_entrega ?? "",
  };
  const [v, setV] = useState(inicial);
  const [ativo, setAtivo] = useState(u?.ativo ?? true);
  const [aceitaRetirada, setAceitaRetirada] = useState<boolean | null>(u?.aceita_retirada ?? null);
  const sujo =
    JSON.stringify(v) !== JSON.stringify(inicial) ||
    ativo !== (u?.ativo ?? true) ||
    aceitaRetirada !== (u?.aceita_retirada ?? null);
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
            const texto = [
              "nome",
              "codigo",
              "endereco",
              "telefone",
              "whatsapp_pedidos",
              "fuso",
              "cidade",
              "uf",
            ] as const;
            for (const k of texto) {
              if (!u || v[k] !== inicial[k])
                dados[k] = k === "nome" ? v[k].trim() : v[k].trim() || null;
            }
            if (!u || ativo !== u.ativo) dados["ativo"] = ativo;
            if (comPedidos) {
              for (const k of ["pedido_minimo"] as const) {
                if (!u || v[k] !== inicial[k]) {
                  const t = v[k].trim();
                  dados[k] = t === "" ? null : Number(t.replace(",", "."));
                  if (t !== "" && !Number.isFinite(dados[k] as number)) {
                    return;
                  }
                }
              }
              if (!u || v.area_entrega !== inicial.area_entrega)
                dados["area_entrega"] = v.area_entrega.trim() || null;
              if (!u || aceitaRetirada !== (u.aceita_retirada ?? null))
                dados["aceita_retirada"] = aceitaRetirada;
            }
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
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <Label htmlFor="un-cidade">Cidade</Label>
              <Input
                id="un-cidade"
                maxLength={80}
                value={v.cidade}
                disabled={g.busy}
                aria-invalid={g.erro?.campo === "cidade"}
                aria-describedby="un-cidade-ajuda"
                onChange={(e) => setV({ ...v, cidade: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="un-uf">UF</Label>
              <select
                id="un-uf"
                className="block h-10 w-full rounded-md border bg-card px-3"
                value={v.uf}
                disabled={g.busy}
                aria-invalid={g.erro?.campo === "uf"}
                onChange={(e) => setV({ ...v, uf: e.target.value })}
              >
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p id="un-cidade-ajuda" className="text-sm text-ink-500">
            Usado para feriados estaduais e municipais no atendimento.
          </p>
          <Erro g={g} campo="cidade" />
          <Erro g={g} campo="uf" />
          {comPedidos ? (
            <fieldset className="space-y-3 rounded-md border border-base-200 p-3">
              <legend className="px-1 text-sm font-medium text-ink-700">Entrega</legend>
              <p className="text-xs text-ink-500">
                Visível porque a empresa tem o módulo de pedidos em uso. A taxa fica na seção
                Entrega e as formas de pagamento, na seção Pagamentos.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="un-minimo">Pedido mínimo (R$)</Label>
                  <Input
                    id="un-minimo"
                    inputMode="decimal"
                    value={v.pedido_minimo}
                    disabled={g.busy}
                    onChange={(e) => setV({ ...v, pedido_minimo: e.target.value })}
                  />
                  <Erro g={g} campo="pedido_minimo" />
                </div>
              </div>
              <div>
                <Label htmlFor="un-area">Área de entrega</Label>
                <Input
                  id="un-area"
                  value={v.area_entrega}
                  disabled={g.busy}
                  onChange={(e) => setV({ ...v, area_entrega: e.target.value })}
                />
                <Erro g={g} campo="area_entrega" />
              </div>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={aceitaRetirada === true}
                  disabled={g.busy}
                  onChange={(e) => setAceitaRetirada(e.target.checked ? true : null)}
                />
                Aceita retirada no local
              </label>
              <Erro g={g} campo="aceita_retirada" />
            </fieldset>
          ) : null}
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
          <Button className="min-h-11" disabled={g.busy}>
            Salvar dados
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function textosAlerta(u: Unidade, admin: boolean) {
  const a = alertasUnidade(u, admin);
  return [
    a.semHorario ? "Sem horário cadastrado" : null,
    a.semWhatsapp ? "Sem WhatsApp de pedidos" : null,
    a.semCidade ? "Sem cidade: só feriados nacionais serão considerados" : null,
  ].filter((t): t is string => Boolean(t));
}
function Pausa({ ctx, u, fechar }: { ctx: ContextoGateway; u: Unidade; fechar: () => void }) {
  const g = useGestao(ctx);
  const [ind, setInd] = useState(false);
  const [ate, setAte] = useState("");
  const [prazoIso, setPrazoIso] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const atalhos = botoesPausaRapida(
    u,
    (iso) => {
      setInd(false);
      setAte("");
      setPrazoIso(iso);
      g.setErro(null);
    },
    (mensagem) => g.setErro({ campo: "ate", mensagem }),
  );
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
                : { ate: prazoIso ?? instanteLocal(ate, u.fuso_efetivo) };
              if (await g.salvar({ acao: "pausar", id: u.id, ...prazo, motivo })) fechar();
            } catch (e) {
              g.setErro({
                campo: "ate",
                mensagem: e instanceof Error ? e.message : "Confira o horário.",
              });
            }
          }}
        >
          <div className="flex flex-wrap gap-2">
            {atalhos.map((b) => (
              <Button
                key={b.rotulo}
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={g.busy}
                onClick={b.onClick}
              >
                {b.rotulo}
              </Button>
            ))}
          </div>
          {prazoIso && !ind ? <p className="text-sm">Pausa até {textoPrazo(prazoIso)}.</p> : null}
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
                className="min-h-11"
                type="datetime-local"
                required={!prazoIso}
                value={ate}
                onChange={(e) => {
                  setPrazoIso(null);
                  setAte(e.target.value);
                }}
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
              className="min-h-11"
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
function Detalhe({
  ctx,
  id,
  secao,
  admin,
  gestor,
  ocupado,
  onSecao,
  onVoltar,
  onPausar,
  onEditar,
  onReabrir,
}: {
  ctx: ContextoGateway;
  id: string;
  secao: SecaoUnidade;
  admin: boolean;
  gestor: boolean;
  ocupado: boolean;
  onSecao: (secao: SecaoUnidade) => void;
  onVoltar: () => void;
  onPausar: (u: Unidade) => void;
  onEditar: (u: Unidade) => void;
  onReabrir: (id: string) => void;
}) {
  const g = useGestao(ctx);
  const q = useQuery({
    queryKey: ["gestao", ctx.empresa, id],
    queryFn: () => g.ler<Unidade>({ acao: "obter", id } as PedidoGestao),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const u = q.data;
  const lerModulos = useServerFn(obterModulosEmpresa);
  const modulosEmpresa = useQuery({
    queryKey: ["gateway", "modulos", ctx.empresa],
    queryFn: () => lerModulos({ data: { empresa: ctx.empresa } }),
    enabled: admin,
  });
  // Mesma condição do servidor: sem pedidos em uso, os campos de entrega nem chegam ao gateway.
  const comEntrega = admin && pedidosEmUso(modulosEmpresa.data);
  const secoes: { id: SecaoUnidade; rotulo: string }[] = [
    { id: "agenda", rotulo: "Agenda" },
    ...(comEntrega ? [{ id: "entrega" as const, rotulo: "Entrega" }] : []),
    { id: "pagamentos", rotulo: "Pagamentos" },
    ...(gestor ? [{ id: "horarios" as const, rotulo: "Horários" }] : []),
    ...(admin ? [{ id: "excecoes" as const, rotulo: "Exceções" }] : []),
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {q.error && (
        <p role="alert" className="shrink-0 px-3 py-2 text-sm">
          {q.error.message}{" "}
          <button type="button" className="underline" onClick={() => q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!u ? (
        <div className="p-3">
          <Skeleton className="h-24" />
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-base-200 px-3 py-2">
            <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-1 size-8 shrink-0 lg:hidden"
                aria-label="Voltar para as unidades"
                onClick={onVoltar}
              >
                <ArrowLeft aria-hidden />
              </Button>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="min-w-0 truncate font-sans text-sm font-semibold leading-5 text-ink-900">
                    {u.nome}
                  </h2>
                  <Etiqueta tom={tomSituacao(u)}>{resumoSituacao(u.situacao)}</Etiqueta>
                </div>
                <p className="truncate text-xs leading-4 text-ink-500">
                  {[
                    linhaSituacao(u.situacao),
                    u.situacao.motivo === "pausa" ? u.pausa_motivo : null,
                    u.endereco,
                    cidadeUf(u),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {admin && (
                <Button
                  size="sm"
                  className="h-8 px-2.5"
                  disabled={ocupado}
                  onClick={() => (u.situacao.motivo === "pausa" ? onReabrir(u.id) : onPausar(u))}
                >
                  {u.situacao.motivo === "pausa" ? "Reabrir pedidos" : "Pausar pedidos"}
                </Button>
              )}
              {gestor && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5"
                  onClick={() => onEditar(u)}
                >
                  Editar dados
                </Button>
              )}
              {admin && (
                <Link
                  to="/ia/gestao/alteracoes"
                  search={{ unidade: u.id }}
                  className="px-1 text-xs font-medium text-purple-800 underline-offset-4 hover:underline"
                >
                  Histórico
                </Link>
              )}
            </div>
          </div>
          {textosAlerta(u, admin).length ? (
            <p className="flex shrink-0 items-center gap-1.5 border-b border-gold-300/50 bg-gold-300/15 px-3 py-1 text-xs text-gold-700">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{textosAlerta(u, admin).join(" · ")}</span>
            </p>
          ) : null}
          {secoes.length > 1 && (
            <div
              role="tablist"
              aria-label="Seções da unidade"
              className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-base-200 px-2 [scrollbar-width:none]"
            >
              {secoes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={secao === s.id}
                  className={`shrink-0 border-b-2 px-2.5 pb-1.5 pt-1.5 text-xs transition-colors ${
                    secao === s.id
                      ? "border-purple-700 font-semibold text-purple-800"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                  onClick={() => onSecao(s.id)}
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-base-100 p-3">
            {secao === "agenda" ? (
              <Previa ctx={ctx} id={id} />
            ) : secao === "pagamentos" ? (
              <PagamentosUnidade ctx={ctx} id={id} podeEditar={gestor} />
            ) : secao === "entrega" ? (
              comEntrega ? (
                <TaxasUnidade ctx={ctx} id={id} podeEditar={gestor} />
              ) : null
            ) : secao === "horarios" && gestor ? (
              <Horarios ctx={ctx} u={u} />
            ) : admin ? (
              <Excecoes ctx={ctx} u={u} />
            ) : null}
          </div>
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
    staleTime: 20_000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  return (
    <div className="space-y-2">
      {q.isPending && <Skeleton className="h-24" />}
      {q.error && (
        <p role="alert" className="text-sm">
          {q.error.message}{" "}
          <button type="button" className="underline" onClick={() => q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {q.data && (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {q.data.dias.map((d, i) => {
              const excecao = d.origem === "excecao";
              const semInfo = q.data.situacao.aberta_agora === null && !excecao;
              return (
                <div
                  key={d.data}
                  className={`rounded-lg border bg-card px-3 py-2 ${
                    excecao ? "border-gold-500" : i === 0 ? "border-purple-400" : "border-base-200"
                  }`}
                >
                  <p className="flex items-center justify-between gap-2 text-xs">
                    <strong className="font-semibold text-ink-900">
                      {i === 0 ? "Hoje" : d.dia} · {dataCurta(d.data).slice(0, 5)}
                    </strong>
                    {excecao ? <span className="font-medium text-gold-700">Exceção</span> : null}
                  </p>
                  {semInfo ? (
                    <p className="mt-0.5 text-sm text-ink-500">Horário não informado</p>
                  ) : d.fechado ? (
                    <p className="mt-0.5 text-sm text-ink-500">Fechado</p>
                  ) : (
                    d.faixas.map(([a, b]) => (
                      <p key={a} className="mt-0.5 text-sm tabular-nums text-ink-900">
                        {a}–{b}
                        {b < a ? " (dia seguinte)" : ""}
                      </p>
                    ))
                  )}
                  {d.motivo && <p className="truncate text-xs text-ink-500">{d.motivo}</p>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-500">
            Fuso {q.data.fuso}. Mostra só o que já foi salvo: um rascunho da grade não entra aqui.
          </p>
        </>
      )}
    </div>
  );
}
function Horarios({ ctx, u }: { ctx: ContextoGateway; u: Unidade }) {
  const g = useGestao(ctx);
  const [grade, setGrade] = useState<Grade>(u.horarios ?? {});
  const [salva, setSalva] = useState(JSON.stringify(u.horarios ?? {}));
  const [aberto, setAberto] = useState<(typeof DIAS)[number] | null>(null);
  const [copiar, setCopiar] = useState<(typeof DIAS)[number] | null>(null);
  const [destinos, setDestinos] = useState<(typeof DIAS)[number][]>([]);
  const problema = problemaGrade(grade);
  const sujo = JSON.stringify(grade) !== salva;
  const gradeVazia = DIAS.every((d) => !grade[d]?.length);
  const outras = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades"],
    queryFn: () => g.ler<{ itens: Unidade[] }>({ acao: "listar" }),
    staleTime: 20_000,
  });
  function aplicar(origem: (typeof DIAS)[number], alvos: (typeof DIAS)[number][]) {
    setGrade((prev) => {
      const n = { ...prev };
      for (const d of alvos)
        if (prev[origem]?.length) n[d] = prev[origem]!.map((f) => [...f] as [string, string]);
        else delete n[d];
      return n;
    });
  }
  return (
    <div className="space-y-2">
      <ProtegeRascunho sujo={sujo} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-64 text-xs text-ink-500">
          Fuso {u.fuso_efetivo}. Até 12 turnos por semana. Sem nenhum turno, o horário fica não
          informado.
        </p>
        <select
          aria-label="Copiar grade de outra unidade"
          className="h-8 max-w-56 rounded-md border bg-card px-2 text-xs"
          value=""
          onChange={(e) => {
            const origem = outras.data?.itens.find((item) => item.id === e.target.value);
            if (!origem) return;
            if (
              !window.confirm(
                `Carregar a grade de ${origem.nome} neste rascunho? Nada é gravado até Salvar a semana.`,
              )
            )
              return;
            setGrade(gradeCopiada(origem.horarios));
            setAberto(null);
          }}
        >
          <option value="">Copiar de outra unidade…</option>
          {outras.data?.itens
            .filter((item) => item.id !== u.id)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
        </select>
      </div>
      <div className="divide-y divide-base-200 overflow-hidden rounded-lg border border-base-200 bg-card">
        {DIAS.map((d) => (
          <div key={d}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
              <p className="w-32 shrink-0 text-sm font-medium text-ink-900">{NOMES_DIA[d]}</p>
              <p className="min-w-0 flex-1 basis-40 truncate text-sm tabular-nums text-ink-500">
                {resumoTurnos(grade[d], gradeVazia)}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                {(UTEIS as readonly string[]).includes(d) && !!grade[d]?.length && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    title={`Copiar para os outros dias úteis`}
                    onClick={() => {
                      const alvos = UTEIS.filter((x) => x !== d);
                      if (
                        window.confirm(
                          `Copiar os turnos de ${NOMES_DIA[d]} para os outros dias úteis? Os horários desses dias serão substituídos.`,
                        )
                      )
                        aplicar(d, alvos);
                    }}
                  >
                    Dias úteis
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setCopiar(d);
                    setDestinos([]);
                  }}
                >
                  Copiar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  aria-expanded={aberto === d}
                  onClick={() => setAberto(aberto === d ? null : d)}
                >
                  {aberto === d ? "Fechar" : "Editar"}
                </Button>
              </div>
            </div>
            {aberto === d && (
              <div className="border-t border-base-200 bg-base-50 px-3 py-2">
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
              </div>
            )}
          </div>
        ))}
      </div>
      {problema && (
        <p role="alert" className="text-sm text-red-700">
          {problema}
        </p>
      )}
      <Erro g={g} />
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-200 bg-card px-3 py-1.5 shadow">
        <p className="text-xs text-ink-500">
          {sujo
            ? "Alterações ainda não salvas. A agenda segue com a configuração salva."
            : "A semana está como foi salva."}
        </p>
        <Button
          size="sm"
          className="h-8"
          disabled={!!problema || !sujo || g.busy}
          onClick={async () => {
            if (await g.salvar({ acao: "horarios", id: u.id, grade }))
              setSalva(JSON.stringify(grade));
          }}
        >
          Salvar a semana
        </Button>
      </div>
      {copiar && (
        <Dialog open onOpenChange={(a) => !a && setCopiar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copiar turnos de {NOMES_DIA[copiar]}</DialogTitle>
              <DialogDescription>
                Substitui os turnos dos dias escolhidos. Se a origem estiver vazia, esses dias ficam
                fechados.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  setDestinos(
                    DIAS.filter((d) => d !== copiar && (UTEIS as readonly string[]).includes(d)),
                  )
                }
              >
                Dias úteis
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  setDestinos(DIAS.filter((d) => d !== copiar && (d === "sab" || d === "dom")))
                }
              >
                Fim de semana
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setDestinos(DIAS.filter((d) => d !== copiar))}
              >
                Todos os outros
              </Button>
            </div>
            {DIAS.filter((d) => d !== copiar).map((d) => (
              <label key={d} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={destinos.includes(d)}
                  onChange={(e) =>
                    setDestinos(
                      e.target.checked ? [...destinos, d] : destinos.filter((x) => x !== d),
                    )
                  }
                />
                {NOMES_DIA[d]}
              </label>
            ))}
            <Button
              className="min-h-11"
              disabled={!destinos.length}
              onClick={() => {
                aplicar(copiar, destinos);
                setCopiar(null);
              }}
            >
              Confirmar substituição nos dias escolhidos
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
function Excecoes({ ctx, u }: { ctx: ContextoGateway; u: Unidade }) {
  const g = useGestao(ctx);
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [form, setForm] = useState<Excecao | "nova" | null>(null);
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-500">
            Desde
            <Input
              className="mt-0.5 h-8 w-36 bg-card text-sm"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </label>
          <label className="text-xs text-ink-500">
            Até
            <Input
              className="mt-0.5 h-8 w-36 bg-card text-sm"
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </label>
          {(desde || ate) && (
            <Button
              size="sm"
              className="h-8"
              variant="ghost"
              onClick={() => {
                setDesde("");
                setAte("");
              }}
            >
              Limpar período
            </Button>
          )}
        </div>
        <Button size="sm" className="h-8" onClick={() => setForm("nova")}>
          <Plus className="size-3.5" aria-hidden />
          Nova exceção
        </Button>
      </div>
      {q.isPending && <Skeleton className="h-16" />}
      {q.error && (
        <p role="alert" className="text-sm">
          {q.error.message}{" "}
          <button type="button" className="underline" onClick={() => q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {q.data?.itens.length === 0 && (
        <p className="rounded-lg border border-base-200 bg-card px-3 py-6 text-center text-sm text-ink-500">
          Nenhuma exceção neste período. Use Nova exceção para um feriado ou um horário especial.
        </p>
      )}
      {q.data?.itens.length ? (
        <ul className="divide-y divide-base-200 overflow-hidden rounded-lg border border-base-200 bg-card">
          {q.data.itens.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
              <strong className="w-24 shrink-0 text-sm font-medium tabular-nums text-ink-900">
                {dataCurta(e.data)}
              </strong>
              <p className="min-w-0 flex-1 basis-40 truncate text-sm text-ink-500">
                {e.fechado ? "Fechado o dia inteiro" : e.faixas.map((f) => f.join("–")).join(", ")}
                {e.motivo ? ` · ${e.motivo}` : ""}
              </p>
              <span className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  variant="outline"
                  disabled={g.busy}
                  onClick={() => setForm(e)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  variant="ghost"
                  disabled={g.busy}
                  onClick={() =>
                    window.confirm(
                      `Excluir exceção de ${dataCurta(e.data)}? A grade volta a valer.`,
                    ) && g.salvar({ acao: "excluir_excecao", id: u.id, eid: e.id })
                  }
                >
                  Excluir
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-ink-500">
        Fuso {u.fuso_efetivo}. Sem período, mostra de ontem em diante. Uma exceção não corta um
        turno que começou na véspera.
      </p>
      {form && (
        <FormExcecao
          ctx={ctx}
          u={u}
          atual={form === "nova" ? null : form}
          fechar={() => setForm(null)}
        />
      )}
    </div>
  );
}
function FormExcecao({
  ctx,
  u,
  atual,
  fechar,
}: {
  ctx: ContextoGateway;
  u: Unidade;
  atual: Excecao | null;
  fechar: () => void;
}) {
  const g = useGestao(ctx);
  const [data, setData] = useState(atual?.data ?? "");
  const [fechado, setFechado] = useState(atual?.fechado ?? true);
  const [faixas, setFaixas] = useState<[string, string][]>(
    atual && atual.faixas.length ? atual.faixas : [["12:00", "16:00"]],
  );
  const [motivo, setMotivo] = useState(atual?.motivo ?? "");
  const faixasIniciais = atual && atual.faixas.length ? atual.faixas : [["12:00", "16:00"]];
  const sujo =
    data !== (atual?.data ?? "") ||
    motivo !== (atual?.motivo ?? "") ||
    fechado !== (atual?.fechado ?? true) ||
    JSON.stringify(faixas) !== JSON.stringify(faixasIniciais);
  const sair = () => {
    if (!sujo || window.confirm("Descartar alterações não salvas?")) fechar();
  };
  return (
    <Dialog open onOpenChange={(a) => !a && !g.busy && sair()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <ProtegeRascunho sujo={sujo} />
        <DialogHeader>
          <DialogTitle>
            {atual ? `Exceção de ${dataCurta(atual.data)}` : "Nova exceção"}
          </DialogTitle>
          <DialogDescription>
            A data é o dia civil no fuso {u.fuso_efetivo}. Salvar na mesma data substitui a exceção
            anterior.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
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
              const existente = await g.ler<{ itens: Excecao[] }>({
                acao: "excecoes",
                id: u.id,
                desde: data,
                ate: data,
              } as PedidoGestao);
              if (
                existente.itens.length &&
                !window.confirm(
                  `Substituir a exceção de ${dataCurta(data)}? Atual: ${existente.itens[0]!.fechado ? "Fechado" : existente.itens[0]!.faixas.map((f) => f.join("–")).join(", ")}.`,
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
              )
                fechar();
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
            className="min-h-11"
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            disabled={g.busy}
          />
          <Erro g={g} campo="data" />
          <label className="flex min-h-11 items-center gap-2">
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
            className="min-h-11"
            value={motivo}
            maxLength={200}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={g.busy}
          />
          <Erro g={g} campo="motivo" />
          <Erro g={g} />
          <Button className="min-h-11" disabled={g.busy}>
            Salvar exceção
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
