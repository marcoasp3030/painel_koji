/** Lista e detalhe dos lotes de notas (LOTE1-a). */
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
import { Etiqueta, Vazio } from "@/components/luxtia/Gateway";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dataHoraBrasilia, reaisDocumento, rotuloTipo } from "@/lib/gateway/documentos";
import {
  ACEITA_ARQUIVO_LOTE,
  ESTADOS_ARQUIVO_LOTE,
  ROTULO_AVISO_NOTA,
  ROTULO_ESTADO_ARQUIVO_LOTE,
  ROTULO_ESTADO_LOTE,
  ROTULO_MOTIVO_LOTE,
  TEXTO_AJUDA_LOTES,
  type ArquivoLoteResumo,
  type LoteProgresso,
  type NotaLote,
} from "@/lib/gateway/lotes";

function rotuloMotivo(motivo: string | null | undefined) {
  if (!motivo) return null;
  return ROTULO_MOTIVO_LOTE[motivo] ?? motivo.replace(/_/g, " ");
}

function valorCampo(nota: NotaLote, chave: string) {
  const c = nota.campos[chave];
  if (!c || c.valor == null || c.valor === "") return "—";
  return String(c.valor);
}

function valorMonetario(nota: NotaLote) {
  const bruto = valorCampo(nota, "valor_total");
  if (bruto !== "—") return reaisDocumento(bruto) || bruto;
  const v = valorCampo(nota, "valor");
  return v === "—" ? "—" : reaisDocumento(v) || v;
}

export function LotesLista({
  itens,
  nomesAgente,
  carregando,
  erro,
  onNovo,
  onAbrir,
}: {
  itens: LoteProgresso[];
  nomesAgente: Record<string, string>;
  carregando: boolean;
  erro?: string | undefined;
  onNovo: () => void;
  onAbrir: (id: string) => void;
}) {
  return (
    <>
      <p className="mt-3 text-sm text-ink-500">{TEXTO_AJUDA_LOTES}</p>
      <div className="mt-4 flex justify-end">
        <Button onClick={onNovo}>Novo lote</Button>
      </div>
      <Cartao className="mt-4">
        {carregando ? (
          <p className="px-5 py-8 text-ink-500">Carregando…</p>
        ) : erro ? (
          <EstadoVazio titulo="Não foi possível carregar" texto={erro} />
        ) : itens.length === 0 ? (
          <Vazio
            titulo="Nenhum lote"
            texto="Crie um lote para enviar várias notas de uma vez (PDF, XML ou ZIP)."
            acao={<Button onClick={onNovo}>Novo lote</Button>}
          />
        ) : (
          <ul>
            {itens.map((l) => {
              const estado = ROTULO_ESTADO_LOTE[l.estado] ?? {
                rotulo: l.estado,
                tom: "neutro" as const,
              };
              return (
                <li key={l.lote_id} className="border-b border-base-200 last:border-0">
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 px-5 py-4 text-left hover:bg-base-50"
                    onClick={() => onAbrir(l.lote_id)}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-900">
                        {l.nome || l.lote_id}
                      </span>
                      <Etiqueta tom={estado.tom}>{estado.rotulo}</Etiqueta>
                    </span>
                    <span className="text-xs text-ink-500">
                      {nomesAgente[l.agente_id] ?? l.agente_id} · {l.arquivos.total}{" "}
                      {l.arquivos.total === 1 ? "arquivo" : "arquivos"} · {l.notas}{" "}
                      {l.notas === 1 ? "nota" : "notas"} · {dataHoraBrasilia(l.criado_em)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </>
  );
}

export function DialogoNovoLote({
  aberto,
  onFechar,
  agentes,
  carregandoAgentes,
  salvando,
  onCriar,
}: {
  aberto: boolean;
  onFechar: () => void;
  agentes: { id: string; nome: string }[];
  carregandoAgentes: boolean;
  salvando: boolean;
  onCriar: (dados: { agente_id: string; nome?: string }) => void;
}) {
  const [agente, setAgente] = useState("");
  const [nome, setNome] = useState("");
  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) onFechar();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lote</DialogTitle>
          <DialogDescription>
            Escolha um agente com a capacidade de documentos ligada. O nome é opcional.
          </DialogDescription>
        </DialogHeader>
        <label className="mt-2 block text-xs text-ink-500">
          Agente
          <select
            className="mt-1 block h-10 w-full rounded-md border border-base-200 bg-card px-3 text-sm text-ink-900"
            value={agente}
            onChange={(e) => setAgente(e.target.value)}
            disabled={carregandoAgentes || salvando}
          >
            <option value="">{carregandoAgentes ? "Carregando…" : "Selecione"}</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        {agentes.length === 0 && !carregandoAgentes ? (
          <p className="mt-2 text-xs text-destructive">
            Nenhum agente com a capacidade de documentos ligada.
          </p>
        ) : null}
        <label className="mt-3 block text-xs text-ink-500">
          Nome (opcional)
          <input
            className="mt-1 block h-10 w-full rounded-md border border-base-200 bg-card px-3 text-sm text-ink-900"
            value={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
            disabled={salvando}
            placeholder="Ex.: Fretes novembro"
          />
        </label>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            disabled={!agente || salvando}
            onClick={() =>
              onCriar({
                agente_id: agente,
                ...(nome.trim() ? { nome: nome.trim() } : {}),
              })
            }
          >
            {salvando ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EnvioItem = {
  chave: string;
  nome: string;
  estado: "aguardando" | "enviando" | "ok" | "erro";
  progresso: number;
  mensagem?: string;
  itensZip?: { nome: string; estado: string; motivo: string | null }[];
};

export function LoteDetalhe({
  lote,
  nomeAgente,
  notas,
  arquivos,
  filtroArquivo,
  onFiltroArquivo,
  aba,
  onAba,
  enviando,
  envios,
  onSoltar,
  onFechar,
  fechando,
  onApagar,
  apagando,
}: {
  lote: LoteProgresso;
  nomeAgente: string;
  notas: NotaLote[];
  arquivos: ArquivoLoteResumo[];
  filtroArquivo: string;
  onFiltroArquivo: (e: string) => void;
  aba: "notas" | "arquivos";
  onAba: (a: "notas" | "arquivos") => void;
  enviando: boolean;
  envios: EnvioItem[];
  onSoltar: (files: File[]) => void;
  onFechar: () => void;
  fechando: boolean;
  onApagar: () => void;
  apagando: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrasto, setArrasto] = useState(false);
  const estado = ROTULO_ESTADO_LOTE[lote.estado] ?? {
    rotulo: lote.estado,
    tom: "neutro" as const,
  };
  const aberto = lote.estado === "aberto";
  const contadores = useMemo(() => {
    const a = lote.arquivos;
    return [
      `${a.total} arquivo${a.total === 1 ? "" : "s"}`,
      a.na_fila ? `${a.na_fila} na fila` : null,
      a.lido ? `${a.lido} lido${a.lido === 1 ? "" : "s"}` : null,
      a.sem_texto ? `${a.sem_texto} sem texto` : null,
      a.recusado ? `${a.recusado} recusado${a.recusado === 1 ? "" : "s"}` : null,
      `${lote.notas} nota${lote.notas === 1 ? "" : "s"}`,
      lote.estimativa_s > 0 ? `~${lote.estimativa_s}s` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [lote]);

  function receber(lista: FileList | File[] | null) {
    if (!lista || !aberto || enviando) return;
    const files = Array.from(lista);
    if (files.length) onSoltar(files);
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link to="/ia/documentos/lotes" className="text-sm text-ink-500 hover:text-ink-800">
          ← Lotes
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink-900">
            {lote.nome || lote.lote_id}
            <Etiqueta tom={estado.tom}>{estado.rotulo}</Etiqueta>
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {nomeAgente} · criado {dataHoraBrasilia(lote.criado_em)}
          </p>
          <p className="mt-1 text-xs text-ink-500">{contadores}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {aberto ? (
            <Button variant="secondary" disabled={fechando || enviando} onClick={onFechar}>
              {fechando ? "Fechando…" : "Fechar lote"}
            </Button>
          ) : null}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={apagando}>
                Apagar lote
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar este lote?</AlertDialogTitle>
                <AlertDialogDescription>
                  Os arquivos e as leituras serão apagados. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={onApagar}
                >
                  Apagar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink-500">{TEXTO_AJUDA_LOTES}</p>

      {aberto ? (
        <div
          className={`mt-4 rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
            arrasto ? "border-ink-700 bg-base-50" : "border-base-300 bg-card"
          } ${enviando ? "opacity-70" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrasto(true);
          }}
          onDragLeave={() => setArrasto(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrasto(false);
            receber(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-ink-700">
            Solte PDF, XML ou ZIP aqui — vários de uma vez. Cada arquivo é enviado em sequência.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
          >
            Escolher arquivos
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ACEITA_ARQUIVO_LOTE}
            multiple
            onChange={(e) => {
              receber(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {envios.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {envios.map((e) => (
            <li key={e.chave} className="rounded-md border border-base-200 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink-900">{e.nome}</span>
                <span className="text-xs text-ink-500">
                  {e.estado === "aguardando"
                    ? "Aguardando"
                    : e.estado === "enviando"
                      ? "Enviando…"
                      : e.estado === "ok"
                        ? "Enviado"
                        : e.mensagem || "Erro"}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-base-100">
                <div
                  className={`h-full transition-all ${
                    e.estado === "erro" ? "bg-destructive" : "bg-ink-800"
                  }`}
                  style={{ width: `${e.progresso}%` }}
                />
              </div>
              {e.itensZip?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-ink-600">
                  {e.itensZip.map((z, i) => (
                    <li key={`${z.nome}-${i}`}>
                      {z.nome}: {ROTULO_ESTADO_ARQUIVO_LOTE[z.estado]?.rotulo ?? z.estado}
                      {z.motivo ? ` — ${rotuloMotivo(z.motivo)}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {e.estado === "erro" && e.mensagem ? (
                <p className="mt-1 text-xs text-destructive">{e.mensagem}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <nav className="mt-6 flex gap-1 border-b border-base-200" aria-label="Conteúdo do lote">
        {(
          [
            ["notas", "Notas"],
            ["arquivos", "Arquivos"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            className={
              aba === id
                ? "-mb-px border-b-2 border-ink-900 px-3 py-2 text-sm font-medium text-ink-900"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-ink-500 hover:text-ink-800"
            }
            onClick={() => onAba(id)}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      {aba === "notas" ? (
        <Cartao className="mt-4">
          {notas.length === 0 ? (
            <Vazio
              titulo="Nenhuma nota lida"
              texto="Quando um arquivo for lido, a nota aparece aqui. PDF e XML da mesma nota são juntados."
            />
          ) : (
            <ul>
              {notas.map((n, i) => (
                <li
                  key={`${n.fonte}-${i}-${n.arquivos[0]?.arquivo_id ?? i}`}
                  className="border-b border-base-200 px-5 py-4 last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink-900">
                      {rotuloTipo(n.tipo_documento)}
                      {valorCampo(n, "numero") !== "—" ? ` nº ${valorCampo(n, "numero")}` : ""}
                    </span>
                    <Etiqueta>{n.fonte === "xml" ? "XML" : "PDF"}</Etiqueta>
                    {n.avisos.map((a) => (
                      <Etiqueta key={a} tom="alerta">
                        {ROTULO_AVISO_NOTA[a] ?? a}
                      </Etiqueta>
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {valorCampo(n, "emitente_nome") !== "—"
                      ? valorCampo(n, "emitente_nome")
                      : valorCampo(n, "emitente_documento")}{" "}
                    · {valorMonetario(n)} · emissão {valorCampo(n, "emissao")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {n.arquivos.map((a) =>
                      a.anexo_id ? (
                        <Link
                          key={a.arquivo_id}
                          to="/ia/documentos"
                          search={{ documento: a.anexo_id }}
                          className="text-xs text-ink-700 underline underline-offset-2 hover:text-ink-900"
                        >
                          Abrir {a.nome}
                        </Link>
                      ) : (
                        <span key={a.arquivo_id} className="text-xs text-ink-500">
                          {a.nome}
                        </span>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      ) : (
        <>
          <div className="mt-4">
            <label className="text-xs text-ink-500">
              Estado
              <select
                className="mt-1 block h-10 rounded-md border border-base-200 bg-card px-3 text-sm text-ink-900"
                value={filtroArquivo}
                onChange={(e) => onFiltroArquivo(e.target.value)}
              >
                <option value="">Todos</option>
                {ESTADOS_ARQUIVO_LOTE.map((e) => (
                  <option key={e} value={e}>
                    {ROTULO_ESTADO_ARQUIVO_LOTE[e]?.rotulo ?? e}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Cartao className="mt-3">
            {arquivos.length === 0 ? (
              <Vazio titulo="Nenhum arquivo" texto="Envie PDF, XML ou ZIP para começar." />
            ) : (
              <ul>
                {arquivos.map((a) => {
                  const est = ROTULO_ESTADO_ARQUIVO_LOTE[a.estado] ?? {
                    rotulo: a.estado,
                    tom: "neutro" as const,
                  };
                  return (
                    <li
                      key={a.arquivo_id}
                      className="flex flex-col gap-1 border-b border-base-200 px-5 py-3 last:border-0"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-900">{a.nome}</span>
                        <Etiqueta tom={est.tom}>{est.rotulo}</Etiqueta>
                        {a.zip ? <Etiqueta>ZIP: {a.zip}</Etiqueta> : null}
                      </span>
                      <span className="text-xs text-ink-500">
                        {a.formato?.toUpperCase() ?? "—"}
                        {a.motivo ? ` · ${rotuloMotivo(a.motivo)}` : ""}
                        {a.anexo_id ? (
                          <>
                            {" · "}
                            <Link
                              to="/ia/documentos"
                              search={{ documento: a.anexo_id }}
                              className="underline underline-offset-2"
                            >
                              Abrir em Documentos
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Cartao>
        </>
      )}
    </>
  );
}

export type { EnvioItem };
