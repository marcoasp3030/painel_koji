import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { papelAcesso, ROTULO_PAPEL } from "@/lib/acesso/papeis";
import { confirmaExclusao } from "@/lib/clientes";
import { ADMIN_NAV } from "@/lib/nav";
import { PROVIDERS } from "@/lib/providers";
import {
  createTenantUser,
  deleteTenant,
  getTenantDetail,
  removeTenantUser,
  setTenantStatus,
} from "@/lib/platform.functions";
import { StatusBadge } from "./index";

export const Route = createFileRoute("/_authenticated/admin/$tenantId")({
  head: () => ({
    meta: [
      { title: "Cliente · Acessos e integrações | Luxtia" },
      {
        name: "description",
        content: "Gerencie os acessos e acompanhe as integrações configuradas por este cliente.",
      },
      { property: "og:title", content: "Cliente · Luxtia" },
      { property: "og:description", content: "Acessos e integrações do cliente na plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TenantDetail,
});

type Membro = {
  id: string;
  email: string;
  full_name: string | null;
  is_tenant_admin: boolean;
  ativo: boolean;
  papel: string | null;
};

function rotuloDoAcesso(m: Membro) {
  const papel = papelAcesso(m.papel);
  if (papel) return ROTULO_PAPEL[papel];
  return m.is_tenant_admin ? "Administrador" : "Sem papel";
}

function TenantDetail() {
  const { tenantId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTenantDetail);
  const removeUser = useServerFn(removeTenantUser);
  const removeTenant = useServerFn(deleteTenant);
  const setStatus = useServerFn(setTenantStatus);

  const [novoAcesso, setNovoAcesso] = useState(false);
  const [remover, setRemover] = useState<Membro | null>(null);
  const [confirmarStatus, setConfirmarStatus] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [nomeDigitado, setNomeDigitado] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => fetchDetail({ data: { id: tenantId } }),
    retry: false,
  });
  const atualizar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["tenants"] }),
    ]);

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeUser({ data: { id } }),
    onSuccess: async () => {
      toast.success("Acesso removido.");
      setRemover(null);
      await atualizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "suspended") => setStatus({ data: { id: tenantId, status } }),
    onSuccess: async () => {
      toast.success("Situação do cliente atualizada.");
      setConfirmarStatus(false);
      await atualizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeTenant({ data: { id: tenantId } }),
    onSuccess: async () => {
      toast.success("Cliente excluído.");
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      navigate({ to: "/admin" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voltar = (
    <Link
      to="/admin"
      aria-label="Voltar para clientes"
      className="rounded p-1 text-ink-500 hover:bg-purple-50 hover:text-purple-800"
    >
      <ArrowLeft className="size-4" aria-hidden />
    </Link>
  );

  if (isLoading || !data) {
    return (
      <AppShell nav={ADMIN_NAV} context="Super Admin" telaCheia>
        <h1 className="sr-only">Cliente</h1>
        <div className="flex items-center gap-2 border-b border-base-200 bg-card px-3 py-2">
          {voltar}
          {error ? (
            <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
              <p>Não foi possível abrir este cliente.</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <p role="status" className="text-sm text-ink-500">
              Carregando…
            </p>
          )}
        </div>
      </AppShell>
    );
  }

  const { tenant } = data;
  const membros = data.members as Membro[];
  const ativo = tenant.status === "active";
  const contato = [tenant.contact_name, tenant.contact_email].filter(Boolean).join(" · ");
  const nAcessos = `${membros.length} ${membros.length === 1 ? "acesso" : "acessos"}`;

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin" telaCheia>
      <div className="flex min-h-0 flex-1 flex-col bg-card">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-base-200 px-3 py-1.5">
          {voltar}
          <div className="min-w-0 flex-1 basis-40">
            <h1 className="truncate text-sm font-medium text-ink-900">{tenant.name}</h1>
            <p className="truncate text-xs text-ink-500">
              {tenant.slug}
              {contato ? ` · ${contato}` : ""}
            </p>
          </div>
          <StatusBadge status={tenant.status} />
          <Button
            variant="outline"
            size="sm"
            className={ativo ? "text-destructive" : ""}
            onClick={() => setConfirmarStatus(true)}
          >
            {ativo ? "Suspender" : "Reativar"}
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px] lg:overflow-hidden">
          <section className="min-h-0 min-w-0 lg:overflow-y-auto" aria-label="Acessos">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-base-200 bg-card/95 px-4 py-1.5 backdrop-blur">
              <h2 className="text-sm font-medium text-ink-900">Acessos · {membros.length}</h2>
              <Button size="sm" variant="outline" onClick={() => setNovoAcesso(true)}>
                <Plus className="size-4" aria-hidden /> Novo gestor
              </Button>
            </div>
            {membros.length === 0 ? (
              <p className="p-4 text-sm text-ink-500">
                Nenhum acesso. Crie o gestor para esta pessoa entrar no painel do cliente.
              </p>
            ) : (
              <ul>
                {membros.map((m) => (
                  <li
                    key={m.id}
                    className={`flex items-center gap-3 border-b border-base-200/70 px-4 py-2 ${m.ativo === false ? "opacity-60" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {m.full_name || m.email}
                      </p>
                      <p className="truncate text-xs text-ink-500">{m.email}</p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-700">
                      {rotuloDoAcesso(m)}
                      {m.ativo === false ? " · inativo" : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-ink-500"
                      aria-label={`Remover ${m.email}`}
                      onClick={() => setRemover(m)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="px-4 py-2 text-xs text-ink-500">
              Para convidar com papel e unidades, use a tela{" "}
              <Link to="/equipe" className="underline underline-offset-2">
                Usuários
              </Link>
              .
            </p>
          </section>

          <aside className="min-w-0 space-y-4 border-base-200 p-4 max-lg:border-t lg:overflow-y-auto lg:border-l">
            <section aria-label="Gateway">
              <h2 className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Empresa do gateway
              </h2>
              <p className="mt-1 text-sm text-ink-900">
                {tenant.gateway_tenant_id ? (
                  <span className="font-mono">{tenant.gateway_tenant_id}</span>
                ) : (
                  <span className="text-gold-700">Sem vínculo</span>
                )}
              </p>
              <Link
                to="/ia/empresas"
                className="mt-0.5 inline-block text-xs underline underline-offset-2"
              >
                Abrir Empresas do gateway
              </Link>
            </section>
            <section aria-label="Conexões">
              <h2 className="text-xs font-medium uppercase tracking-wide text-ink-500">Conexões</h2>
              <ul className="mt-1 space-y-1">
                {PROVIDERS.map((p) => {
                  const row = data.integrations.find((i) => i.provider === p.key);
                  const ativa = Boolean(row?.enabled);
                  return (
                    <li key={p.key} className="flex items-center gap-2 text-sm">
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${ativa ? "bg-success" : "bg-ink-300"}`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-ink-900">{p.name}</span>
                      <span className={`text-xs ${ativa ? "text-success" : "text-ink-500"}`}>
                        {ativa ? "Ativa" : "Não configurada"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="border-t border-base-200 pt-3" aria-label="Excluir cliente">
              <p className="text-xs text-ink-500">
                Excluir remove este cadastro, os vínculos de acesso e as conexões. Não dá para
                desfazer.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-destructive"
                onClick={() => {
                  setNomeDigitado("");
                  setExcluindo(true);
                }}
              >
                Excluir cliente
              </Button>
            </section>
          </aside>
        </div>
      </div>

      <Sheet open={novoAcesso} onOpenChange={setNovoAcesso}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-base-200 px-4 py-3 text-left">
            <SheetTitle>Novo gestor</SheetTitle>
            <SheetDescription>
              A pessoa entra com este e-mail e esta senha, e administra todo o cliente.
            </SheetDescription>
          </SheetHeader>
          {novoAcesso ? (
            <FormGestor
              tenantId={tenantId}
              criado={async () => {
                setNovoAcesso(false);
                await atualizar();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={remover !== null}
        onOpenChange={(a) => !a && !removeMutation.isPending && setRemover(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {remover?.full_name || remover?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Apaga a conta de {remover?.email} e tira o acesso a este cliente. Não dá para
              desfazer. Para só bloquear a entrada, use Desativar em Usuários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (remover) removeMutation.mutate(remover.id);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmarStatus}
        onOpenChange={(a) => !statusMutation.isPending && setConfirmarStatus(a)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ativo ? "Suspender" : "Reativar"} {tenant.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ativo
                ? `Quem tem acesso a este cliente (${nAcessos}) deixa de entrar no painel. Os agentes no gateway não mudam: para pará-los, suspenda a empresa em Empresas do gateway.`
                : "Quem tem acesso a este cliente volta a entrar no painel."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                statusMutation.mutate(ativo ? "suspended" : "active");
              }}
            >
              {ativo ? "Suspender" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={excluindo}
        onOpenChange={(a) => !deleteMutation.isPending && setExcluindo(a)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {tenant.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove o cadastro, os vínculos de acesso ({nAcessos}) e as conexões deste cliente. Não
              dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block text-sm text-ink-900">
            Digite <strong>{tenant.name}</strong> para confirmar
            <Input
              className="mt-1"
              autoComplete="off"
              value={nomeDigitado}
              onChange={(e) => setNomeDigitado(e.target.value)}
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending || !confirmaExclusao(nomeDigitado, tenant.name)}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function FormGestor({ tenantId, criado }: { tenantId: string; criado: () => Promise<unknown> }) {
  const createUser = useServerFn(createTenantUser);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const criar = useMutation({
    mutationFn: () =>
      createUser({ data: { tenantId, email, password, fullName, isTenantAdmin: true } }),
    onSuccess: async () => {
      toast.success("Acesso criado.");
      await criado();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        criar.mutate();
      }}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nome</Label>
          <Input
            id="fullName"
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha inicial</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-ink-500">Pelo menos 8 caracteres.</p>
        </div>
      </div>
      <div className="flex justify-end border-t border-base-200 p-3">
        <Button type="submit" disabled={criar.isPending}>
          {criar.isPending ? "Criando…" : "Criar gestor"}
        </Button>
      </div>
    </form>
  );
}
