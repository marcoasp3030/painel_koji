import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Etiqueta,
  PaginaGateway,
  dataHora,
  type ContextoGateway,
} from "@/components/luxtia/Gateway";
import { Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
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
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { listarCanais } from "@/lib/gateway-canais.functions";
import { historicoConversa, simularMensagem } from "@/lib/gateway-simular.functions";
import { SITUACAO_AGENTE } from "@/lib/gateway/vocabulario";

export const Route = createFileRoute("/_authenticated/ia/simular")({
  head: () => ({ meta: [{ title: "Simular conversa | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Simular conversa"
      descricao="Envie mensagens como se fosse um cliente, por um canal API. Só funciona com o agente em mock/dry: nada sai para clientes reais."
      papeis={["plataforma", "admin"]}
    >
      {(ctx) => <Simular key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

const ORIGEM: Record<string, string> = {
  cliente: "Cliente",
  agente: "Agente",
  bot: "Agente",
  humano: "Atendente",
  sistema: "Sistema",
};

function Simular({ ctx }: { ctx: ContextoGateway }) {
  const listarAg = useServerFn(listarAgentes);
  const listarCn = useServerFn(listarCanais);
  const simular = useServerFn(simularMensagem);
  const historico = useServerFn(historicoConversa);

  const [agente, setAgente] = useState("");
  const [canal, setCanal] = useState("");
  const [identificador, setIdentificador] = useState("painel-teste");
  const [texto, setTexto] = useState("");
  const [conversa, setConversa] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
  });
  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    queryFn: () => listarCn({ data: { empresa: ctx.empresa } }),
  });

  const agenteAtual = agentes.data?.itens.find((a) => a.id === agente);
  const canaisApi = (canais.data?.itens ?? []).filter(
    (c) => c.tipo === "api" && c.agente_id === agente,
  );

  // Ao trocar de agente, sugere o primeiro canal API ativo dele.
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
    // A resposta do agente chega depois da espera de agrupamento (debounce).
    refetchInterval: 2500,
  });

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest" });
  }, [mensagens.data?.itens.length]);

  const envio = useMutation({
    mutationFn: () =>
      simular({
        data: { empresa: ctx.empresa, agente, canal_id: canal, identificador, texto },
      }),
    onSuccess: (r) => {
      setTexto("");
      setConversa(r.conversation_id);
      if (r.duplicada) toast.info("Mensagem repetida: o gateway já tinha recebido.");
      void mensagens.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canalAtual = canaisApi.find((c) => c.id === canal);
  const avisos: string[] = [];
  if (agenteAtual && agenteAtual.status !== "ativo")
    avisos.push(
      "O agente está pausado ou em rascunho: a mensagem será ignorada. Ative-o na tela Agentes.",
    );
  if (agenteAtual && (agenteAtual.agente_mode ?? "mock") !== "mock")
    avisos.push(
      "Por enquanto a simulação só funciona com respostas em Simulação. A conversa de teste com a IA real depende de uma atualização do gateway.",
    );
  if (agenteAtual && (agenteAtual.send_mode ?? "dry") !== "dry")
    avisos.push("A simulação fica bloqueada porque o envio aos clientes deste agente está real.");
  if (agente && canaisApi.length === 0)
    avisos.push("Este agente não tem canal API (para testes). Crie um na tela Canais.");
  if (canalAtual && !canalAtual.ativo)
    avisos.push("O canal está desativado: a mensagem será ignorada. Ative-o na tela Canais.");

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Cartao className="p-6">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!agente || !canal) {
              toast.error("Escolha o agente e o canal API.");
              return;
            }
            envio.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="si-agente">Agente</Label>
            <Select value={agente} onValueChange={setAgente}>
              <SelectTrigger id="si-agente">
                <SelectValue placeholder={agentes.isLoading ? "Carregando…" : "Escolha o agente"} />
              </SelectTrigger>
              <SelectContent>
                {(agentes.data?.itens ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome} · {SITUACAO_AGENTE[a.status]?.rotulo ?? a.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="si-canal">Canal API</Label>
            <Select value={canal} onValueChange={setCanal} disabled={canaisApi.length === 0}>
              <SelectTrigger id="si-canal">
                <SelectValue placeholder="Escolha o canal" />
              </SelectTrigger>
              <SelectContent>
                {canaisApi.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.ativo ? "" : "(inativo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="si-ident">Cliente simulado</Label>
            <Input
              id="si-ident"
              value={identificador}
              required
              maxLength={100}
              onChange={(e) => {
                setIdentificador(e.target.value);
                setConversa(null);
              }}
            />
            <p className="text-xs text-ink-500">Cada identificador é uma conversa diferente.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="si-texto">Mensagem</Label>
            <Textarea
              id="si-texto"
              rows={3}
              value={texto}
              required
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </div>
          {avisos.length > 0 ? (
            <ul className="space-y-1 rounded-lg bg-gold-300/20 px-3 py-2 text-xs text-gold-700">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          <Button type="submit" className="w-full" disabled={envio.isPending}>
            {envio.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Enviar como cliente
          </Button>
        </form>
      </Cartao>

      <Cartao className="flex min-h-[24rem] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-base-200 px-5 py-3">
          <p className="truncate font-mono text-xs text-ink-500">
            {conversa ?? "Nenhuma conversa"}
          </p>
          {mensagens.isFetching ? (
            <Loader2 className="size-4 animate-spin text-ink-300" aria-label="Atualizando" />
          ) : null}
        </div>
        {!conversa ? (
          <EstadoVazio
            titulo="Envie a primeira mensagem"
            texto="O histórico aparece aqui e se atualiza sozinho enquanto o agente responde."
          />
        ) : mensagens.error ? (
          <EstadoVazio
            titulo="Não foi possível carregar"
            texto={(mensagens.error as Error).message}
          />
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
            {mensagens.data?.tem_mais ? (
              <p className="text-center text-xs text-ink-500">Mostrando as últimas 50 mensagens.</p>
            ) : null}
            {(mensagens.data?.itens ?? []).map((m) => {
              const cliente = m.direcao === "entrada";
              return (
                <div key={m.id} className={`flex ${cliente ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${cliente ? "bg-base-100 text-ink-900" : "bg-purple-700 text-base-50"}`}
                  >
                    <p className="whitespace-pre-wrap">{m.conteudo ?? "—"}</p>
                    <p
                      className={`mt-1 text-[11px] ${cliente ? "text-ink-500" : "text-purple-200"}`}
                    >
                      {ORIGEM[m.origem] ?? m.origem} · {dataHora(m.enviada_em)}
                    </p>
                  </div>
                </div>
              );
            })}
            {mensagens.data &&
            mensagens.data.itens.length > 0 &&
            mensagens.data.itens.at(-1)?.direcao === "entrada" ? (
              <p className="flex items-center gap-2 text-xs text-ink-500">
                <Loader2 className="size-3 animate-spin" aria-hidden /> Aguardando o agente…
                <Etiqueta>mock/dry</Etiqueta>
              </p>
            ) : null}
            <div ref={fim} />
          </div>
        )}
      </Cartao>
    </div>
  );
}
