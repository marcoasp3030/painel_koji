/** IFOOD1-a: bloco Credenciais do aplicativo (só plataforma; segredo nunca volta). */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { gravarCredenciaisIfood, lerCredenciaisIfood } from "@/lib/gateway-ifood.functions";
import {
  textoStatusCredenciaisIfood,
  type CredenciaisIfood,
} from "@/lib/ifood-lojas";
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

export function IfoodCredenciais() {
  const cache = useQueryClient();
  const ler = useServerFn(lerCredenciaisIfood);
  const gravar = useServerFn(gravarCredenciaisIfood);
  const [aberto, setAberto] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const q = useQuery({
    queryKey: ["ifood", "credenciais"],
    queryFn: async () => {
      const r = await ler();
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as CredenciaisIfood;
    },
  });

  function limparCampos() {
    setClientId("");
    setClientSecret("");
  }

  function fechar() {
    limparCampos();
    setAberto(false);
  }

  const mut = useMutation({
    mutationFn: async () => {
      const r = await gravar({
        data: { client_id: clientId.trim(), client_secret: clientSecret },
      });
      if (r && "ok" in r && r.ok === false) throw new Error(r.mensagem);
      return r as CredenciaisIfood;
    },
    onSuccess: () => {
      toast.success("Credenciais gravadas.");
      limparCampos();
      setAberto(false);
      void cache.invalidateQueries({ queryKey: ["ifood", "credenciais"] });
      void cache.invalidateQueries({ queryKey: ["ifood", "lojas-autorizadas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="shrink-0 border-b border-base-200 bg-card px-3 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <KeyRound className="size-4 shrink-0 text-ink-500" aria-hidden />
            Credenciais do aplicativo
          </h2>
          {q.isError ? (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {q.error.message}
            </p>
          ) : q.isLoading || !q.data ? (
            <p className="mt-1 text-sm text-ink-500">Carregando…</p>
          ) : (
            <p className="mt-1 text-sm text-ink-700">{textoStatusCredenciaisIfood(q.data)}</p>
          )}
          <p className="mt-1 text-xs text-ink-500">
            O Client Secret nunca é mostrado de novo depois de salvo. A chave de plataforma do
            servidor do painel (`GATEWAY_PLATFORM_KEY`) precisa estar preenchida.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setAberto(true)}>
          Trocar credenciais
        </Button>
      </div>

      <Dialog
        open={aberto}
        onOpenChange={(a) => {
          if (!a) fechar();
          else setAberto(true);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          // Campos começam vazios de propósito: o gateway nunca devolve o segredo.
        >
          <DialogHeader>
            <DialogTitle>Trocar credenciais do iFood</DialogTitle>
            <DialogDescription>
              O gateway testa Client ID e Client Secret no iFood antes de gravar. Se o iFood
              recusar, nada é salvo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">Client ID</span>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Client ID do aplicativo"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">Client Secret</span>
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                placeholder="Client Secret"
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={fechar} disabled={mut.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                mut.isPending || clientId.trim().length < 8 || clientSecret.length < 8
              }
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
