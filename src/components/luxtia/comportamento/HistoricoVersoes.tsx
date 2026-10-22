import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ROTULO_ORIGEM_VERSAO,
  rotuloCaminho,
  textoValor,
  type Alteracao,
  type DetalheVersao,
  type ResumoVersao,
  type Visao,
} from "@/lib/gateway/atendimento";
import { dataHora, Etiqueta } from "../Gateway";
import { Cartao } from "../Superficie";
import type { Chamar } from "./ComportamentoAgente";

export function HistoricoVersoes({
  chave,
  chamar,
  visao,
  restaurar,
}: {
  chave: unknown[];
  chamar: Chamar;
  visao: Visao;
  restaurar: (versao: number, nota: string) => Promise<boolean>;
}) {
  const [aberta, setAberta] = useState<number | null>(null);
  const lista = useInfiniteQuery({
    queryKey: [...chave, "versoes"],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) =>
      (await chamar<{ itens: ResumoVersao[]; proximo_cursor: number | null }>({
        acao: "versoes",
        cursor: pageParam,
      }))!,
    getNextPageParam: (p) => p.proximo_cursor ?? undefined,
  });
  const itens = lista.data?.pages.flatMap((p) => p.itens) ?? [];
  if (lista.isPending) return <p role="status">Carregando versões…</p>;
  if (lista.isError)
    return (
      <p role="alert" className="text-destructive">
        {lista.error.message}{" "}
        <button className="underline" onClick={() => void lista.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  return (
    <div className="space-y-3">
      {!itens.length ? (
        <Cartao className="p-6 text-sm text-ink-500">
          Nenhuma versão publicada ainda. O agente usa os padrões (versão {visao.perfil_versao}).
        </Cartao>
      ) : (
        <Cartao className="divide-y divide-base-200 overflow-hidden">
          {itens.map((v) => (
            <button
              key={v.versao}
              type="button"
              className="block w-full p-4 text-left transition hover:bg-purple-50/60"
              onClick={() => setAberta(v.versao)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-purple-800">v{v.versao}</strong>
                {v.versao === visao.versao_publicada ? (
                  <Etiqueta tom="sucesso">Em uso</Etiqueta>
                ) : null}
                <Etiqueta>{ROTULO_ORIGEM_VERSAO[v.origem] ?? v.origem}</Etiqueta>
                {v.restaurada_de ? (
                  <Etiqueta tom="roxo">restaurada da v{v.restaurada_de}</Etiqueta>
                ) : null}
                <span className="ml-auto text-xs text-ink-500">
                  {dataHora(v.publicado_em)} · {v.publicado_por}
                </span>
              </div>
              {v.nota ? <p className="mt-1 text-sm text-ink-700">{v.nota}</p> : null}
              {v.campos_alterados.length ? (
                <p className="mt-1.5 flex flex-wrap gap-1">
                  {v.campos_alterados.map((c) => (
                    <span
                      key={c}
                      className="rounded bg-base-100 px-1.5 py-0.5 text-[11px] text-ink-500"
                    >
                      {rotuloCaminho(c)}
                    </span>
                  ))}
                </p>
              ) : null}
            </button>
          ))}
        </Cartao>
      )}
      {lista.hasNextPage ? (
        <Button
          variant="ghost"
          className="w-full"
          disabled={lista.isFetchingNextPage}
          onClick={() => void lista.fetchNextPage()}
        >
          Carregar versões anteriores
        </Button>
      ) : null}
      <DetalheDaVersao
        chave={chave}
        chamar={chamar}
        versao={aberta}
        visao={visao}
        fechar={() => setAberta(null)}
        restaurar={restaurar}
      />
    </div>
  );
}

function DetalheDaVersao({
  chave,
  chamar,
  versao,
  visao,
  fechar,
  restaurar,
}: {
  chave: unknown[];
  chamar: Chamar;
  versao: number | null;
  visao: Visao;
  fechar: () => void;
  restaurar: (versao: number, nota: string) => Promise<boolean>;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const q = useQuery({
    queryKey: [...chave, "versao", versao],
    enabled: versao !== null,
    queryFn: async () => (await chamar<DetalheVersao>({ acao: "versao", versao: versao! }))!,
  });
  const v = q.data;
  const emUso = versao === visao.versao_publicada;
  return (
    <Sheet open={versao !== null} onOpenChange={(a) => !a && !ocupado && fechar()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-base-200 px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl text-purple-800">
            Versão v{versao}
          </SheetTitle>
          <SheetDescription>
            {v
              ? `${dataHora(v.publicado_em)} · ${v.publicado_por}${v.nota ? ` · ${v.nota}` : ""}`
              : "Carregando…"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {q.isError ? (
            <p role="alert" className="text-destructive">
              {q.error.message}
            </p>
          ) : null}
          {v ? (
            <>
              <section>
                <h3 className="mb-2 font-medium text-ink-700">O que mudou nesta versão</h3>
                <TabelaAlteracoes alteracoes={v.alteracoes} />
              </section>
              {visao.pode_editar && !emUso ? (
                <Button variant="outline" onClick={() => setConfirmar(true)}>
                  Restaurar esta versão
                </Button>
              ) : null}
              {emUso ? <p className="text-xs text-ink-500">Esta é a versão em uso.</p> : null}
            </>
          ) : null}
        </div>
        <AlertDialog open={confirmar} onOpenChange={(a) => !ocupado && setConfirmar(a)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar a v{versao}?</AlertDialogTitle>
              <AlertDialogDescription>
                Cria uma versão nova (v{visao.versao_publicada + 1}) com o conteúdo da v{versao}.
                Nada do histórico é apagado. Vale para o agente em até 30 segundos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {visao.rascunho ? (
              <p className="rounded-md bg-gold-300/20 p-2 text-sm text-gold-700">
                Existe um rascunho de {visao.rascunho.atualizado_por} baseado na v
                {visao.rascunho.baseado_em}. Ele continua salvo, mas vai ficar baseado numa versão
                antiga.
              </p>
            ) : null}
            <label className="text-sm">
              Nota (opcional)
              <Input
                value={nota}
                maxLength={300}
                placeholder={`Restaurada da versão ${versao}`}
                onChange={(e) => setNota(e.target.value)}
              />
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={ocupado}
                onClick={async (e) => {
                  e.preventDefault();
                  setOcupado(true);
                  const ok = await restaurar(versao!, nota).finally(() => setOcupado(false));
                  if (ok) {
                    setConfirmar(false);
                    setNota("");
                    fechar();
                  }
                }}
              >
                {ocupado ? "Restaurando…" : "Restaurar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

/** Antes e depois de cada campo. */
export function TabelaAlteracoes({ alteracoes }: { alteracoes: Alteracao[] }) {
  if (!alteracoes.length) return <p className="text-ink-500">Sem alterações registradas.</p>;
  return (
    <ul className="space-y-2">
      {alteracoes.map((a) => (
        <li key={a.campo} className="rounded-lg border border-base-200 p-2.5">
          <p className="text-xs font-medium text-ink-700">{rotuloCaminho(a.campo)}</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <p className="whitespace-pre-wrap break-words rounded bg-destructive/5 p-1.5 text-xs text-ink-700">
              <span className="block text-[10px] uppercase text-ink-500">Antes</span>
              {a.antes === null ? "Padrão (herdado)" : textoValor(a.antes)}
            </p>
            <p className="whitespace-pre-wrap break-words rounded bg-success-soft p-1.5 text-xs text-ink-700">
              <span className="block text-[10px] uppercase text-ink-500">Depois</span>
              {a.depois === null ? "Padrão (herdado)" : textoValor(a.depois)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
