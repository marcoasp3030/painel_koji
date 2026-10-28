/** Aba Visão geral do agente: prontidão, situação e teste. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessagesSquare, Play } from "lucide-react";
import { Ajuda, type ContextoGateway } from "@/components/luxtia/Gateway";
import { Cartao } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { peloMenos } from "@/lib/acesso/papeis";
import { testarAgente } from "@/lib/gateway-agentes.functions";
import {
  itensDaVisao,
  resumoProntidao,
  type AcaoProntidao,
  type ItemProntidao,
} from "@/lib/gateway/prontidao";
import type { AgenteDetalhe, ResultadoTeste } from "@/lib/gateway/tipos";
import { CAMPO_AGENTE, RESPOSTAS, SITUACAO_AGENTE } from "@/lib/gateway/vocabulario";
import { Checklist } from "./Checklist";

export function VisaoGeral({
  ctx,
  agente,
  itens,
  salvando,
  onAcao,
  onSituacao,
}: {
  ctx: ContextoGateway;
  agente: AgenteDetalhe;
  itens: ItemProntidao[];
  salvando: boolean;
  onAcao: (acao: AcaoProntidao) => void;
  onSituacao: (status: "ativo" | "pausado" | "rascunho") => void;
}) {
  const plataforma = ctx.papel === "plataforma";
  const podeEditar = peloMenos(ctx.papel, "gestor");
  const visiveis = itensDaVisao(itens, ctx.papel);
  const { prontos, total } = resumoProntidao(visiveis);
  const situacoes = (plataforma ? ["ativo", "pausado", "rascunho"] : ["ativo", "pausado"]) as (
    "ativo" | "pausado" | "rascunho"
  )[];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Cartao className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl text-purple-800">Prontidão</h2>
          <p className="text-sm text-ink-500">
            {prontos} de {total} itens prontos
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-base-200">
          <div
            className="h-full rounded-full bg-success transition-[width]"
            style={{ width: `${total ? (prontos / total) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-3">
          <Checklist
            itens={visiveis}
            papel={ctx.papel}
            status={agente.status}
            ocupado={salvando}
            onAcao={onAcao}
          />
        </div>
      </Cartao>

      <div className="space-y-6">
        <Cartao className="p-6">
          <h2 className="font-display text-xl text-purple-800">{CAMPO_AGENTE.status.rotulo}</h2>
          <Ajuda>{CAMPO_AGENTE.status.ajuda}</Ajuda>
          {podeEditar ? (
            <div
              className="mt-4 inline-flex rounded-lg border border-base-200 bg-base-50 p-1"
              role="radiogroup"
              aria-label={CAMPO_AGENTE.status.rotulo}
            >
              {situacoes.map((s) => {
                const atual = agente.status === s;
                // Admin da empresa não tira o agente do rascunho.
                const bloqueado = !plataforma && agente.status === "rascunho";
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={atual}
                    disabled={salvando || atual || bloqueado}
                    onClick={() => onSituacao(s)}
                    className={`rounded-md px-4 py-1.5 text-sm transition-colors disabled:cursor-default ${
                      atual
                        ? "bg-purple-700 text-base-50"
                        : "text-ink-700 hover:bg-purple-50 disabled:opacity-50"
                    }`}
                  >
                    {SITUACAO_AGENTE[s]?.rotulo}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-900">{SITUACAO_AGENTE[agente.status]?.rotulo}</p>
          )}
          {!plataforma && agente.status === "rascunho" ? (
            <Ajuda>Para tirar do rascunho, peça à administração da plataforma.</Ajuda>
          ) : null}
        </Cartao>

        {podeEditar ? <Testar ctx={ctx} agente={agente} /> : null}

        {podeEditar ? (
          <Button asChild variant="outline" className="w-full">
            <Link to="/ia/simular" search={{ agente: agente.id }}>
              <MessagesSquare className="size-4" aria-hidden /> Abrir no Simular
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Testar({ ctx, agente }: { ctx: ContextoGateway; agente: AgenteDetalhe }) {
  const testar = useServerFn(testarAgente);
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const modo = String(agente.configuracao_efetiva?.["agente_mode"] ?? agente.agente_mode ?? "mock");

  const mutation = useMutation({
    mutationFn: () => testar({ data: { empresa: ctx.empresa, agente: agente.id } }),
    onMutate: () => {
      setResultado(null);
      setErro(null);
    },
    onSuccess: setResultado,
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <Cartao className="p-6">
      <h2 className="font-display text-xl text-purple-800">Testar o agente</h2>
      <Ajuda>
        {modo === "live"
          ? "Envia uma mensagem de teste ao Skyone. Nada vai para os clientes."
          : `Respostas em ${RESPOSTAS["mock"]}: o teste responde sem chamar a IA.`}
      </Ajuda>
      <Button className="mt-4" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Play className="size-4" aria-hidden />
        )}
        Testar agente
      </Button>
      {resultado ? (
        <div className="mt-4 rounded-lg border border-base-200 bg-base-50 p-4" aria-live="polite">
          <p className="text-xs font-medium text-success">
            Respondeu em{" "}
            {(resultado.latencia_ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s
          </p>
          <ul className="mt-2 space-y-2">
            {resultado.resposta.map((linha, i) => (
              <li
                key={i}
                className="whitespace-pre-wrap rounded-md bg-card px-3 py-2 text-sm text-ink-900"
              >
                {linha}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {erro ? (
        <p
          className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
          aria-live="polite"
        >
          {erro}
        </p>
      ) : null}
    </Cartao>
  );
}
