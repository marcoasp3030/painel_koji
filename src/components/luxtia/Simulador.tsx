/**
 * Conversa de teste com um agente, em formato de chat (canal API, envio em
 * teste). Funciona em Simulação e com a IA real do Skyone; só bloqueia se o
 * envio aos clientes do agente for real. Usada no Simular e no assistente.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Loader2, RotateCcw, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { dataHora, type ContextoGateway } from "@/components/luxtia/Gateway";
import { Cartao } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listarAgentes, obterAgente } from "@/lib/gateway-agentes.functions";
import { listarCanais } from "@/lib/gateway-canais.functions";
import { historicoConversa, simularMensagem } from "@/lib/gateway-simular.functions";
import { temposDeResposta } from "@/lib/gateway/conversa";
import { ORIGEM_MENSAGEM, SITUACAO_AGENTE } from "@/lib/gateway/vocabulario";

const BANNER_IA_REAL =
  "Conversa de teste: as respostas vêm do Skyone, mas nada é enviado aos clientes.";
const BANNER_SIMULACAO =
  "Conversa de teste em simulação: o agente responde sem chamar a IA. Nada é enviado aos clientes.";

function novoCliente() {
  return `teste-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
}

export function Simulador({
  ctx,
  agenteInicial = null,
  agenteFixo = false,
}: {
  ctx: ContextoGateway;
  agenteInicial?: string | null;
  /** Assistente: o agente já vem escolhido e não muda. */
  agenteFixo?: boolean;
}) {
  const listarAg = useServerFn(listarAgentes);
  const obterAg = useServerFn(obterAgente);
  const listarCn = useServerFn(listarCanais);
  const simular = useServerFn(simularMensagem);
  const historico = useServerFn(historicoConversa);

  const [agente, setAgente] = useState(agenteInicial ?? "");
  const [canal, setCanal] = useState("");
  const [cliente, setCliente] = useState(novoCliente);
  const [texto, setTexto] = useState("");
  const [conversa, setConversa] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const fim = useRef<HTMLDivElement>(null);

  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
  });
  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    queryFn: () => listarCn({ data: { empresa: ctx.empresa } }),
  });
  // Modo efetivo (com herança) vem do detalhe do agente.
  const detalhe = useQuery({
    queryKey: ["gateway", "agente", ctx.empresa, agente],
    queryFn: () => obterAg({ data: { empresa: ctx.empresa, agente } }),
    enabled: Boolean(agente),
  });

  const canaisApi = (canais.data?.itens ?? []).filter(
    (c) => c.tipo === "api" && c.agente_id === agente,
  );

  useEffect(() => {
    const primeiro = canaisApi.find((c) => c.ativo) ?? canaisApi[0];
    setCanal(primeiro?.id ?? "");
    setConversa(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agente, canais.data]);

  const mensagens = useQuery({
    queryKey: ["gateway", "historico", ctx.empresa, conversa],
    queryFn: () => historico({ data: { empresa: ctx.empresa, conversa: conversa! } }),
    enabled: Boolean(conversa),
    refetchInterval: 2500,
  });
  const itens = mensagens.data?.itens ?? [];
  const ultima = itens.at(-1);
  const esperando = Boolean(conversa) && (ultima ? ultima.direcao === "entrada" : true);

  // Relógio só enquanto espera, para o aviso de demora.
  useEffect(() => {
    if (!esperando) return;
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [esperando]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest" });
  }, [itens.length, esperando]);

  const envio = useMutation({
    mutationFn: (mensagem: string) =>
      simular({
        data: {
          empresa: ctx.empresa,
          agente,
          canal_id: canal,
          identificador: cliente,
          texto: mensagem,
        },
      }),
    onSuccess: (r) => {
      setTexto("");
      setConversa(r.conversation_id);
      setAgora(Date.now());
      if (r.duplicada) toast.info("Mensagem repetida: o gateway já tinha recebido.");
      void mensagens.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const efetiva = detalhe.data?.configuracao_efetiva ?? {};
  const iaReal = String(efetiva["agente_mode"] ?? "mock") === "live";
  const envioReal = String(efetiva["send_mode"] ?? "dry") === "live";
  const timeout = Number(efetiva["timeout_s"] ?? detalhe.data?.timeout_s ?? 90);
  const limiteEspera = iaReal ? Math.max(60, timeout + 10) : 60;
  const canalAtual = canaisApi.find((c) => c.id === canal);
  const status = detalhe.data?.status;

  const avisos: { texto: string; agente?: boolean }[] = [];
  if (status && status !== "ativo") {
    avisos.push({
      texto: `O agente está ${SITUACAO_AGENTE[status]?.rotulo.toLowerCase() ?? status}: as mensagens serão ignoradas.`,
      agente: true,
    });
  }
  if (agente && canais.data && canaisApi.length === 0) {
    avisos.push({
      texto: "Este agente não tem canal API (para testes). Crie um na aba Canais do agente.",
      agente: true,
    });
  } else if (canalAtual && !canalAtual.ativo) {
    avisos.push({
      texto: "O canal API está desativado: as mensagens serão ignoradas.",
      agente: true,
    });
  }
  const bloqueado = envioReal || !agente || !canal;

  const ultimaDoCliente = [...itens].reverse().find((m) => m.direcao === "entrada");
  const desde = ultimaDoCliente?.enviada_em ? Date.parse(ultimaDoCliente.enviada_em) : agora;
  const demorou = esperando && (agora - desde) / 1000 > limiteEspera;
  const tempos = temposDeResposta(itens);

  function enviar() {
    const mensagem = texto.trim();
    if (!mensagem || bloqueado || envio.isPending) return;
    envio.mutate(mensagem);
  }

  const linkAgente = agente ? (
    <Link
      to="/ia/agentes/$agenteId"
      params={{ agenteId: agente }}
      search={ctx.empresa ? { empresa: ctx.empresa } : {}}
      className="font-medium underline underline-offset-2"
    >
      Abrir o agente
    </Link>
  ) : null;

  return (
    <div className="mt-6 space-y-4">
      <Cartao className="flex flex-wrap items-end gap-4 p-4">
        <div className="w-full space-y-1.5 sm:w-64">
          <Label htmlFor="si-agente">Agente</Label>
          <Select value={agente} onValueChange={setAgente} disabled={agenteFixo}>
            <SelectTrigger id="si-agente">
              <SelectValue placeholder={agentes.isLoading ? "Carregando…" : "Escolha o agente"} />
            </SelectTrigger>
            <SelectContent>
              {(agentes.data?.itens ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canaisApi.length > 1 ? (
          <div className="w-full space-y-1.5 sm:w-56">
            <Label htmlFor="si-canal">Canal API</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger id="si-canal">
                <SelectValue placeholder="Escolha o canal" />
              </SelectTrigger>
              <SelectContent>
                {canaisApi.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.ativo ? "" : "(desativado)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="w-full space-y-1.5 sm:w-48">
          <Label htmlFor="si-cliente">Cliente (teste)</Label>
          <Input
            id="si-cliente"
            value={cliente}
            maxLength={100}
            onChange={(e) => {
              setCliente(e.target.value);
              setConversa(null);
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setCliente(novoCliente());
            setConversa(null);
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Nova conversa
        </Button>
      </Cartao>

      {agente && detalhe.data ? (
        envioReal ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />A conversa de teste fica
            bloqueada porque o envio aos clientes deste agente está real.
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-purple-50 px-4 py-3 text-sm text-purple-800">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {iaReal ? BANNER_IA_REAL : BANNER_SIMULACAO}
          </p>
        )
      ) : null}
      {avisos.map((a) => (
        <p
          key={a.texto}
          className="flex flex-wrap items-center gap-2 rounded-lg bg-gold-300/20 px-4 py-2 text-sm text-gold-700"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {a.texto} {a.agente ? linkAgente : null}
        </p>
      ))}

      <Cartao className="flex h-[min(70vh,40rem)] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6" aria-live="polite">
          {!conversa ? (
            <p className="mx-auto mt-16 max-w-sm text-center text-sm text-ink-500">
              {agente
                ? "Escreva abaixo como se fosse um cliente. As respostas aparecem aqui."
                : "Escolha um agente para começar."}
            </p>
          ) : null}
          {mensagens.data?.tem_mais ? (
            <p className="text-center text-xs text-ink-500">Mostrando as últimas 50 mensagens.</p>
          ) : null}
          {itens.map((m) => {
            const doCliente = m.direcao === "entrada";
            const tempo = tempos.get(m.id);
            return (
              <div key={m.id} className={`flex ${doCliente ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-[0_1px_2px_rgba(26,21,32,0.06)] ${
                    doCliente
                      ? "rounded-br-md bg-purple-700 text-base-50"
                      : "rounded-bl-md border border-base-200 bg-card text-ink-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.conteudo ?? "—"}</p>
                  <p
                    className={`mt-1 text-[11px] ${doCliente ? "text-purple-200" : "text-ink-500"}`}
                  >
                    {ORIGEM_MENSAGEM[m.origem] ?? m.origem} · {dataHora(m.enviada_em)}
                    {tempo !== undefined
                      ? ` · respondeu em ${tempo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`
                      : ""}
                  </p>
                </div>
              </div>
            );
          })}
          {esperando && !demorou ? (
            <div className="flex justify-start" aria-label="O agente está digitando">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-base-200 bg-card px-4 py-3">
                {[0, 150, 300].map((atraso) => (
                  <span
                    key={atraso}
                    className="size-1.5 animate-bounce rounded-full bg-ink-300"
                    style={{ animationDelay: `${atraso}ms` }}
                  />
                ))}
                <span className="ml-2 text-xs text-ink-500">digitando…</span>
              </div>
            </div>
          ) : null}
          {demorou ? (
            <p className="text-center text-xs text-gold-700">
              O agente não respondeu em {limiteEspera} s. Veja a Visão geral do agente. {linkAgente}
            </p>
          ) : null}
          <div ref={fim} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-base-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <Label htmlFor="si-texto" className="sr-only">
            Mensagem
          </Label>
          <Textarea
            id="si-texto"
            rows={1}
            value={texto}
            disabled={bloqueado}
            placeholder={
              bloqueado ? "" : "Escreva como cliente… (Enter envia, Shift+Enter quebra linha)"
            }
            className="max-h-40 min-h-10 resize-none bg-base-50"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
          />
          <Button type="submit" disabled={bloqueado || envio.isPending || !texto.trim()}>
            {envio.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            <span className="sr-only sm:not-sr-only">Enviar</span>
          </Button>
        </form>
      </Cartao>
    </div>
  );
}
