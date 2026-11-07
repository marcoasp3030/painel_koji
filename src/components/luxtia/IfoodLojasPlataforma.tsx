/** IFOOD1-a: plataforma — lojas autorizadas no iFood, ligar e desligar. */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Link2Off, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listarEmpresasGateway } from "@/lib/gateway-empresas.functions";
import { gestao } from "@/lib/gateway-gestao.functions";
import {
  desligarLojaIfood,
  ligarLojaIfood,
  listarLojasAutorizadasIfood,
} from "@/lib/gateway-ifood.functions";
import type { Unidade } from "@/lib/gateway/gestao";
import {
  confirmacaoDesligarIfoodConfere,
  nomeParaConfirmacaoDesligar,
  textoLigadaA,
  TEXTO_CONFIRMACAO_DESLIGAR_IFOOD,
  type LojaAutorizadaIfood,
} from "@/lib/ifood-lojas";
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
import { IfoodCredenciais } from "./IfoodCredenciais";

export function IfoodLojasPlataforma() {
  const cache = useQueryClient();
  const listar = useServerFn(listarLojasAutorizadasIfood);
  const ligar = useServerFn(ligarLojaIfood);
  const desligar = useServerFn(desligarLojaIfood);
  const listarEmpresas = useServerFn(listarEmpresasGateway);
  const fnGestao = useServerFn(gestao);

  const [ligarEm, setLigarEm] = useState<LojaAutorizadaIfood | null>(null);
  const [empresaId, setEmpresaId] = useState("");
  const [unidade, setUnidade] = useState("");
  const [desligarEm, setDesligarEm] = useState<LojaAutorizadaIfood | null>(null);
  const [confirmacao, setConfirmacao] = useState("");

  const lojas = useQuery({
    queryKey: ["ifood", "lojas-autorizadas"],
    queryFn: async () => {
      const r = await listar();
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as { itens: LojaAutorizadaIfood[] };
    },
  });

  const empresas = useQuery({
    queryKey: ["gateway", "empresas"],
    queryFn: () => listarEmpresas({ data: {} }),
    staleTime: 60_000,
  });

  const nomesEmpresa = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of empresas.data?.itens ?? []) m.set(e.id, e.nome);
    return m;
  }, [empresas.data]);

  const unidades = useQuery({
    queryKey: ["gestao", empresaId, "unidades", "ifood-ligar"],
    enabled: Boolean(ligarEm && empresaId),
    queryFn: async () => {
      const r = await fnGestao({ data: { acao: "listar", empresa: empresaId } });
      if (!r.ok) throw new Error(r.erro.mensagem);
      return r.dados as { itens: Unidade[] };
    },
  });

  const mutLigar = useMutation({
    mutationFn: async () => {
      if (!ligarEm || !empresaId) throw new Error("Escolha a empresa.");
      const r = await ligar({
        data: {
          empresa: empresaId,
          merchant_id: ligarEm.merchant_id,
          unidade: unidade || null,
          ativo: true,
        },
      });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r;
    },
    onSuccess: () => {
      toast.success("Loja ligada à empresa.");
      setLigarEm(null);
      setEmpresaId("");
      setUnidade("");
      void cache.invalidateQueries({ queryKey: ["ifood", "lojas-autorizadas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutDesligar = useMutation({
    mutationFn: async () => {
      if (!desligarEm?.ligada_a) throw new Error("Loja livre.");
      const r = await desligar({
        data: {
          empresa: desligarEm.ligada_a.tenant_id,
          merchant_id: desligarEm.merchant_id,
          confirmacao: confirmacao.trim(),
        },
      });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r;
    },
    onSuccess: () => {
      toast.success("Loja desligada.");
      setDesligarEm(null);
      setConfirmacao("");
      void cache.invalidateQueries({ queryKey: ["ifood", "lojas-autorizadas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = lojas.data?.itens ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IfoodCredenciais />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
        <p className="text-sm text-ink-500">
          Lojas que autorizaram o aplicativo da Ticway no iFood. Só a plataforma liga cada uma a uma
          empresa.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={lojas.isFetching}
          onClick={() => void lojas.refetch()}
        >
          <RefreshCw className={`size-3.5 ${lojas.isFetching ? "animate-spin" : ""}`} aria-hidden />
          Atualizar
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-base-100 p-3">
        {lojas.isError ? (
          <p role="alert" className="rounded-lg border bg-card p-4 text-sm text-destructive">
            {lojas.error.message}
          </p>
        ) : lojas.isLoading ? (
          <p className="text-sm text-ink-500">Carregando…</p>
        ) : itens.length === 0 ? (
          <p className="rounded-lg border bg-card p-4 text-sm text-ink-500">
            Nenhuma loja autorizou o aplicativo ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-base-200 bg-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-base-200 bg-base-50 text-xs text-ink-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Razão social</th>
                  <th className="px-3 py-2 font-medium">merchant_id</th>
                  <th className="px-3 py-2 font-medium">Ligada a</th>
                  <th className="px-3 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((l) => (
                  <tr key={l.merchant_id} className="border-b border-base-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-ink-900">{l.nome?.trim() || "—"}</td>
                    <td className="px-3 py-2 text-ink-700">{l.razao_social?.trim() || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-500">{l.merchant_id}</td>
                    <td className="px-3 py-2 text-ink-700">
                      {textoLigadaA(
                        l.ligada_a,
                        l.ligada_a ? nomesEmpresa.get(l.ligada_a.tenant_id) : null,
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLigarEm(l);
                            setEmpresaId(l.ligada_a?.tenant_id ?? "");
                            setUnidade(l.ligada_a?.unidade ?? "");
                          }}
                        >
                          <Link2 className="size-3.5" aria-hidden />
                          {l.ligada_a ? "Alterar ligação" : "Ligar à empresa"}
                        </Button>
                        {l.ligada_a ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => {
                              setDesligarEm(l);
                              setConfirmacao("");
                            }}
                          >
                            <Link2Off className="size-3.5" aria-hidden />
                            Desligar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(ligarEm)}
        onOpenChange={(a) => {
          if (!a) {
            setLigarEm(null);
            setEmpresaId("");
            setUnidade("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligar à empresa</DialogTitle>
            <DialogDescription>
              {ligarEm?.nome?.trim() || ligarEm?.merchant_id} — a loja passa a aparecer só para esta
              empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">Empresa</span>
              <select
                value={empresaId}
                onChange={(e) => {
                  setEmpresaId(e.target.value);
                  setUnidade("");
                }}
                className="h-10 w-full rounded-lg border border-base-200 bg-card px-3 text-sm"
              >
                <option value="">Escolha a empresa</option>
                {(empresas.data?.itens ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome} ({e.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">
                Unidade (opcional)
              </span>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                disabled={!empresaId}
                className="h-10 w-full rounded-lg border border-base-200 bg-card px-3 text-sm disabled:opacity-50"
              >
                <option value="">Nenhuma</option>
                {(unidades.data?.itens ?? []).flatMap((u) =>
                  u.codigo ? (
                    <option key={u.id} value={u.codigo}>
                      {u.nome}
                    </option>
                  ) : (
                    []
                  ),
                )}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLigarEm(null);
                setEmpresaId("");
                setUnidade("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!empresaId || mutLigar.isPending}
              onClick={() => mutLigar.mutate()}
            >
              {mutLigar.isPending ? "Ligando…" : "Ligar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(desligarEm)}
        onOpenChange={(a) => {
          if (!a) {
            setDesligarEm(null);
            setConfirmacao("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desligar {desligarEm ? nomeParaConfirmacaoDesligar(desligarEm) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>{TEXTO_CONFIRMACAO_DESLIGAR_IFOOD}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder={desligarEm ? nomeParaConfirmacaoDesligar(desligarEm) : ""}
            autoComplete="off"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !desligarEm ||
                !confirmacaoDesligarIfoodConfere(confirmacao, desligarEm) ||
                mutDesligar.isPending
              }
              onClick={() => mutDesligar.mutate()}
            >
              {mutDesligar.isPending ? "Desligando…" : "Desligar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
