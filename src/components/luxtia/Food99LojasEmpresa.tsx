/** 99FOOD1-a: empresa (gestor+) — conectar / conferir / desconectar loja 99Food por unidade. */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import {
  conectarLojaFood99,
  conferirLojaFood99,
  desconectarLojaFood99,
  listarLojasFood99,
} from "@/lib/gateway-food99.functions";
import { gestao } from "@/lib/gateway-gestao.functions";
import {
  TEXTO_PLATAFORMA_NAO_CONFIGUROU,
  nomeParaConfirmacaoDesconectar,
  rotuloSituacaoFood99,
  type ListaLojasFood99,
  type LojaFood99,
  type ResultadoConectarFood99,
} from "@/lib/food99";
import type { Unidade } from "@/lib/gateway/gestao";
import { dataHora, type ContextoGateway } from "./Gateway";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function Food99LojasEmpresa({ ctx }: { ctx: ContextoGateway }) {
  const cache = useQueryClient();
  const listar = useServerFn(listarLojasFood99);
  const conectar = useServerFn(conectarLojaFood99);
  const conferir = useServerFn(conferirLojaFood99);
  const desconectar = useServerFn(desconectarLojaFood99);
  const gestaoFn = useServerFn(gestao);

  const [posConectar, setPosConectar] = useState<{
    loja: LojaFood99;
    url: string;
    aviso: string;
  } | null>(null);
  const [desconectando, setDesconectando] = useState<LojaFood99 | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [oferecerSoGateway, setOferecerSoGateway] = useState(false);

  const q = useQuery({
    queryKey: ["99food", ctx.empresa ?? "vinculada", "lojas"],
    queryFn: async () => {
      const r = await listar({ data: { empresa: ctx.empresa } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as ListaLojasFood99;
    },
  });

  const unidades = useQuery({
    queryKey: ["gestao", ctx.empresa, "unidades", "99food"],
    queryFn: async () => {
      const r = await gestaoFn({ data: { acao: "listar", empresa: ctx.empresa } });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return (r.dados as { itens: Unidade[] }).itens;
    },
  });

  const porUnidade = useMemo(() => {
    const map = new Map<string, LojaFood99>();
    for (const l of q.data?.itens ?? []) map.set(l.unidade, l);
    return map;
  }, [q.data]);

  const mutConectar = useMutation({
    mutationFn: async (codigo: string) => {
      const r = await conectar({ data: { empresa: ctx.empresa, unidade: codigo } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as ResultadoConectarFood99;
    },
    onSuccess: (r) => {
      void cache.invalidateQueries({ queryKey: ["99food", ctx.empresa ?? "vinculada", "lojas"] });
      window.open(r.url_autorizacao, "_blank", "noopener,noreferrer");
      setPosConectar({ loja: r.loja, url: r.url_autorizacao, aviso: r.aviso });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutConferir = useMutation({
    mutationFn: async (lojaId: string) => {
      const r = await conferir({ data: { empresa: ctx.empresa, loja: lojaId } });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as LojaFood99;
    },
    onSuccess: (loja) => {
      toast.success(
        loja.situacao === "conectada"
          ? "Loja conectada."
          : `Situação: ${rotuloSituacaoFood99(loja.situacao)}.`,
      );
      setPosConectar(null);
      void cache.invalidateQueries({ queryKey: ["99food", ctx.empresa ?? "vinculada", "lojas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutDesconectar = useMutation({
    mutationFn: async (opts: { so_no_gateway?: boolean }) => {
      if (!desconectando) throw new Error("Escolha a loja.");
      const r = await desconectar({
        data: {
          empresa: ctx.empresa,
          loja: desconectando.id,
          confirmacao: confirmacao.trim(),
          so_no_gateway: opts.so_no_gateway,
        },
      });
      if (r && "ok" in r && r.ok === false) {
        const err = Object.assign(new Error(r.mensagem), { motivo: r.motivo });
        throw err;
      }
      return r as { ok: true; desvinculada_na_99: boolean };
    },
    onSuccess: () => {
      toast.success("Loja desconectada.");
      setDesconectando(null);
      setConfirmacao("");
      setOferecerSoGateway(false);
      void cache.invalidateQueries({ queryKey: ["99food", ctx.empresa ?? "vinculada", "lojas"] });
    },
    onError: (e: Error & { motivo?: string }) => {
      if (e.motivo === "nao_desvinculou") {
        setOferecerSoGateway(true);
        toast.error(e.message);
        return;
      }
      toast.error(e.message);
    },
  });

  function pedirConectar(codigo: string) {
    const aviso =
      q.data?.aviso_conexao?.trim() ||
      "Uma loja da 99Food só pode estar ligada a um sistema por vez.";
    if (!window.confirm(aviso)) return;
    mutConectar.mutate(codigo);
  }

  const listaUnidades = (unidades.data ?? []).filter((u) => u.codigo);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
        <p className="text-sm text-ink-500">
          Conecte cada unidade à 99Food. O gestor autoriza no portal e depois confere aqui.
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
        ) : q.isLoading || unidades.isLoading ? (
          <p className="text-sm text-ink-500">Carregando…</p>
        ) : q.data && !q.data.configurado ? (
          <div className="mx-auto max-w-lg rounded-lg border border-base-200 bg-card p-6 text-center">
            <p className="text-sm text-ink-700">{TEXTO_PLATAFORMA_NAO_CONFIGUROU}</p>
          </div>
        ) : listaUnidades.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhuma unidade com código cadastrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-base-200 bg-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-base-200 bg-base-50 text-xs text-ink-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Unidade</th>
                  <th className="px-3 py-2 font-medium">Loja 99Food</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                  <th className="px-3 py-2 font-medium">Conferida em</th>
                  <th className="px-3 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaUnidades.map((u) => {
                  const codigo = u.codigo!;
                  const loja = porUnidade.get(codigo);
                  return (
                    <tr key={u.id} className="border-b border-base-100 last:border-0">
                      <td className="px-3 py-2">
                        <span className="font-medium text-ink-900">{u.nome}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-ink-500">
                          {codigo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink-700">
                        {loja ? loja.nome?.trim() || "—" : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {loja ? (
                          <span
                            className={
                              loja.situacao === "conectada"
                                ? "font-medium text-success"
                                : loja.situacao === "sem_permissao"
                                  ? "font-medium text-destructive"
                                  : "text-ink-500"
                            }
                          >
                            {rotuloSituacaoFood99(loja.situacao)}
                            {loja.erro_codigo != null && loja.erro_codigo !== "" ? (
                              <span className="ml-1 font-mono text-[11px] text-ink-500">
                                ({String(loja.erro_codigo)})
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-ink-500">Sem loja</span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-500">
                        {loja ? dataHora(loja.conferida_em) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {!loja ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={mutConectar.isPending}
                              onClick={() => pedirConectar(codigo)}
                            >
                              Conectar 99Food
                            </Button>
                          ) : (
                            <>
                              {loja.situacao !== "conectada" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={mutConectar.isPending}
                                  onClick={() => pedirConectar(codigo)}
                                >
                                  <ExternalLink className="size-3.5" aria-hidden />
                                  Reabrir autorização
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={mutConferir.isPending}
                                onClick={() => mutConferir.mutate(loja.id)}
                              >
                                <ShieldCheck className="size-3.5" aria-hidden />
                                Conferir
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={mutDesconectar.isPending}
                                onClick={() => {
                                  setOferecerSoGateway(false);
                                  setConfirmacao("");
                                  setDesconectando(loja);
                                }}
                              >
                                <Unplug className="size-3.5" aria-hidden />
                                Desconectar
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(posConectar)}
        onOpenChange={(a) => {
          if (!a) setPosConectar(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorize na 99Food</DialogTitle>
            <DialogDescription>
              {posConectar?.aviso ||
                "Depois de autorizar na 99Food, clique em Conferir."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-ink-700">
            Depois de autorizar na 99Food, clique em Conferir.
          </p>
          {posConectar?.url ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(posConectar.url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Abrir página de autorização de novo
            </Button>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPosConectar(null)}>
              Fechar
            </Button>
            <Button
              type="button"
              disabled={!posConectar || mutConferir.isPending}
              onClick={() => posConectar && mutConferir.mutate(posConectar.loja.id)}
            >
              Conferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(desconectando)}
        onOpenChange={(a) => {
          if (!a) {
            setDesconectando(null);
            setConfirmacao("");
            setOferecerSoGateway(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar 99Food?</AlertDialogTitle>
            <AlertDialogDescription>
              Digite o nome da loja
              {desconectando
                ? ` (${nomeParaConfirmacaoDesconectar(desconectando)})`
                : ""}{" "}
              ou o código da unidade para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Nome da loja ou código da unidade"
            aria-label="Confirmação para desconectar"
          />
          {oferecerSoGateway ? (
            <p className="text-sm text-amber-800">
              A 99Food não desvinculou. Você pode remover só no gateway (a loja continua autorizada
              lá).
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutDesconectar.isPending}>Cancelar</AlertDialogCancel>
            {oferecerSoGateway ? (
              <Button
                type="button"
                variant="destructive"
                disabled={mutDesconectar.isPending || !confirmacao.trim()}
                onClick={() => mutDesconectar.mutate({ so_no_gateway: true })}
              >
                Remover só no gateway
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                disabled={mutDesconectar.isPending || !confirmacao.trim()}
                onClick={() => mutDesconectar.mutate({})}
              >
                Desconectar
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
