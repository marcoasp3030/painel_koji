/** Webhooks de saída: URL, eventos e o segredo mostrado uma vez. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Etiqueta, SegredoUmaVez, Vazio } from "@/components/luxtia/Gateway";
import { Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { dataHoraBrasilia } from "@/lib/gateway/documentos";
import { gruposDeEventos, type EntregaWebhook, type WebhookSaida } from "@/lib/gateway/webhooks";

export function WebhooksSaidaTela({
  itens,
  carregando,
  erro,
  salvando,
  entregas,
  onCriar,
  onSalvar,
  onDesativar,
  onTestar,
  onEntregas,
  segredo,
  onFecharSegredo,
}: {
  itens: WebhookSaida[];
  carregando: boolean;
  erro?: string | undefined;
  salvando: boolean;
  entregas: EntregaWebhook[] | null;
  onCriar: (dados: { url: string; eventos: string[]; ativo: boolean }) => void;
  onSalvar: (w: WebhookSaida, dados: { url: string; eventos: string[]; ativo: boolean }) => void;
  onDesativar: (w: WebhookSaida) => void;
  onTestar: (w: WebhookSaida) => void;
  onEntregas: (w: WebhookSaida) => void;
  segredo: string | null;
  onFecharSegredo: () => void;
}) {
  const [aberto, setAberto] = useState<WebhookSaida | "nova" | null>(null);
  return (
    <>
      <div className="mt-6 flex justify-end">
        <Button onClick={() => setAberto("nova")}>
          <Plus className="size-4" aria-hidden /> Novo webhook
        </Button>
      </div>
      <Cartao className="mt-4">
        {carregando ? (
          <p className="px-5 py-8 text-ink-500">Carregando…</p>
        ) : erro ? (
          <EstadoVazio titulo="Não foi possível carregar" texto={erro} />
        ) : itens.length === 0 ? (
          <Vazio
            titulo="Nenhum webhook de saída"
            texto="Avise um sistema da empresa quando um documento ficar pronto ou um follow-up for agendado."
            acao={
              <Button onClick={() => setAberto("nova")}>
                <Plus className="size-4" aria-hidden /> Criar webhook
              </Button>
            }
          />
        ) : (
          <ul>
            {itens.map((w) => (
              <li
                key={w.id}
                className="flex flex-col gap-3 border-b border-base-200 px-5 py-4 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-medium text-ink-900">{w.url}</p>
                  <Etiqueta tom={w.ativo ? "sucesso" : "neutro"}>
                    {w.ativo ? "Ativo" : "Inativo"}
                  </Etiqueta>
                </div>
                <div className="flex flex-wrap gap-1">
                  {w.eventos.map((e) => (
                    <Etiqueta key={e} tom="roxo">
                      {e}
                    </Etiqueta>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAberto(w)}>
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!w.ativo || salvando}
                    onClick={() => onTestar(w)}
                  >
                    Testar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onEntregas(w)}>
                    Entregas
                  </Button>
                  {w.ativo ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Desativar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Desativar este webhook?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ele para de receber eventos. As entregas já feitas continuam no
                            histórico.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDesativar(w)}>
                            Desativar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      {entregas ? (
        <Cartao className="mt-4">
          <h2 className="border-b border-base-200 px-5 py-3 font-medium text-ink-900">
            Últimas entregas
          </h2>
          {entregas.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Nenhuma entrega ainda.</p>
          ) : (
            <ul>
              {entregas.map((e) => (
                <li key={e.id} className="border-b border-base-200 px-5 py-3 text-sm last:border-0">
                  {e.evento} · {e.status}
                  {e.http_status ? ` · HTTP ${e.http_status}` : ""} ·{" "}
                  {dataHoraBrasilia(e.criado_em)}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      ) : null}
      <FormularioWebhook
        alvo={aberto}
        salvando={salvando}
        onFechar={() => setAberto(null)}
        onSalvar={(dados) => {
          if (aberto && aberto !== "nova") onSalvar(aberto, dados);
          else onCriar(dados);
          setAberto(null);
        }}
      />
      <SegredoUmaVez
        titulo="Segredo do webhook"
        descricao="Use para conferir a assinatura X-Gateway-Signature. O painel não mostra este valor de novo."
        valor={segredo}
        onFechar={onFecharSegredo}
      />
    </>
  );
}

function FormularioWebhook({
  alvo,
  salvando,
  onFechar,
  onSalvar,
}: {
  alvo: WebhookSaida | "nova" | null;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (dados: { url: string; eventos: string[]; ativo: boolean }) => void;
}) {
  const atual = alvo && alvo !== "nova" ? alvo : null;
  const [url, setUrl] = useState(atual?.url ?? "");
  const [ativo, setAtivo] = useState(atual?.ativo ?? false);
  const [eventos, setEventos] = useState<string[]>(atual?.eventos ?? ["documento.pronto"]);
  const [erro, setErro] = useState("");
  const grupos = gruposDeEventos(atual?.eventos ?? []);
  // Reidrata quando abre outro webhook.
  const chave = atual?.id ?? (alvo === "nova" ? "nova" : "");
  const [visto, setVisto] = useState(chave);
  if (chave !== visto) {
    setVisto(chave);
    setUrl(atual?.url ?? "");
    setAtivo(atual?.ativo ?? false);
    setEventos(atual?.eventos ?? ["documento.pronto", "documento.falhou", "conversa.resposta"]);
    setErro("");
  }
  return (
    <Dialog open={alvo !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{atual ? "Editar webhook" : "Novo webhook"}</DialogTitle>
          <DialogDescription>
            O sistema recebe um aviso assinado quando o evento acontece. O conteúdo do documento não
            vai no aviso.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.startsWith("https://")) return setErro("A URL precisa começar com https://.");
            if (eventos.length === 0) return setErro("Marque ao menos um evento.");
            setErro("");
            onSalvar({ url: url.trim(), eventos, ativo });
          }}
        >
          <label className="block text-sm" htmlFor="wh-url">
            URL
            <Input
              id="wh-url"
              className="mt-1"
              value={url}
              placeholder="https://sistema.exemplo.com.br/luxtia"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2 text-sm">
            <Switch id="wh-ativo" checked={ativo} onCheckedChange={setAtivo} />
            <label htmlFor="wh-ativo">Ativo</label>
          </div>
          {grupos.map((g) => (
            <fieldset key={g.nome} className="space-y-2">
              <legend className="text-sm font-medium text-ink-900">{g.nome}</legend>
              {g.eventos.map((ev) => {
                const id = `ev-${ev.id}`;
                const marcado = eventos.includes(ev.id);
                return (
                  <label key={ev.id} htmlFor={id} className="flex gap-2 text-sm">
                    <Checkbox
                      id={id}
                      checked={marcado}
                      onCheckedChange={(v) =>
                        setEventos((lista) =>
                          v ? [...lista, ev.id] : lista.filter((x) => x !== ev.id),
                        )
                      }
                    />
                    <span>
                      {ev.rotulo}
                      <span className="block text-xs text-ink-500">{ev.ajuda}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
