import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { precoTexto } from "@/lib/gateway/cardapio";
import { ROTULO_STATUS } from "@/lib/gateway/pedidos";
import {
  ROTULO_ATENDIMENTO,
  desfechoAtendimento,
  motivoAtendimento,
  type AtendimentoConversa,
  type PaginaAtendimentos,
  type RespostaEnc1,
} from "@/lib/gateway/enc1";
export function ResumoAtendimento({
  atendimento: a,
  compacto = false,
}: {
  atendimento: AtendimentoConversa | null | undefined;
  compacto?: boolean;
}) {
  if (!a) return <p className="text-xs text-ink-500">Sem atendimento registrado</p>;
  const data = (s: string | null) =>
    s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold text-purple-900">
        Atendimento #{a.numero} · {ROTULO_ATENDIMENTO[a.estado]}
      </p>
      {!compacto && (
        <>
          <p>Aberto em {data(a.aberto_em)} · Brasília</p>
          {a.encerrado_em && (
            <p>
              Encerrado em {data(a.encerrado_em)} · {motivoAtendimento(a.motivo_encerramento)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
export function AtendimentosConversa({
  atual,
  selecionado,
  selecionar,
  ler,
  agir,
  mudou,
  podeEncerrar = true,
}: {
  atual?: AtendimentoConversa | null | undefined;
  selecionado: string;
  selecionar: (id: string) => void;
  ler: (cursor?: number) => Promise<RespostaEnc1>;
  agir: (acao: "encerrar" | "reabrir") => Promise<RespostaEnc1>;
  mudou: () => void;
  podeEncerrar?: boolean;
}) {
  const [pagina, setPagina] = useState<PaginaAtendimentos | null>(null),
    [erro, setErro] = useState(""),
    [busy, setBusy] = useState(false),
    [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setErro("");
    ler()
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setPagina(r.dados as PaginaAtendimentos);
        else setErro(r.mensagem);
      })
      .catch(() => vivo && setErro("Não foi possível carregar os atendimentos."));
    return () => {
      vivo = false;
    };
  }, [ler, revisao, atual?.id, atual?.estado]);
  const ultimo = pagina?.itens[0] ?? atual;
  async function acao(op: "encerrar" | "reabrir") {
    if (
      !window.confirm(
        op === "encerrar"
          ? "Encerrar o atendimento atual? Nenhuma mensagem será enviada ao cliente."
          : "Reabrir o último atendimento?",
      )
    )
      return;
    setBusy(true);
    setErro("");
    try {
      const r = await agir(op);
      if (!r.ok) setErro(r.mensagem);
      else selecionar((r.dados as { atendimento: AtendimentoConversa }).atendimento.id);
      setRevisao((x) => x + 1);
      mudou();
    } catch {
      setErro("Não foi possível confirmar a ação. Atualize antes de repetir.");
    } finally {
      setBusy(false);
    }
  }
  async function mais() {
    if (!pagina?.proximo_cursor) return;
    setBusy(true);
    try {
      const r = await ler(pagina.proximo_cursor);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      const nova = r.dados as PaginaAtendimentos;
      setPagina({ ...nova, itens: [...pagina.itens, ...nova.itens] });
    } catch {
      setErro("Não foi possível ler mais atendimentos.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Atendimentos" className="space-y-2 border-b bg-purple-50/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResumoAtendimento atendimento={ultimo} />
        {ultimo && podeEncerrar && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !pagina}
            onClick={() => void acao(ultimo.estado === "encerrado" ? "reabrir" : "encerrar")}
          >
            {ultimo.estado === "encerrado" ? "Reabrir último atendimento" : "Encerrar atendimento"}
          </Button>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}{" "}
          <button className="underline" onClick={() => setRevisao((x) => x + 1)}>
            Atualizar
          </button>
        </p>
      )}
      <label className="block text-sm font-medium">
        Mensagens do atendimento
        <select
          className="mt-1 w-full rounded border bg-card p-2"
          value={selecionado}
          onChange={(e) => selecionar(e.target.value)}
        >
          <option value="">Toda a conversa</option>
          {pagina?.itens.map((a) => (
            <option key={a.id} value={a.id}>
              #{a.numero} · {ROTULO_ATENDIMENTO[a.estado]}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Histórico de atendimentos
        </summary>
        <ol className="mt-3 max-h-96 space-y-3 overflow-y-auto">
          {pagina?.itens.map((a) => (
            <li key={a.id} className="rounded-lg border bg-card p-3">
              <ResumoAtendimento atendimento={a} />
              <p className="mt-2 text-sm">{a.resumo || "Sem resumo registrado."}</p>
              {desfechoAtendimento(a.desfecho) && (
                <p className="mt-1 text-xs text-ink-500">
                  Desfecho: {desfechoAtendimento(a.desfecho)}
                </p>
              )}
              {a.pedidos?.map((p) => (
                <p key={String(p.numero)} className="mt-1 text-xs text-ink-600">
                  Pedido {p.numero} · {p.modalidade?.replaceAll("_", " ") || "—"} ·{" "}
                  {ROTULO_STATUS[p.status as keyof typeof ROTULO_STATUS] ??
                    p.status?.replaceAll("_", " ")}
                  {p.total != null ? ` · ${precoTexto(p.total)}` : ""}
                </p>
              ))}
              <p className="mt-1 text-xs text-ink-500">
                {a.mensagens ?? 0} mensagens · Início: {motivoAtendimento(a.motivo_inicio)}
              </p>
              <button
                className="mt-2 text-sm text-purple-800 underline"
                onClick={() => selecionar(a.id)}
              >
                Ver mensagens deste atendimento
              </button>
            </li>
          ))}
        </ol>
        {pagina && !pagina.itens.length && (
          <p className="mt-2 text-sm">Nenhum atendimento registrado.</p>
        )}
        {pagina?.proximo_cursor && (
          <Button variant="ghost" disabled={busy} onClick={() => void mais()}>
            Carregar atendimentos anteriores
          </Button>
        )}
      </details>
    </section>
  );
}
