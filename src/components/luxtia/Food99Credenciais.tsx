/** 99FOOD1-a: tela Integrações → 99Food — só plataforma; Secret nunca volta. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { gravarCredenciaisFood99, lerCredenciaisFood99 } from "@/lib/gateway-food99.functions";
import {
  TEXTO_AJUDA_FOOD99,
  textoStatusCredenciaisFood99,
  type CredenciaisFood99,
} from "@/lib/food99";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function Food99Credenciais() {
  const cache = useQueryClient();
  const ler = useServerFn(lerCredenciaisFood99);
  const gravar = useServerFn(gravarCredenciaisFood99);
  const [aberto, setAberto] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");

  const q = useQuery({
    queryKey: ["99food", "credenciais"],
    queryFn: async () => {
      const r = await ler();
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as CredenciaisFood99;
    },
  });

  function limparCampos() {
    setAppId("");
    setAppSecret("");
  }

  function fechar() {
    limparCampos();
    setAberto(false);
  }

  function copiar(texto: string, rotulo: string) {
    void navigator.clipboard.writeText(texto).then(
      () => toast.success(`${rotulo} copiado.`),
      () => toast.error("Não foi possível copiar."),
    );
  }

  const mut = useMutation({
    mutationFn: async () => {
      const r = await gravar({
        data: { app_id: appId.trim(), app_secret: appSecret },
      });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as CredenciaisFood99;
    },
    onSuccess: () => {
      toast.success("Credenciais gravadas.");
      limparCampos();
      setAberto(false);
      void cache.invalidateQueries({ queryKey: ["99food", "credenciais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const webhook = q.data?.webhook_url?.trim() ?? "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <section className="rounded-lg border border-base-200 bg-card p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
          <KeyRound className="size-4 shrink-0 text-ink-500" aria-hidden />
          Credenciais do aplicativo
        </h2>
        {q.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {q.error.message}
          </p>
        ) : q.isLoading || !q.data ? (
          <p className="mt-2 text-sm text-ink-500">Carregando…</p>
        ) : (
          <p className="mt-2 text-sm text-ink-700">{textoStatusCredenciaisFood99(q.data)}</p>
        )}
        <p className="mt-2 text-xs text-ink-500">
          O Secret nunca é mostrado de novo depois de salvo. A chave de plataforma do servidor do
          painel (`GATEWAY_PLATFORM_KEY`) precisa estar preenchida.
        </p>
        <Button type="button" size="sm" className="mt-3" onClick={() => setAberto(true)}>
          {q.data?.configurado ? "Trocar credenciais" : "Configurar"}
        </Button>
      </section>

      <section className="rounded-lg border border-base-200 bg-card p-4">
        <h2 className="text-sm font-semibold text-ink-900">
          Endereço do webhook (Callback Address)
        </h2>
        <p className="mt-1 text-xs text-ink-500">{TEXTO_AJUDA_FOOD99}</p>
        {webhook ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md border border-base-200 bg-base-50 px-3 py-2 text-xs text-ink-800">
              {webhook}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copiar(webhook, "Callback Address")}
            >
              <Copy className="size-4" aria-hidden /> Copiar
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-500">Disponível após carregar as credenciais.</p>
        )}
      </section>

      <Dialog
        open={aberto}
        onOpenChange={(a) => {
          if (!a) fechar();
          else setAberto(true);
        }}
      >
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Credenciais da 99Food</DialogTitle>
            <DialogDescription>
              O gateway confere o App ID na 99Food antes de gravar. O Secret não volta depois de
              salvo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">App ID</span>
              <Input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                inputMode="numeric"
                placeholder="Ex.: 1234567890"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">Secret</span>
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                placeholder="Secret do app"
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mut.isPending} onClick={fechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={mut.isPending || !appId.trim() || appSecret.length < 8}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "Gravando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
