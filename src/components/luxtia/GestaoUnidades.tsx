import { useEffect, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { peloMenos } from "@/lib/acesso/papeis";
import { useGestao, EditorFaixas, botoesPausaRapida, textoPrazo } from "./gestao-base";
import { obterModulosEmpresa } from "@/lib/gateway-modulos.functions";
import { pedidosEmUso } from "@/lib/gateway/modulos";
import { VisaoHoje, OperacaoVarias } from "./GestaoOperacao";
import {
  DIAS,
  NOMES_DIA,
  dataRecebida,
  textoSituacao,
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
import { Cartao, EstadoVazio, Iniciais, Metrica } from "./Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
function tomSituacao(u: Unidade) {
  if (u.situacao.aberta_agora === true) return "sucesso" as const;
  if (u.situacao.motivo === "pausa") return "alerta" as const;
  if (u.situacao.aberta_agora === null || u.situacao.motivo === "sem_horario")
    return "roxo" as const;
  if (u.situacao.motivo === "inativa") return "neutro" as const;
  return "perigo" as const;
}
function resumoSituacao(u: Unidade) {
  if (u.situacao.aberta_agora === true) return "Aberta";
  if (u.situacao.motivo === "pausa") return "Pausada";
  if (u.situacao.aberta_agora === null || u.situacao.motivo === "sem_horario") return "Sem horário";
  if (u.situacao.motivo === "inativa") return "Inativa";
  if (u.situacao.motivo === "excecao") return "Exceção";
  return "Fechada";
}
export function SituacaoUnidade({ u }: { u: Unidade }) {
  return (
    <div className="space-y-1 text-sm">
      <Etiqueta tom={tomSituacao(u)}>{resumoSituacao(u)}</Etiqueta>
      <p>{textoSituacao(u.situacao)}</p>
      {u.situacao.fecha_as && <p>Fecha: {dataRecebida(u.situacao.fecha_as)}</p>}
      {u.situacao.proxima_abertura && (
        <p>Próxima abertura: {dataRecebida(u.situacao.proxima_abertura)}</p>
      )}
      {u.pausa_motivo && u.situacao.motivo === "pausa" && <p>Motivo: {u.pausa_motivo}</p>}
      <p className="text-ink-500">Fuso: {u.fuso_efetivo}</p>
    </div>
  );
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
    !admin || (secao === "horarios" && !gestor) ? "agenda" : secao;
  const itens = q.data?.itens ?? [];
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = itens.filter((u) =>
    [u.nome, u.codigo, u.endereco].some((v) =>
      (v ?? "").toLocaleLowerCase("pt-BR").includes(termo),
    ),
  );
  const contagem = {
    abertas: itens.filter((u) => u.situacao.aberta_agora === true).length,
    pausadas: itens.filter((u) => u.situacao.motivo === "pausa").length,
    sem: itens.filter(
      (u) => u.situacao.aberta_agora === null || u.situacao.motivo === "sem_horario",
    ).length,
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
    <div className="mt-6 space-y-4">
      {itens.length > 0 ? (
        <VisaoHoje ctx={ctx} itens={itens} onAbrir={(id) => seguir(id, "agenda")} />
      ) : null}
      {admin && itens.length > 0 ? (
        <OperacaoVarias
          ctx={ctx}
          unidades={itens}
          selecionadas={selecionadas}
          onLimpar={() => setSelecionadas([])}
        />
      ) : null}
      <div className={`grid gap-3 sm:grid-cols-3 ${unidadeId ? "hidden lg:grid" : ""}`}>
        <Metrica rotulo="Abertas agora" valor={q.data ? contagem.abertas : "—"} />
        <Metrica rotulo="Pedidos pausados" valor={q.data ? contagem.pausadas : "—"} />
        <Metrica
          rotulo="Sem horário"
          valor={q.data ? contagem.sem : "—"}
          detalhe="Situação recebida do gateway"
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className={`min-w-0 flex-1 text-sm ${unidadeId ? "hidden lg:block" : ""}`}>
          Buscar unidade
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, código ou endereço"
            className="mt-1 max-w-md"
          />
        </label>
        {gestor && (
          <Button className="min-h-11" onClick={() => setEditar("nova")}>
            Nova unidade
          </Button>
        )}
      </div>
      {q.isPending ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <Skeleton className="h-40" />
          <Skeleton className="hidden h-64 lg:block" />
        </div>
      ) : null}
      {q.error ? (
        <p role="alert" className="text-sm">
          {q.error.message} {q.data ? "A informação abaixo pode estar desatualizada." : ""}{" "}
          <Button variant="outline" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : null}
      <Erro g={g} />
      {!q.isPending && itens.length === 0 ? (
        <Cartao>
          <EstadoVazio
            titulo="Nenhuma unidade cadastrada"
            texto="Crie uma unidade para definir a agenda, a grade semanal e as exceções."
          />
        </Cartao>
      ) : null}
      {itens.length > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className={`space-y-3 ${unidadeId ? "hidden lg:block" : ""}`}>
            {visiveis.length === 0 ? (
              <Cartao>
                <EstadoVazio
                  titulo="Nenhuma unidade encontrada"
                  texto="Limpe a busca para ver todas as unidades da empresa."
                />
              </Cartao>
            ) : (
              visiveis.map((u) => (
                <Cartao
                  key={u.id}
                  className={`space-y-3 p-4 ${unidadeId === u.id ? "ring-1 ring-purple-700" : ""}`}
                >
                  <button
                    className="flex w-full items-start gap-3 text-left"
                    onClick={() => seguir(u.id, "agenda")}
                  >
                    <Iniciais nome={u.nome} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{u.nome}</span>
                      <span className="block truncate text-sm text-ink-500">
                        {u.codigo ?? "Sem código"} · {u.endereco ?? "Endereço não informado"}
                      </span>
                      {cidadeUf(u) && (
                        <span className="block truncate text-xs text-ink-500">{cidadeUf(u)}</span>
                      )}
                    </span>
                  </button>
                  <SituacaoUnidade u={u} />
                  <AlertasDaUnidade u={u} admin={admin} />
                  {admin && (
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selecionadas.includes(u.id)}
                        onChange={(e) =>
                          setSelecionadas(
                            e.target.checked
                              ? [...selecionadas, u.id]
                              : selecionadas.filter((id) => id !== u.id),
                          )
                        }
                      />
                      Incluir ao aplicar em várias
                    </label>
                  )}
                  <div className={`grid gap-1 ${admin ? "grid-cols-3" : "grid-cols-1"}`}>
                    <Button
                      className="min-h-11 px-2"
                      variant={
                        unidadeId === u.id && secaoEfetiva === "agenda" ? "default" : "outline"
                      }
                      onClick={() => seguir(u.id, "agenda")}
                    >
                      Agenda
                    </Button>
                    {gestor && (
                      <Button
                        className="min-h-11 px-2"
                        variant={
                          unidadeId === u.id && secaoEfetiva === "horarios" ? "default" : "outline"
                        }
                        onClick={() => seguir(u.id, "horarios")}
                      >
                        Horários
                      </Button>
                    )}
                    {admin && (
                      <Button
                        className="min-h-11 px-2"
                        variant={
                          unidadeId === u.id && secaoEfetiva === "excecoes" ? "default" : "outline"
                        }
                        onClick={() => seguir(u.id, "excecoes")}
                      >
                        Exceções
                      </Button>
                    )}
                  </div>
                  {admin && (
                    <Button
                      className="min-h-11 w-full"
                      disabled={g.busy}
                      onClick={() => (u.situacao.motivo === "pausa" ? reabrir(u.id) : setPausar(u))}
                    >
                      {u.situacao.motivo === "pausa" ? "Reabrir pedidos" : "Pausar pedidos"}
                    </Button>
                  )}
                  {gestor && (
                    <Button
                      className="min-h-11 w-full"
                      variant="outline"
                      onClick={() => setEditar(u)}
                    >
                      Editar dados
                    </Button>
                  )}
                </Cartao>
              ))
            )}
          </div>
          <div className={unidadeId ? "block" : "hidden lg:block"}>
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
            ) : (
              <Cartao>
                <EstadoVazio
                  titulo="Escolha uma unidade"
                  texto="Agenda, horários e exceções abrem aqui. No celular, use os botões de cada unidade."
                />
              </Cartao>
            )}
          </div>
        </div>
      )}
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
    taxa_entrega: u?.taxa_entrega != null ? String(u.taxa_entrega) : "",
    pedido_minimo: u?.pedido_minimo != null ? String(u.pedido_minimo) : "",
    area_entrega: u?.area_entrega ?? "",
    formas_pagamento: u?.formas_pagamento ?? "",
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
              for (const k of ["taxa_entrega", "pedido_minimo"] as const) {
                if (!u || v[k] !== inicial[k]) {
                  const t = v[k].trim();
                  dados[k] = t === "" ? null : Number(t.replace(",", "."));
                  if (t !== "" && !Number.isFinite(dados[k] as number)) {
                    return;
                  }
                }
              }
              for (const k of ["area_entrega", "formas_pagamento"] as const) {
                if (!u || v[k] !== inicial[k]) dados[k] = v[k].trim() || null;
              }
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
              <legend className="px-1 text-sm font-medium text-ink-700">Entrega e pagamento</legend>
              <p className="text-xs text-ink-500">
                Visível porque a empresa tem o módulo de pedidos em uso. Vazio = o agente não afirma
                nada e diz que a unidade confirma.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="un-taxa">Taxa de entrega (R$)</Label>
                  <Input
                    id="un-taxa"
                    inputMode="decimal"
                    value={v.taxa_entrega}
                    disabled={g.busy}
                    onChange={(e) => setV({ ...v, taxa_entrega: e.target.value })}
                  />
                  <Erro g={g} campo="taxa_entrega" />
                </div>
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
              <div>
                <Label htmlFor="un-pagamentos">Formas de pagamento</Label>
                <Input
                  id="un-pagamentos"
                  value={v.formas_pagamento}
                  disabled={g.busy}
                  onChange={(e) => setV({ ...v, formas_pagamento: e.target.value })}
                />
                <Erro g={g} campo="formas_pagamento" />
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
function AlertasDaUnidade({ u, admin }: { u: Unidade; admin: boolean }) {
  const a = alertasUnidade(u, admin);
  if (!a.semHorario && !a.semWhatsapp && !a.semCidade) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {a.semHorario ? <Etiqueta tom="alerta">Sem horário cadastrado</Etiqueta> : null}
      {a.semWhatsapp ? <Etiqueta tom="alerta">Sem WhatsApp de pedidos</Etiqueta> : null}
      {a.semCidade ? (
        <Etiqueta tom="alerta">Sem cidade: só feriados nacionais serão considerados</Etiqueta>
      ) : null}
    </div>
  );
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
  const secoes: { id: SecaoUnidade; rotulo: string }[] = [
    { id: "agenda", rotulo: "Agenda" },
    ...(gestor ? [{ id: "horarios" as const, rotulo: "Horários" }] : []),
    ...(admin ? [{ id: "excecoes" as const, rotulo: "Exceções" }] : []),
  ];
  return (
    <div className="space-y-4">
      <Button className="min-h-11 lg:hidden" variant="outline" onClick={onVoltar}>
        ← Unidades
      </Button>
      {q.error && (
        <p role="alert">
          {q.error.message} <Button onClick={() => q.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {!u ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <Cartao className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-purple-800">{u.nome}</h2>
                <p className="text-sm text-ink-500">
                  {u.codigo ?? "Sem código"} · {u.endereco ?? "Endereço não informado"}
                  {cidadeUf(u) ? ` · ${cidadeUf(u)}` : ""}
                </p>
              </div>
              <Link
                to="/ia/gestao/alteracoes"
                search={{ unidade: u.id }}
                className="text-sm font-medium text-purple-800 underline-offset-4 hover:underline"
              >
                Histórico desta unidade
              </Link>
            </div>
            <SituacaoUnidade u={u} />
            <div className="flex flex-wrap gap-2">
              {admin && (
                <Button
                  className="min-h-11"
                  disabled={ocupado}
                  onClick={() => (u.situacao.motivo === "pausa" ? onReabrir(u.id) : onPausar(u))}
                >
                  {u.situacao.motivo === "pausa" ? "Reabrir pedidos" : "Pausar pedidos"}
                </Button>
              )}
              {gestor && (
                <Button className="min-h-11" variant="outline" onClick={() => onEditar(u)}>
                  Editar dados
                </Button>
              )}
            </div>
          </Cartao>
          {secoes.length > 1 && (
            <div
              role="tablist"
              aria-label="Seções da unidade"
              className="flex gap-1 rounded-xl bg-base-100 p-1"
            >
              {secoes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={secao === s.id}
                  className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium ${secao === s.id ? "bg-card text-purple-800 shadow-sm" : "text-ink-500"}`}
                  onClick={() => onSecao(s.id)}
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
          )}
          {secao === "agenda" ? (
            <Previa ctx={ctx} id={id} />
          ) : secao === "horarios" && gestor ? (
            <Horarios ctx={ctx} u={u} />
          ) : admin ? (
            <Excecoes ctx={ctx} u={u} />
          ) : null}
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
    <Cartao className="p-4 sm:p-5">
      <h3 className="font-semibold">Próximos 7 dias</h3>
      <p className="text-sm text-ink-500">
        Mostra só o que já foi salvo. Um rascunho da grade não entra aqui.
      </p>
      {q.isPending && <Skeleton className="mt-3 h-24" />}
      {q.error && (
        <p role="alert" className="mt-3">
          {q.error.message} <Button onClick={() => q.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {q.data && (
        <>
          <p className="mt-3 text-sm">
            Fuso: {q.data.fuso} · {textoSituacao(q.data.situacao)}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.data.dias.map((d) => (
              <div key={d.data} className="rounded-lg border border-base-200 p-3">
                <strong>
                  {dataCurta(d.data)} · {d.dia}
                </strong>
                <p className="text-sm text-ink-500">
                  {d.origem === "excecao" ? "Exceção" : "Grade semanal"}
                </p>
                <p className="text-sm">
                  {q.data.situacao.aberta_agora === null && d.origem !== "excecao"
                    ? "Horário não informado"
                    : d.fechado
                      ? "Fechado"
                      : d.faixas
                          .map(([a, b]) => `${a}–${b}${b < a ? " (dia seguinte)" : ""}`)
                          .join(", ")}
                </p>
                {d.motivo && <p className="text-sm">{d.motivo}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </Cartao>
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
    <Cartao className="p-4 sm:p-5">
      <ProtegeRascunho sujo={sujo} />
      <h3 className="font-semibold">Grade semanal · {u.fuso_efetivo}</h3>
      <p className="text-sm text-ink-500">
        Abra o dia para editar. Até 12 turnos. Um salvamento grava a semana inteira. Sem nenhum
        turno, o horário fica não informado.
      </p>
      <label className="mt-3 block text-sm">
        Copiar grade de outra unidade
        <select
          className="mt-1 block min-h-11 w-full max-w-md rounded-md border bg-card px-3"
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
          <option value="">Escolha uma unidade</option>
          {outras.data?.itens
            .filter((item) => item.id !== u.id)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
        </select>
      </label>
      {sujo && (
        <p role="status" className="mt-3 rounded-lg bg-gold-300/20 p-3 text-sm">
          Alterações ainda não salvas. A agenda continua mostrando a configuração salva.
        </p>
      )}
      <div className="my-4 space-y-2">
        {DIAS.map((d) => (
          <div key={d} className="rounded-lg border border-base-200">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{NOMES_DIA[d]}</p>
                <p className="text-sm text-ink-500">{resumoTurnos(grade[d], gradeVazia)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  aria-expanded={aberto === d}
                  onClick={() => setAberto(aberto === d ? null : d)}
                >
                  {aberto === d ? "Fechar" : "Editar"}
                </Button>
                {(UTEIS as readonly string[]).includes(d) && !!grade[d]?.length && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
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
                  className="min-h-11"
                  onClick={() => {
                    setCopiar(d);
                    setDestinos([]);
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
            {aberto === d && (
              <div className="border-t border-base-200 p-3">
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
        <p role="alert" className="text-red-700">
          {problema}
        </p>
      )}
      <Erro g={g} />
      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-200 bg-card p-3 shadow">
        <p className="text-sm text-ink-500">
          {sujo ? "Há dias alterados nesta semana." : "A semana está como foi salva."}
        </p>
        <Button
          className="min-h-11"
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
    </Cartao>
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
    <Cartao className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Exceções · {u.fuso_efetivo}</h3>
          <p className="text-sm text-ink-500">
            {desde || ate
              ? `Período ${desde ? dataCurta(desde) : "…"} até ${ate ? dataCurta(ate) : "…"}.`
              : "Sem período: de ontem em diante."}{" "}
            Uma exceção não corta um turno que começou na véspera.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setForm("nova")}>
          Nova exceção
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Desde
          <Input
            className="mt-1 min-h-11"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Até
          <Input
            className="mt-1 min-h-11"
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </label>
        {(desde || ate) && (
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => {
              setDesde("");
              setAte("");
            }}
          >
            Limpar período
          </Button>
        )}
      </div>
      {q.isPending && <Skeleton className="h-16" />}
      {q.error && (
        <p role="alert">
          {q.error.message}
          <Button onClick={() => q.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {q.data?.itens.length === 0 && (
        <EstadoVazio
          titulo="Nenhuma exceção neste período"
          texto="Use Nova exceção para um feriado ou um horário especial."
        />
      )}
      <div className="space-y-2">
        {q.data?.itens.map((e) => (
          <div
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-200 p-3"
          >
            <div>
              <strong>{dataCurta(e.data)}</strong>
              <p className="text-sm text-ink-500">
                {e.fechado ? "Fechado o dia inteiro" : e.faixas.map((f) => f.join("–")).join(", ")}
                {e.motivo ? ` · ${e.motivo}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                variant="outline"
                disabled={g.busy}
                onClick={() => setForm(e)}
              >
                Editar
              </Button>
              <Button
                className="min-h-11"
                variant="outline"
                disabled={g.busy}
                onClick={() =>
                  window.confirm(
                    `Excluir exceção de ${dataCurta(e.data)}? A grade volta a valer.`,
                  ) && g.salvar({ acao: "excluir_excecao", id: u.id, eid: e.id })
                }
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
      {form && (
        <FormExcecao
          ctx={ctx}
          u={u}
          atual={form === "nova" ? null : form}
          fechar={() => setForm(null)}
        />
      )}
    </Cartao>
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
