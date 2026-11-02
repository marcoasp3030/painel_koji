import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { avisos } from "@/lib/gateway-avisos.functions";
import type { ConfigAviso, ConfigAvisos, PreviaAviso } from "@/lib/gateway/avisos";
import type { ContextoGateway } from "./Gateway";
import { peloMenos } from "@/lib/acesso/papeis";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function AvisosPedido({ ctx }: { ctx: ContextoGateway }) {
  const fn = useServerFn(avisos);
  const cache = useQueryClient();
  const [modalidade, setModalidade] = useState("delivery");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);
  useBlocker({
    shouldBlockFn: () => sujo && !window.confirm("Descartar alterações não salvas?"),
    enableBeforeUnload: () => sujo,
  });
  useEffect(() => {
    if (!sujo) return;
    const sair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const trocar = (e: Event) => {
      if (!window.confirm("Descartar alterações não salvas?")) e.preventDefault();
    };
    window.addEventListener("beforeunload", sair);
    window.addEventListener("gestao:trocar", trocar);
    return () => {
      window.removeEventListener("beforeunload", sair);
      window.removeEventListener("gestao:trocar", trocar);
    };
  }, [sujo]);
  const q = useQuery({
    queryKey: ["avisos", ctx.empresa],
    refetchOnWindowFocus: !sujo,
    refetchOnReconnect: !sujo,
    queryFn: async () => {
      const r = await fn({ data: { acao: "ler", empresa: ctx.empresa } });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as ConfigAvisos;
    },
  });
  const podeGravar = peloMenos(ctx.papel, "gestor");
  /** O interruptor grava na hora, com o texto atual do aviso. */
  async function alternarAviso(i: ConfigAviso, ativo: boolean) {
    try {
      const r = await fn({
        data: {
          acao: "salvar",
          empresa: ctx.empresa,
          status: i.status,
          modalidade: i.modalidade,
          texto: i.texto,
          ativo,
        },
      });
      if (!r.ok) return void toast.error(r.erro.mensagem);
      cache.setQueryData(["avisos", ctx.empresa], r.dados);
      toast.success(`${i.status_descricao}: aviso ${ativo ? "ligado" : "desligado"}.`);
    } catch {
      toast.error("Não foi possível confirmar. Confira a conexão antes de tentar novamente.");
    }
  }
  const mudar = (f: () => void) => {
    if (!sujo || window.confirm("Descartar alterações não salvas?")) {
      setSujo(false);
      f();
    }
  };
  if (q.isPending)
    return (
      <p role="status" className="p-4 text-sm text-ink-500">
        Carregando avisos…
      </p>
    );
  if (q.error)
    return (
      <div role="alert" className="space-y-2 p-4 text-sm">
        <p>{q.error.message}</p>
        <Button size="sm" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const itens = q.data.itens.filter((i) => i.modalidade === modalidade);
  const item = itens.find((i) => i.status === selecionado) ?? itens[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card lg:flex-row">
      <section
        aria-label="Avisos por status"
        className="flex shrink-0 flex-col border-b border-base-200 lg:w-72 lg:border-b-0 lg:border-r"
      >
        <div className="shrink-0 border-b border-base-200 p-2">
          <div
            role="group"
            aria-label="Modalidade"
            className="flex h-8 rounded-lg border border-base-200 bg-base-50 p-0.5"
          >
            {["delivery", "retirada"].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modalidade === m}
                onClick={() => mudar(() => setModalidade(m))}
                className={`flex-1 rounded-md text-xs font-medium transition-colors ${
                  modalidade === m ? "bg-purple-800 text-white" : "text-ink-700 hover:bg-base-100"
                }`}
              >
                {m === "delivery" ? "Entrega" : "Retirada"}
              </button>
            ))}
          </div>
        </div>
        <nav
          aria-label="Status do aviso"
          className="flex min-h-0 flex-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-y-auto"
        >
          {itens.map((i) => (
            <div
              key={i.status}
              className={`flex shrink-0 items-center gap-2 border-base-200/70 px-3 py-2 transition-colors max-lg:border-r lg:border-b ${
                item?.status === i.status
                  ? "bg-purple-100/60 shadow-[inset_3px_0_0_0_var(--purple-700)]"
                  : "hover:bg-purple-50/60"
              }`}
            >
              <button
                type="button"
                aria-current={item?.status === i.status ? "true" : undefined}
                className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                onClick={() => mudar(() => setSelecionado(i.status))}
              >
                <span className="block truncate text-sm font-medium text-ink-900">
                  {i.status_descricao}
                </span>
                <span className={`block text-xs ${i.ativo ? "text-success" : "text-ink-500"}`}>
                  {i.ativo ? "Ligado" : "Desligado"}
                </span>
              </button>
              {podeGravar ? (
                <Switch
                  checked={i.ativo}
                  aria-label={`Enviar aviso: ${i.status_descricao}`}
                  onCheckedChange={(ativo) => mudar(() => void alternarAviso(i, ativo))}
                />
              ) : null}
            </div>
          ))}
        </nav>
      </section>
      {item ? (
        <Editor
          key={`${item.status}:${item.modalidade}:${item.texto}:${item.ativo}`}
          ctx={ctx}
          item={item}
          variaveis={q.data.variaveis}
          max={q.data.max_texto}
          podeGravar={podeGravar}
          onDirty={setSujo}
        />
      ) : (
        <p className="p-4 text-sm text-ink-500">Nenhum aviso disponível.</p>
      )}
    </div>
  );
}
function Editor({
  ctx,
  item,
  variaveis,
  max,
  podeGravar,
  onDirty,
}: {
  ctx: ContextoGateway;
  item: ConfigAviso;
  variaveis: string[];
  max: number;
  podeGravar: boolean;
  onDirty: (v: boolean) => void;
}) {
  const fn = useServerFn(avisos);
  const cache = useQueryClient();
  const campo = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState(item.texto);
  const [previa, setPrevia] = useState<PreviaAviso | null>(null);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<{ campo: string; mensagem: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const limite = Math.min(max, 1000);
  const sujo = texto !== item.texto;
  function editar(t: string) {
    setTexto(t);
    setErro(null);
    onDirty(t !== item.texto);
  }
  function inserir(variavel: string) {
    const el = campo.current;
    const marca = `{${variavel}}`;
    const inicio = el?.selectionStart ?? texto.length;
    const fim = el?.selectionEnd ?? inicio;
    // Reposiciona já: esperar o próximo quadro jogaria a digitação rápida para o fim do texto.
    flushSync(() => editar(texto.slice(0, inicio) + marca + texto.slice(fim)));
    el?.focus();
    el?.setSelectionRange(inicio + marca.length, inicio + marca.length);
  }
  // A prévia só monta o texto no gateway: nada vai ao cliente. A resposta atrasada é descartada.
  useEffect(() => {
    if (!texto.trim()) {
      setPrevia(null);
      return;
    }
    let vivo = true;
    const t = window.setTimeout(async () => {
      try {
        const r = await fn({
          data: {
            acao: "previa",
            empresa: ctx.empresa,
            status: item.status,
            modalidade: item.modalidade,
            texto,
          },
        });
        if (!vivo) return;
        if (r.ok) {
          setPrevia(r.dados as PreviaAviso);
          setErroPrevia(null);
        } else setErroPrevia(r.erro.mensagem);
      } catch {
        if (vivo) setErroPrevia("Não foi possível atualizar a prévia.");
      }
    }, 400);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [texto, fn, ctx.empresa, item.status, item.modalidade]);
  async function salvar(restaurar = false) {
    setBusy(true);
    setErro(null);
    try {
      const r = await fn({
        data: {
          acao: "salvar",
          empresa: ctx.empresa,
          status: item.status,
          modalidade: item.modalidade,
          texto: restaurar ? null : texto,
          ativo: restaurar ? null : item.ativo,
        },
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      onDirty(false);
      cache.setQueryData(["avisos", ctx.empresa], r.dados);
      toast.success("Aviso salvo.");
    } catch {
      setErro({
        campo: "corpo",
        mensagem: "Não foi possível concluir. Confira a conexão antes de tentar novamente.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={`${item.status_descricao}, ${item.modalidade === "delivery" ? "entrega" : "retirada"}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 px-3 py-2">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="truncate font-sans text-sm font-semibold leading-5 text-ink-900">
            {item.status_descricao} · {item.modalidade === "delivery" ? "Entrega" : "Retirada"}
          </h2>
          <p className="truncate text-xs leading-4 text-ink-500">
            {!podeGravar
              ? "Consulta. Alterar os avisos fica com o gestor."
              : sujo
                ? "Alterações não salvas."
                : "Vale para os próximos avisos. Mensagens já na fila mantêm o texto anterior."}
          </p>
        </div>
        {podeGravar ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm("Restaurar o texto e a ativação padrão deste status e modalidade?")
                )
                  void salvar(true);
              }}
            >
              Restaurar padrão
            </Button>
            <Button
              size="sm"
              className="h-8 px-2.5"
              disabled={busy || !texto.trim() || !sujo}
              onClick={() => void salvar()}
            >
              {busy ? "Salvando…" : "Salvar aviso"}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto bg-base-100 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-2">
          <label htmlFor="texto-aviso" className="block text-xs font-medium text-ink-500">
            Mensagem ao cliente
          </label>
          <Textarea
            id="texto-aviso"
            ref={campo}
            className="min-h-36 bg-card"
            value={texto}
            maxLength={limite}
            disabled={busy || !podeGravar}
            aria-invalid={erro?.campo === "texto"}
            aria-describedby="ajuda-aviso erro-aviso"
            onChange={(e) => editar(e.target.value)}
          />
          {erro ? (
            <p id="erro-aviso" role="alert" className="text-sm text-destructive">
              {erro.mensagem}
            </p>
          ) : null}
          <div id="ajuda-aviso" className="space-y-1.5 text-xs text-ink-500">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 tabular-nums">
                {texto.length}/{limite}
              </span>
              {podeGravar
                ? variaveis.map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={busy || texto.length + v.length + 2 > limite}
                      className="rounded border border-base-200 bg-card px-1.5 py-0.5 font-mono text-[11px] text-purple-800 hover:bg-purple-50 disabled:opacity-50"
                      title="Inserir no ponto do cursor"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => inserir(v)}
                    >{`{${v}}`}</button>
                  ))
                : null}
            </div>
            <p>
              Trecho opcional: <code>{"[[ Previsão: {previsao}.]]"}</code>. Ele some quando o dado
              não está disponível.
            </p>
          </div>
        </div>
        <aside aria-label="Prévia da mensagem" className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-ink-500">Prévia</p>
          {erroPrevia ? (
            <p role="alert" className="text-xs text-destructive">
              {erroPrevia}
            </p>
          ) : null}
          <div className="max-w-full rounded-xl rounded-bl-sm border border-base-200 bg-card px-2.5 py-1.5">
            <p className="whitespace-pre-wrap break-words text-sm leading-snug text-ink-900">
              {previa?.texto ?? "…"}
            </p>
          </div>
          {previa && previa.texto_sem_opcionais !== previa.texto ? (
            <>
              <p className="text-xs font-medium text-ink-500">Sem os dados opcionais</p>
              <div className="max-w-full rounded-xl rounded-bl-sm border border-base-200 bg-card px-2.5 py-1.5">
                <p className="whitespace-pre-wrap break-words text-sm leading-snug text-ink-900">
                  {previa.texto_sem_opcionais}
                </p>
              </div>
            </>
          ) : null}
          <p className="text-xs text-ink-500">Exemplo gerado pelo gateway. Nada é enviado.</p>
        </aside>
      </div>
    </section>
  );
}
