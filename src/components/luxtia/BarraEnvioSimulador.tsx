/** Campo de mensagem do simulador, com anexar / lote / FTP quando a capacidade está ligada. */
import { useRef } from "react";
import { FolderUp, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACEITA_ARQUIVO } from "@/lib/gateway/documentos";
import { ACEITA_ARQUIVO_LOTE } from "@/lib/gateway/lotes";

export type ProgressoEnvioLote = {
  chave: string;
  nome: string;
  estado: "aguardando" | "enviando" | "ok" | "erro";
  progresso: number;
  mensagem?: string;
};

export function BarraEnvioSimulador({
  texto,
  onTexto,
  bloqueado,
  enviando,
  podeAnexar,
  podeLote,
  arquivo,
  aviso,
  enviosLote,
  onArquivo,
  onTirarArquivo,
  onLote,
  onEnviar,
}: {
  texto: string;
  onTexto: (valor: string) => void;
  bloqueado: boolean;
  enviando: boolean;
  podeAnexar: boolean;
  /** Gestor+: envio em lote (PDF/XML/ZIP). */
  podeLote: boolean;
  arquivo: string | null;
  aviso: string | null;
  enviosLote: ProgressoEnvioLote[];
  onArquivo: (arquivo: File) => void;
  onTirarArquivo: () => void;
  onLote: (arquivos: File[]) => void;
  onEnviar: () => void;
}) {
  const inputAnexo = useRef<HTMLInputElement>(null);
  const inputLote = useRef<HTMLInputElement>(null);
  const menuAnexos = podeAnexar || podeLote;

  return (
    <form
      className="shrink-0 border-t border-base-200 bg-card px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar();
      }}
    >
      <div className="mx-auto w-full max-w-3xl">
        {enviosLote.length > 0 ? (
          <ul className="mb-2 max-h-36 space-y-1.5 overflow-y-auto" aria-label="Envio em lote">
            {enviosLote.map((e) => (
              <li key={e.chave} className="rounded-md border border-base-200 px-2 py-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-ink-800">{e.nome}</span>
                  <span className="shrink-0 text-ink-500">
                    {e.estado === "aguardando"
                      ? "Aguardando"
                      : e.estado === "enviando"
                        ? "Enviando…"
                        : e.estado === "ok"
                          ? "Enviado"
                          : e.mensagem || "Erro"}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded bg-base-100">
                  <div
                    className={`h-full transition-all ${
                      e.estado === "erro" ? "bg-destructive" : "bg-ink-800"
                    }`}
                    style={{ width: `${e.progresso}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
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
          {menuAnexos ? (
            <>
              <input
                ref={inputAnexo}
                type="file"
                accept={ACEITA_ARQUIVO}
                className="sr-only"
                aria-label="Arquivo da conversa"
                onChange={(e) => {
                  const escolhido = e.target.files?.[0];
                  e.target.value = "";
                  if (escolhido) onArquivo(escolhido);
                }}
              />
              <input
                ref={inputLote}
                type="file"
                accept={ACEITA_ARQUIVO_LOTE}
                multiple
                className="sr-only"
                aria-label="Arquivos do lote"
                onChange={(e) => {
                  const lista = e.target.files ? Array.from(e.target.files) : [];
                  e.target.value = "";
                  if (lista.length) onLote(lista);
                }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="Enviar arquivo"
                    disabled={bloqueado || enviando}
                  >
                    <Paperclip className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {podeAnexar ? (
                    <DropdownMenuItem
                      onSelect={() => inputAnexo.current?.click()}
                      disabled={bloqueado || enviando}
                    >
                      <Paperclip className="size-4" aria-hidden />
                      Anexar na conversa
                    </DropdownMenuItem>
                  ) : null}
                  {podeLote ? (
                    <DropdownMenuItem
                      onSelect={() => inputLote.current?.click()}
                      disabled={bloqueado || enviando}
                    >
                      <FolderUp className="size-4" aria-hidden />
                      Enviar em lote
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled title="Pasta SFTP do cliente: bloco após o LOTE1-b">
                    <FolderUp className="size-4 opacity-50" aria-hidden />
                    <span className="flex flex-col gap-0.5">
                      <span>Pasta FTP</span>
                      <span className="text-xs font-normal text-ink-500">Em breve</span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                  ? "Mensagem opcional. Enter envia."
                  : "Escreva como cliente. Enter envia, Shift+Enter quebra a linha."
            }
            className="max-h-40 min-h-9 resize-none bg-base-50 [field-sizing:content]"
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
      </div>
    </form>
  );
}
