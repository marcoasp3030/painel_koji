/** Etiquetas da conversa. Quem atende aplica; criar, alterar e apagar fica a partir de supervisor. */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { peloMenos } from "@/lib/acesso/papeis";
import {
  aplicarEtiquetas,
  gravarEtiqueta,
  removerEtiqueta,
} from "@/lib/gateway-conversas.functions";
import { CORES_ETIQUETA, type CorEtiqueta, type Etiqueta } from "@/lib/gateway/conversas";
import type { ContextoGateway } from "./Gateway";

export const TOM_ETIQUETA: Record<CorEtiqueta, string> = {
  roxo: "bg-purple-100 text-purple-800",
  dourado: "bg-gold-300/40 text-gold-700",
  verde: "bg-success-soft text-success",
  vermelho: "bg-destructive/10 text-destructive",
  cinza: "bg-base-100 text-ink-700",
};
export const PONTO_ETIQUETA: Record<CorEtiqueta, string> = {
  roxo: "bg-purple-700",
  dourado: "bg-gold-500",
  verde: "bg-success",
  vermelho: "bg-destructive",
  cinza: "bg-ink-300",
};

export function EtiquetasDaConversa({
  ctx,
  conversa,
  aplicadas,
  todas,
}: {
  ctx: ContextoGateway;
  conversa: string;
  aplicadas: Etiqueta[];
  todas: Etiqueta[];
}) {
  const aplicar = useServerFn(aplicarEtiquetas);
  const cache = useQueryClient();
  const [gerindo, setGerindo] = useState(false);
  const podeGerir = peloMenos(ctx.papel, "supervisor");
  const ids = aplicadas.map((e) => e.id);
  const trocar = useMutation({
    mutationFn: (novos: number[]) =>
      aplicar({ data: { empresa: ctx.empresa, conversa, ids: novos } }),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] }),
    onError: (e: Error) => toast.error(e.message),
    retry: false,
  });
  function alternar(id: number) {
    trocar.mutate(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }
  return (
    <section aria-label="Etiquetas" className="space-y-1.5 border-b border-base-200 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-500">
          Etiquetas
        </h3>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="-mr-2 h-7 px-2 text-xs text-ink-500">
              <Plus className="size-3" aria-hidden />
              Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1">
            {todas.length ? (
              <ul className="max-h-60 overflow-y-auto">
                {todas.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={trocar.isPending}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-purple-50 disabled:opacity-60"
                      onClick={() => alternar(e.id)}
                    >
                      <span className={`size-2 shrink-0 rounded-full ${PONTO_ETIQUETA[e.cor]}`} />
                      <span className="min-w-0 flex-1 truncate">{e.nome}</span>
                      {ids.includes(e.id) ? (
                        <Check className="size-3.5" aria-label="Aplicada" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-1.5 text-xs text-ink-500">Nenhuma etiqueta cadastrada ainda.</p>
            )}
            {podeGerir ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 w-full justify-start px-2 text-xs"
                onClick={() => setGerindo(true)}
              >
                <Tags className="size-3" aria-hidden />
                Gerenciar etiquetas
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
      {aplicadas.length ? (
        <ul className="flex flex-wrap gap-1">
          {aplicadas.map((e) => (
            <li
              key={e.id}
              className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TOM_ETIQUETA[e.cor]}`}
            >
              <span className="min-w-0 truncate">{e.nome}</span>
              <button
                type="button"
                aria-label={`Remover etiqueta ${e.nome}`}
                disabled={trocar.isPending}
                onClick={() => alternar(e.id)}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-500">Nenhuma etiqueta.</p>
      )}
      {podeGerir ? (
        <GerenciarEtiquetas
          ctx={ctx}
          todas={todas}
          aberto={gerindo}
          fechar={() => setGerindo(false)}
        />
      ) : null}
    </section>
  );
}

function GerenciarEtiquetas({
  ctx,
  todas,
  aberto,
  fechar,
}: {
  ctx: ContextoGateway;
  todas: Etiqueta[];
  aberto: boolean;
  fechar: () => void;
}) {
  const gravar = useServerFn(gravarEtiqueta);
  const remover = useServerFn(removerEtiqueta);
  const cache = useQueryClient();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<CorEtiqueta>("roxo");
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState<number | null>(null);
  const recarregar = () => {
    void cache.invalidateQueries({ queryKey: ["conversas-etiquetas", ctx.empresa] });
    void cache.invalidateQueries({ queryKey: ["conversas", ctx.empresa] });
  };
  const criar = useMutation({
    mutationFn: () => gravar({ data: { empresa: ctx.empresa, nome: nome.trim(), cor } }),
    onSuccess: () => {
      setNome("");
      setErro(null);
      recarregar();
    },
    onError: (e: Error) => setErro(e.message),
    retry: false,
  });
  const apagar = useMutation({
    mutationFn: (id: number) => remover({ data: { empresa: ctx.empresa, id } }),
    onSuccess: () => {
      setApagando(null);
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
    retry: false,
  });
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="flex max-h-[85dvh] max-w-md flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Etiquetas da empresa</DialogTitle>
          <DialogDescription>
            Valem para toda a equipe. Apagar uma etiqueta a retira de todas as conversas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (nome.trim()) criar.mutate();
          }}
        >
          <Input
            value={nome}
            maxLength={30}
            className="h-9"
            aria-label="Nome da etiqueta"
            placeholder="Ex.: Reclamação"
            onChange={(e) => setNome(e.target.value)}
          />
          <select
            aria-label="Cor da etiqueta"
            className="h-9 rounded-md border bg-card px-2 text-sm capitalize"
            value={cor}
            onChange={(e) => setCor(e.target.value as CorEtiqueta)}
          >
            {CORES_ETIQUETA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-9 shrink-0" disabled={criar.isPending}>
            Criar
          </Button>
        </form>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <ul className="min-h-16 flex-1 divide-y divide-base-200 overflow-y-auto rounded-md border border-base-200">
          {todas.length ? (
            todas.map((e) => (
              <li key={e.id} className="flex items-center gap-2 px-3 py-1.5">
                <span
                  className={`min-w-0 truncate rounded-full px-2 py-0.5 text-xs font-medium ${TOM_ETIQUETA[e.cor]}`}
                >
                  {e.nome}
                </span>
                <span className="flex-1" />
                {apagando === e.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      disabled={apagar.isPending}
                      onClick={() => apagar.mutate(e.id)}
                    >
                      Apagar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setApagando(null)}
                    >
                      Manter
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    aria-label={`Apagar etiqueta ${e.nome}`}
                    onClick={() => setApagando(e.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                )}
              </li>
            ))
          ) : (
            <li className="p-3 text-sm text-ink-500">Nenhuma etiqueta cadastrada ainda.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
