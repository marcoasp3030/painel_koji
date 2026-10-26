/** Bloco de follow-up da conversa e o selo de opt-out do contato. */
import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  onReativar: (motivo: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  if (!optOut) return null;
  if (!optOut.ativo) {
    if (!optOut.removido_por && !optOut.removido_motivo) return null;
    return (
      <span className="text-xs text-ink-500">
        {optOut.removido_por ? `Reativado por ${optOut.removido_por}` : "Reativado"}
        {optOut.removido_motivo ? `. Motivo: ${optOut.removido_motivo}` : ""}
      </span>
    );
  }
  const origem = optOut.origem ? ROTULO_ORIGEM_OPTOUT[optOut.origem] : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Etiqueta tom="alerta">não quer follow-up</Etiqueta>
      {origem ? <span className="text-xs text-ink-500">marcado {origem}</span> : null}
      {podeReativar ? (
        <>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setAberto(true)}>
            Reativar
          </Button>
          <Dialog
            open={aberto}
            onOpenChange={(v) => {
              setAberto(v);
              if (!v) setMotivo("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reativar o follow-up deste contato?</DialogTitle>
                <DialogDescription>
                  Este contato pediu para não receber follow-up. Reativar só com o pedido dele.
                </DialogDescription>
              </DialogHeader>
              <label className="block text-sm" htmlFor="motivo-reativar">
                Motivo
                <Textarea
                  id="motivo-reativar"
                  className="mt-1"
                  required
                  minLength={3}
                  maxLength={300}
                  rows={3}
                  value={motivo}
                  placeholder="Por que este contato pediu para voltar a receber"
                  onChange={(e) => setMotivo(e.target.value)}
                />
                <span className="mt-1 block text-xs text-ink-500">Mínimo de 3 caracteres.</span>
              </label>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={motivo.trim().length < 3}
                  onClick={() => {
                    onReativar(motivo.trim());
                    setAberto(false);
                    setMotivo("");
                  }}
                >
                  Reativar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
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
  const vazio = !carregando && !indisponivel && !erro && itens.length === 0;
  return (
    <section
      className={vazio ? "border-b px-4 py-2" : "space-y-3 border-b px-4 py-3"}
      aria-label="Follow-up"
    >
      {vazio ? (
        <p className="text-xs text-ink-500">Nenhum follow-up nesta conversa.</p>
      ) : (
        <h3 className="font-medium text-ink-900">Follow-up</h3>
      )}
      {carregando ? <p className="text-sm text-ink-500">Carregando follow-ups…</p> : null}
      {indisponivel ? (
        <p className="text-sm text-ink-500">Follow-up ainda não está disponível.</p>
      ) : null}
      {erro && !indisponivel ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
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
                  {podeCancelar && t.estado === "agendado" ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          disabled={cancelando}
                        >
                          Cancelar este
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar o follow-up agendado?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O que está marcado nesta conversa deixa de valer. O motivo fica como
                            cancelado no painel.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction onClick={onCancelar}>
                            Cancelar follow-up
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
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
