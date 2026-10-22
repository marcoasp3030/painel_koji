/** Bloco de follow-up da conversa e o selo de opt-out do contato. */
import { Etiqueta, dataHora } from "@/components/luxtia/Gateway";
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
import { Button } from "@/components/ui/button";
import {
  ROTULO_ESTADO_FOLLOWUP,
  ROTULO_ORIGEM_OPTOUT,
  rotuloMotivoFollowUp,
  rotuloTipoPendencia,
  type OptOutFollowUp,
  type TarefaFollowUp,
} from "@/lib/gateway/followup";

export function SeloOptOut({
  optOut,
  podeReativar,
  onReativar,
}: {
  optOut: OptOutFollowUp | null | undefined;
  podeReativar: boolean;
  onReativar: () => void;
}) {
  if (!optOut?.ativo) return null;
  const origem = optOut.origem ? ROTULO_ORIGEM_OPTOUT[optOut.origem] : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Etiqueta tom="alerta">não quer follow-up</Etiqueta>
      {origem ? <span className="text-xs text-ink-500">marcado {origem}</span> : null}
      {podeReativar ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Reativar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reativar o follow-up deste contato?</AlertDialogTitle>
              <AlertDialogDescription>
                Só o painel reativa. Uma mensagem do cliente não desfaz este pedido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onReativar}>Reativar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </span>
  );
}

export function BlocoFollowUp({
  itens,
  carregando,
  erro,
  indisponivel,
  podeCancelar,
  cancelando,
  onCancelar,
}: {
  itens: TarefaFollowUp[];
  carregando: boolean;
  erro?: string | undefined;
  indisponivel?: boolean;
  podeCancelar: boolean;
  cancelando: boolean;
  onCancelar: () => void;
}) {
  const temAgendado = itens.some((t) => t.estado === "agendado");
  return (
    <section className="space-y-3 border-b p-4" aria-label="Follow-up">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-ink-900">Follow-up</h3>
        {podeCancelar && temAgendado ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={cancelando}>
                Cancelar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar o follow-up agendado?</AlertDialogTitle>
                <AlertDialogDescription>
                  O que está marcado nesta conversa deixa de valer. O motivo fica como cancelado no
                  painel.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={onCancelar}>Cancelar follow-up</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
      {carregando ? <p className="text-sm text-ink-500">Carregando follow-ups…</p> : null}
      {indisponivel ? (
        <p className="text-sm text-ink-500">Follow-up ainda não está disponível.</p>
      ) : null}
      {erro && !indisponivel ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      {!carregando && !indisponivel && itens.length === 0 ? (
        <p className="text-sm text-ink-500">Nenhum follow-up nesta conversa.</p>
      ) : null}
      {!carregando && !indisponivel && itens.length > 0 ? (
        <ul className="space-y-2">
          {itens.map((t) => {
            const estado = ROTULO_ESTADO_FOLLOWUP[t.estado] ?? {
              rotulo: t.estado,
              tom: "neutro" as const,
            };
            return (
              <li key={t.id} className="rounded-lg border border-base-200 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Etiqueta tom={estado.tom}>{estado.rotulo}</Etiqueta>
                  <span className="text-sm text-ink-900">{rotuloTipoPendencia(t.tipo)}</span>
                  <span className="text-xs text-ink-500">{dataHora(t.previsto_em)}</span>
                </div>
                {t.motivo ? (
                  <p className="mt-1 text-xs text-ink-500">
                    Motivo: {rotuloMotivoFollowUp(t.motivo)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
