/** Configurações globais — só Super Admin (pai /admin já confere). */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import { CabecalhoPagina, Cartao } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ADMIN_NAV } from "@/lib/nav";
import {
  definirMfaDesativado,
  lerConfigPlataforma,
} from "@/lib/plataforma-config.functions";

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
  const [confirmando, setConfirmando] = useState(false);

  const q = useQuery({
    queryKey: ["config-plataforma"],
    queryFn: () => ler(),
  });

  const mut = useMutation({
    mutationFn: (desativado: boolean) => gravar({ data: { desativado } }),
    onSuccess: (r) => {
      void cache.invalidateQueries({ queryKey: ["config-plataforma"] });
      void cache.invalidateQueries({ queryKey: ["seguranca"] });
      setConfirmando(false);
      toast.success(
        r.mfa_desativado
          ? "MFA desativado em toda a plataforma."
          : "MFA reativado. As regras de obrigação voltam a valer.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desativado = Boolean(q.data?.mfa_desativado);
  const quando = q.data?.atualizado_em
    ? new Date(q.data.atualizado_em).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : null;

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin">
      <CabecalhoPagina
        sobretitulo="Plataforma"
        titulo="Configurações"
        descricao="Ajustes que valem para todos os clientes. Só o Super Admin altera."
      />
      <Cartao className="mt-6 max-w-xl space-y-5 p-5">
        <div>
          <h2 className="font-display text-xl text-purple-900">Segunda etapa (MFA)</h2>
          <p className="mt-2 text-sm text-ink-600">
            Com o MFA desativado, ninguém é obrigado a usar aplicativo autenticador: login, menu e
            funções de negócio seguem em sessão simples. Os fatores já cadastrados não são apagados.
          </p>
        </div>

        {q.isPending ? (
          <p className="text-sm text-ink-500">Carregando…</p>
        ) : q.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {q.error.message}
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-base-200 bg-base-50 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="mfa-global" className="text-base text-ink-900">
                  Desativar MFA em tudo
                </Label>
                <p className="text-xs text-ink-500">
                  Estado atual:{" "}
                  <strong>{desativado ? "desativado" : "ativo (regras MFA1)"}</strong>
                  {quando ? ` · atualizado em ${quando}` : ""}
                </p>
              </div>
              <button
                id="mfa-global"
                type="button"
                role="switch"
                aria-checked={desativado}
                disabled={mut.isPending}
                onClick={() => {
                  if (!desativado) setConfirmando(true);
                  else mut.mutate(false);
                }}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 ${
                  desativado ? "bg-amber-600" : "bg-base-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform ${
                    desativado ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {confirmando ? (
              <div
                role="alertdialog"
                aria-labelledby="confirma-mfa-titulo"
                className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <p id="confirma-mfa-titulo" className="font-medium">
                  Desativar a segunda etapa em toda a plataforma?
                </p>
                <p>
                  Contas de plataforma, emergência, gestores e empresas deixam de ser obrigadas a
                  confirmar o aplicativo. Use só em manutenção ou emergência operacional.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate(true)}
                  >
                    {mut.isPending ? "Salvando…" : "Sim, desativar MFA"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={mut.isPending}
                    onClick={() => setConfirmando(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Cartao>
    </AppShell>
  );
}
