import { useEffect, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { avisos } from "@/lib/gateway-avisos.functions";
import type { ConfigAviso, ConfigAvisos, PreviaAviso } from "@/lib/gateway/avisos";
import type { ContextoGateway } from "./Gateway";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AvisosPedido({ ctx }: { ctx: ContextoGateway }) {
  const fn = useServerFn(avisos);
  const [modalidade, setModalidade] = useState("delivery");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);
  useBlocker({ shouldBlockFn: () => sujo && !window.confirm("Descartar alterações não salvas?") });
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
  const mudar = (f: () => void) => {
    if (!sujo || window.confirm("Descartar alterações não salvas?")) {
      setSujo(false);
      f();
    }
  };
  if (q.isPending) return <p role="status">Carregando avisos…</p>;
  if (q.error)
    return (
      <div role="alert">
        {q.error.message}
        <Button onClick={() => void q.refetch()}>Tentar novamente</Button>
      </div>
    );
  const itens = q.data.itens.filter((i) => i.modalidade === modalidade);
  const item = itens.find((i) => i.status === selecionado) ?? itens[0];
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Personalize as mensagens enviadas ao cliente quando o pedido muda de status. As alterações
        valem para os próximos avisos; mensagens já na fila mantêm o texto anterior.
      </p>
      <div className="flex gap-2" aria-label="Modalidade">
        {["delivery", "retirada"].map((m) => (
          <Button
            key={m}
            variant={modalidade === m ? "default" : "outline"}
            onClick={() => mudar(() => setModalidade(m))}
          >
            {m === "delivery" ? "Entrega" : "Retirada"}
          </Button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Status do aviso" className="flex gap-2 overflow-x-auto lg:flex-col">
          {itens.map((i) => (
            <button
              key={i.status}
              className={`min-h-12 shrink-0 rounded-lg border px-4 py-3 text-left text-sm ${item?.status === i.status ? "border-primary bg-primary/10" : "bg-card"}`}
              onClick={() => mudar(() => setSelecionado(i.status))}
            >
              <span className="block font-medium">{i.status_descricao}</span>
              <span className="text-xs text-muted-foreground">
                {i.ativo ? "Ligado" : "Desligado"}
              </span>
            </button>
          ))}
        </nav>
        {item ? (
          <Editor
            key={`${item.status}:${item.modalidade}:${item.texto}:${item.ativo}`}
            ctx={ctx}
            item={item}
            variaveis={q.data.variaveis}
            max={q.data.max_texto}
            onDirty={setSujo}
          />
        ) : (
          <p>Nenhum aviso disponível.</p>
        )}
      </div>
    </div>
  );
}
function Editor({
  ctx,
  item,
  variaveis,
  max,
  onDirty,
}: {
  ctx: ContextoGateway;
  item: ConfigAviso;
  variaveis: string[];
  max: number;
  onDirty: (v: boolean) => void;
}) {
  const fn = useServerFn(avisos);
  const cache = useQueryClient();
  const [texto, setTexto] = useState(item.texto);
  const [ativo, setAtivo] = useState(item.ativo);
  const [previa, setPrevia] = useState<PreviaAviso | null>(null);
  const [erro, setErro] = useState<{ campo: string; mensagem: string } | null>(null);
  const [busy, setBusy] = useState(false);
  function editar(t: string, a = ativo) {
    setTexto(t);
    setAtivo(a);
    setPrevia(null);
    setErro(null);
    onDirty(t !== item.texto || a !== item.ativo);
  }
  async function executar(acao: "salvar" | "previa", restaurar = false) {
    setBusy(true);
    setErro(null);
    try {
      const r = await fn({
        data: {
          acao,
          empresa: ctx.empresa,
          status: item.status,
          modalidade: item.modalidade,
          texto: restaurar ? null : texto,
          ...(acao === "salvar" ? { ativo: restaurar ? null : ativo } : {}),
        },
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      if (acao === "previa") setPrevia(r.dados as PreviaAviso);
      else {
        onDirty(false);
        cache.setQueryData(["avisos", ctx.empresa], r.dados);
        toast.success("Aviso salvo.");
      }
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
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">
        {item.status_descricao} · {item.modalidade === "delivery" ? "Entrega" : "Retirada"}
      </h2>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={ativo}
          disabled={busy}
          onChange={(e) => editar(texto, e.target.checked)}
        />
        Enviar aviso neste status e modalidade
      </label>
      <label htmlFor="texto-aviso" className="block font-medium">
        Mensagem ao cliente
      </label>
      <Textarea
        id="texto-aviso"
        className="min-h-40"
        value={texto}
        maxLength={Math.min(max, 1000)}
        disabled={busy}
        aria-invalid={erro?.campo === "texto"}
        aria-describedby="ajuda-aviso erro-aviso"
        onChange={(e) => editar(e.target.value)}
      />
      <div id="ajuda-aviso" className="space-y-2 text-sm text-muted-foreground">
        <p>
          {texto.length}/{Math.min(max, 1000)} caracteres. Toque em uma variável para acrescentá-la
          ao texto:
        </p>
        <div className="flex flex-wrap gap-2">
          {variaveis.map((v) => (
            <Button
              key={v}
              variant="outline"
              size="sm"
              disabled={busy || texto.length + v.length + 2 > max}
              onClick={() => editar(`${texto}{${v}}`)}
            >{`{${v}}`}</Button>
          ))}
        </div>
        <p>
          Use <code>{"[[ Previsão: {previsao}.]]"}</code> para um trecho opcional. Ele desaparece
          quando o dado não está disponível. A prévia mostra as duas situações.
        </p>
      </div>
      {erro ? (
        <p id="erro-aviso" role="alert" className="text-sm text-destructive">
          {erro.mensagem}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !texto.trim()} onClick={() => void executar("salvar")}>
          {busy ? "Aguarde…" : "Salvar aviso"}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !texto.trim()}
          onClick={() => void executar("previa")}
        >
          Ver prévia
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Restaurar o texto e a ativação padrão deste status e modalidade?"))
              void executar("salvar", true);
          }}
        >
          Restaurar padrão
        </Button>
      </div>
      {previa ? (
        <div className="grid gap-4 rounded-lg bg-muted p-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium">Com todos os dados</h3>
            <p className="whitespace-pre-wrap">{previa.texto}</p>
          </div>
          <div>
            <h3 className="mb-2 font-medium">Sem dados opcionais</h3>
            <p className="whitespace-pre-wrap">{previa.texto_sem_opcionais}</p>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Exemplo gerado pelo gateway. Nada foi enviado ao cliente.
          </p>
        </div>
      ) : null}
    </section>
  );
}
