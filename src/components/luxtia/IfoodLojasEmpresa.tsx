/** IFOOD1-a: empresa (gestor+) — lojas ligadas e conferir conexão. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { conferirLojaIfood, listarLojasIfoodEmpresa } from "@/lib/gateway-ifood.functions";
import {
  rotuloSituacaoIfood,
  TEXTO_SEM_LOJA_EMPRESA,
  type ListaLojasEmpresaIfood,
  type LojaEmpresaIfood,
} from "@/lib/ifood-lojas";
import { dataHora, type ContextoGateway } from "./Gateway";
import { Button } from "@/components/ui/button";

export function IfoodLojasEmpresa({ ctx }: { ctx: ContextoGateway }) {
  const cache = useQueryClient();
  const listar = useServerFn(listarLojasIfoodEmpresa);
  const conferir = useServerFn(conferirLojaIfood);

  const q = useQuery({
    queryKey: ["ifood", ctx.empresa ?? "vinculada", "lojas"],
    queryFn: async () => {
      const r = await listar({ data: { empresa: ctx.empresa } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as ListaLojasEmpresaIfood;
    },
  });

  const mut = useMutation({
    mutationFn: async (merchant_id: string) => {
      const r = await conferir({ data: { empresa: ctx.empresa, merchant_id } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as LojaEmpresaIfood;
    },
    onSuccess: (loja) => {
      toast.success(
        loja.situacao === "conectada"
          ? "Conexão ok: loja conectada."
          : `Situação: ${rotuloSituacaoIfood(loja.situacao).toLowerCase()}.`,
      );
      void cache.invalidateQueries({ queryKey: ["ifood", ctx.empresa ?? "vinculada", "lojas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = q.data?.itens ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
        <p className="text-sm text-ink-500">
          Lojas do iFood ligadas a esta empresa. A Ticway faz a ligação depois que a loja autoriza o
          aplicativo.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={q.isFetching}
          onClick={() => void q.refetch()}
        >
          <RefreshCw className={`size-3.5 ${q.isFetching ? "animate-spin" : ""}`} aria-hidden />
          Atualizar
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-base-100 p-3">
        {q.isError ? (
          <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">
            {q.error.message}
          </p>
        ) : q.isLoading ? (
          <p className="text-sm text-ink-500">Carregando…</p>
        ) : itens.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-lg border border-base-200 bg-card p-6 text-center">
            <h2 className="text-base font-semibold text-ink-900">Nenhuma loja ligada</h2>
            <p className="mt-2 text-sm text-ink-500">{TEXTO_SEM_LOJA_EMPRESA}</p>
            {q.data && !q.data.configurado ? (
              <p className="mt-3 text-xs text-ink-500">
                A integração ainda não está configurada no gateway (credenciais do aplicativo).
              </p>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-base-200 bg-card">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-base-200 bg-base-50 text-xs text-ink-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Unidade</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                  <th className="px-3 py-2 font-medium">Conferida em</th>
                  <th className="px-3 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((l) => (
                  <tr key={l.merchant_id} className="border-b border-base-100 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium text-ink-900">{l.nome?.trim() || "—"}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-ink-500">
                        {l.merchant_id}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-700">{l.unidade?.trim() || "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          l.situacao === "conectada"
                            ? "font-medium text-success"
                            : l.situacao === "sem_permissao"
                              ? "font-medium text-destructive"
                              : "text-ink-500"
                        }
                      >
                        {rotuloSituacaoIfood(l.situacao)}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-500">
                      {dataHora(l.conferida_em)}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={mut.isPending}
                        onClick={() => mut.mutate(l.merchant_id)}
                      >
                        <ShieldCheck className="size-3.5" aria-hidden />
                        Conferir conexão
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
