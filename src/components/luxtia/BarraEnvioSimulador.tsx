/** Campo de mensagem do simulador, com o clipe de documento quando a capacidade está ligada. */
import { useRef } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACEITA_ARQUIVO } from "@/lib/gateway/documentos";

export function BarraEnvioSimulador({
  texto,
  onTexto,
  bloqueado,
  enviando,
  podeAnexar,
  arquivo,
  aviso,
  onArquivo,
  onTirarArquivo,
  onEnviar,
}: {
  texto: string;
  onTexto: (valor: string) => void;
  bloqueado: boolean;
  enviando: boolean;
  podeAnexar: boolean;
  arquivo: string | null;
  aviso: string | null;
  onArquivo: (arquivo: File) => void;
  onTirarArquivo: () => void;
  onEnviar: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="border-t border-base-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar();
      }}
    >
      {arquivo ? (
        <p className="mb-2 flex items-center gap-2 text-sm text-ink-700">
          <Paperclip className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{arquivo}</span>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 text-xs text-ink-500 underline-offset-2 hover:underline"
            onClick={onTirarArquivo}
          >
            <X className="size-3" aria-hidden /> Tirar
          </button>
        </p>
      ) : null}
      {aviso ? (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {aviso}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        {podeAnexar ? (
          <>
            <input
              ref={input}
              type="file"
              accept={ACEITA_ARQUIVO}
              className="sr-only"
              aria-label="Arquivo"
              onChange={(e) => {
                const escolhido = e.target.files?.[0];
                e.target.value = "";
                if (escolhido) onArquivo(escolhido);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label="Anexar documento"
              disabled={bloqueado || enviando}
              onClick={() => input.current?.click()}
            >
              <Paperclip className="size-4" aria-hidden />
            </Button>
          </>
        ) : null}
        <Label htmlFor="si-texto" className="sr-only">
          Mensagem
        </Label>
        <Textarea
          id="si-texto"
          rows={1}
          value={texto}
          disabled={bloqueado}
          placeholder={
            bloqueado
              ? ""
              : arquivo
                ? "Mensagem opcional… (Enter envia, Shift+Enter quebra linha)"
                : "Escreva como cliente… (Enter envia, Shift+Enter quebra linha)"
          }
          className="max-h-40 min-h-10 resize-none bg-base-50"
          onChange={(e) => onTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onEnviar();
            }
          }}
        />
        <Button type="submit" disabled={bloqueado || enviando || (!texto.trim() && !arquivo)}>
          {enviando ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          <span className="sr-only sm:not-sr-only">Enviar</span>
        </Button>
      </div>
    </form>
  );
}
