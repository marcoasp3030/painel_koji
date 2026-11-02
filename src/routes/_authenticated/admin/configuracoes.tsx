/** Configurações globais — só Super Admin (pai /admin já confere). */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/luxtia/AppShell";
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
import { Switch } from "@/components/ui/switch";
import { ADMIN_NAV } from "@/lib/nav";
import { definirMfaDesativado, lerConfigPlataforma } from "@/lib/plataforma-config.functions";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Luxtia" },
      {
        name: "description",
        content: "Ajustes globais da plataforma Luxtia (Super Admin).",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const cache = useQueryClient();
  const ler = useServerFn(lerConfigPlataforma);
  const gravar = useServerFn(definirMfaDesativado);
  const [confirmando, setConfirmando] = useState<"ligar" | "desligar" | null>(null);

  const q = useQuery({
    queryKey: ["config-plataforma"],
    queryFn: () => ler(),
  });

  const mut = useMutation({
    mutationFn: (desativado: boolean) => gravar({ data: { desativado } }),
    onSuccess: (r) => {
      void cache.invalidateQueries({ queryKey: ["config-plataforma"] });
      void cache.invalidateQueries({ queryKey: ["seguranca"] });
      setConfirmando(null);
      toast.success(
        r.mfa_desativado
          ? "Segunda etapa desligada em toda a plataforma."
          : "Segunda etapa ligada. As regras de obrigação voltam a valer.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desativado = Boolean(q.data?.mfa_desativado);
  const quando = q.data?.atualizado_em
    ? new Date(q.data.atualizado_em).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  const ligado = !desativado;

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin" telaCheia>
      <h1 className="sr-only">Configurações</h1>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card">
        <p className="shrink-0 border-b border-base-200 px-4 py-2 text-xs text-ink-500">
          Ajustes que valem para todos os clientes. Só o Super Admin altera.
        </p>

        {q.isSuccess && desativado ? (
          <p
            role="status"
            className="flex shrink-0 items-center gap-2 border-b border-gold-500/40 bg-gold-300/20 px-4 py-1.5 text-sm text-gold-700"
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            Segunda etapa desligada: nenhuma conta precisa do aplicativo autenticador para entrar.
          </p>
        ) : null}

        <section
          aria-label="Segurança"
          className="grid gap-x-6 gap-y-2 border-b border-base-200/70 px-4 py-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <div className="min-w-0">
            <label htmlFor="mfa-global" className="text-sm font-medium text-ink-900">
              Segunda etapa (MFA) na plataforma
            </label>
            <p className="mt-0.5 text-xs text-ink-500">
              Ligada, valem as regras de quem precisa confirmar pelo aplicativo autenticador.
              Desligada, ninguém é obrigado: login, menu e funções seguem em sessão simples. Os
              aplicativos já cadastrados não são apagados.
            </p>
          </div>
          <div className="min-w-0 text-sm">
            {q.isPending ? (
              <p className="text-ink-500">Carregando…</p>
            ) : q.isError ? (
              <p role="alert" className="text-destructive">
                {q.error.message}
              </p>
            ) : (
              <>
                <span className="flex items-center gap-2 text-ink-900">
                  <Switch
                    id="mfa-global"
                    checked={ligado}
                    disabled={mut.isPending}
                    onCheckedChange={(ligar) => setConfirmando(ligar ? "ligar" : "desligar")}
                  />
                  {ligado ? "Ligada" : "Desligada"}
                </span>
                {quando ? <p className="mt-1 text-xs text-ink-500">Alterada em {quando}</p> : null}
              </>
            )}
          </div>
        </section>
      </div>

      <AlertDialog
        open={confirmando !== null}
        onOpenChange={(a) => !a && !mut.isPending && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmando === "ligar"
                ? "Ligar a segunda etapa em toda a plataforma?"
                : "Desligar a segunda etapa em toda a plataforma?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando === "ligar"
                ? "As regras de obrigação voltam a valer. Contas obrigadas que ainda não têm o aplicativo precisam cadastrá-lo, e podem ficar bloqueadas ao vencer o prazo."
                : "Contas de plataforma, emergência, gestores e empresas deixam de ser obrigadas a confirmar o aplicativo. Use só em manutenção ou emergência operacional."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mut.isPending}
              onClick={(e) => {
                e.preventDefault();
                mut.mutate(confirmando === "desligar");
              }}
            >
              {mut.isPending ? "Salvando…" : confirmando === "ligar" ? "Ligar" : "Desligar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
