/** META1-a: tela WhatsApp oficial (Meta) — só plataforma; segredos nunca voltam. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { gravarCredenciaisMeta, lerCredenciaisMeta } from "@/lib/gateway-meta.functions";
import {
  TEXTO_AJUDA_META,
  gerarTokenVerificacaoMeta,
  textoStatusCredenciaisMeta,
  type CredenciaisMeta,
} from "@/lib/meta";
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

export function MetaCredenciais() {
  const cache = useQueryClient();
  const ler = useServerFn(lerCredenciaisMeta);
  const gravar = useServerFn(gravarCredenciaisMeta);
  const [aberto, setAberto] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  const q = useQuery({
    queryKey: ["meta", "credenciais"],
    queryFn: async () => {
      const r = await ler();
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as CredenciaisMeta;
    },
  });

  function limparCampos() {
    setAppId("");
    setAppSecret("");
    setVerifyToken("");
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
        data: {
          app_id: appId.trim(),
          app_secret: appSecret,
          verify_token: verifyToken,
        },
      });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as CredenciaisMeta;
    },
    onSuccess: () => {
      toast.success("Credenciais gravadas.");
      limparCampos();
      setAberto(false);
      void cache.invalidateQueries({ queryKey: ["meta", "credenciais"] });
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
          <p className="mt-2 text-sm text-ink-700">{textoStatusCredenciaisMeta(q.data)}</p>
        )}
        <p className="mt-2 text-xs text-ink-500">
          A chave secreta e o token de verificação nunca são mostrados de novo depois de salvos. A
          chave de plataforma do servidor do painel (`GATEWAY_PLATFORM_KEY`) precisa estar
          preenchida.
        </p>
        <Button type="button" size="sm" className="mt-3" onClick={() => setAberto(true)}>
          {q.data?.configurado ? "Trocar credenciais" : "Configurar"}
        </Button>
      </section>

      <section className="rounded-lg border border-base-200 bg-card p-4">
        <h2 className="text-sm font-semibold text-ink-900">Endereço do webhook</h2>
        <p className="mt-1 text-xs text-ink-500">{TEXTO_AJUDA_META}</p>
        {webhook ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md border border-base-200 bg-base-50 px-3 py-2 text-xs text-ink-800">
              {webhook}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copiar(webhook, "Endereço")}
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
            <DialogTitle>Credenciais do WhatsApp oficial</DialogTitle>
            <DialogDescription>
              O gateway confere o app na Meta antes de gravar. Chave e token não voltam depois de
              salvos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">ID do app</span>
              <Input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                inputMode="numeric"
                placeholder="Ex.: 123456789012345"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">
                Chave secreta do app
              </span>
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                placeholder="Chave secreta"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">
                Token de verificação
              </span>
              <div className="flex gap-2">
                <Input
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Mesmo token que você cola na Meta"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  title="Gerar token de 32 caracteres"
                  onClick={() => {
                    const t = gerarTokenVerificacaoMeta(32);
                    setVerifyToken(t);
                    toast.message("Token gerado — copie e cole o mesmo na Meta.", {
                      action: {
                        label: "Copiar",
                        onClick: () => copiar(t, "Token"),
                      },
                    });
                  }}
                >
                  <RefreshCw className="size-4" aria-hidden /> Gerar
                </Button>
              </div>
              {verifyToken ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto px-0 text-xs"
                  onClick={() => copiar(verifyToken, "Token")}
                >
                  <Copy className="size-3" aria-hidden /> Copiar token
                </Button>
              ) : null}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={fechar} disabled={mut.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                mut.isPending ||
                !/^[0-9]{5,30}$/.test(appId.trim()) ||
                !/^[A-Za-z0-9]{16,100}$/.test(appSecret) ||
                !/^[A-Za-z0-9_-]{16,200}$/.test(verifyToken)
              }
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
