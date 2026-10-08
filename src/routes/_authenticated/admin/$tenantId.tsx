import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import {
  CabecalhoPagina,
  Cartao,
  EstadoVazio,
  Iniciais,
} from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ADMIN_NAV } from "@/lib/nav";
import { PROVIDERS } from "@/lib/providers";
import {
  createTenantUser,
  deleteTenant,
  getTenantDetail,
  removeTenantUser,
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

function TenantDetail() {
  const { tenantId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTenantDetail);
  const createUser = useServerFn(createTenantUser);
  const removeUser = useServerFn(removeTenantUser);
  const removeTenant = useServerFn(deleteTenant);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [isTenantAdmin, setIsTenantAdmin] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => fetchDetail({ data: { id: tenantId } }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({ data: { tenantId, email, password, fullName, isTenantAdmin } }),
    onSuccess: () => {
      toast.success("Acesso criado.");
      setEmail("");
      setFullName("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeUser({ data: { id } }),
    onSuccess: () => {
      toast.success("Acesso removido.");
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeTenant({ data: { id: tenantId } }),
    onSuccess: () => {
      toast.success("Cliente excluído.");
      navigate({ to: "/admin" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin">
      <Link
        to="/admin"
        className="inline-flex text-sm font-medium text-purple-600 hover:text-purple-500"
      >
        ← Voltar para clientes
      </Link>

      {isLoading || !data ? (
        <p className="mt-8 text-ink-500">Carregando…</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <CabecalhoPagina
              sobretitulo={data.tenant.slug}
              titulo={data.tenant.name}
              descricao={[data.tenant.contact_name, data.tenant.contact_email]
                .filter(Boolean)
                .join(" · ")}
            />
            <StatusBadge status={data.tenant.status} />
          </div>

          <section className="mt-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">
              Conexões
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PROVIDERS.map((p) => {
                const row = data.integrations.find((i: any) => i.provider === p.key);
                const ativa = Boolean(row?.enabled);
                return (
                  <Cartao key={p.key} className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-lg text-purple-800">{p.name}</p>
                      <span
                        className={`size-2 rounded-full ${ativa ? "bg-success" : "bg-ink-300"}`}
                      />
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wider text-ink-500">{p.category}</p>
                    <p className={`mt-4 text-sm ${ativa ? "text-success" : "text-ink-500"}`}>
                      {ativa ? "Ativa" : "Não configurada"}
                    </p>
                  </Cartao>
                );
              })}
            </div>
          </section>

          <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_20rem]">
            <div className="space-y-6">
              <Cartao>
                <div className="border-b border-base-200 px-5 py-4">
                  <p className="text-sm font-medium text-ink-900">Acessos</p>
                </div>
                {data.members.length === 0 ? (
                  <EstadoVazio
                    titulo="Nenhum acesso"
                    texto="Crie um acesso no formulário para esta pessoa entrar no painel do cliente."
                  />
                ) : (
                  <ul>
                    {data.members.map((m: any) => (
                      <li
                        key={m.id}
                        className="flex flex-col gap-3 border-b border-base-200 px-5 py-4 last:border-0 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Iniciais nome={m.full_name || m.email} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">{m.full_name || m.email}</p>
                            <p className="truncate text-xs text-ink-500">{m.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                            {m.is_tenant_admin ? "Administrador" : "Usuário"}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeMutation.mutate(m.id)}
                          >
                            Remover
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Cartao>

              <Cartao className="border-destructive/20 p-6">
                <h2 className="font-display text-xl text-purple-800">Zona de risco</h2>
                <p className="mt-2 text-sm text-ink-500">
                  Excluir o cliente remove os acessos e as conexões de forma definitiva.
                </p>
                <Button
                  variant="destructive"
                  className="mt-4"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  Excluir cliente
                </Button>
              </Cartao>
            </div>

            <Cartao className="p-6">
              <h2 className="font-display text-xl text-purple-800">Novo acesso</h2>
              <p className="mt-1 text-sm text-ink-500">A pessoa entra com este e-mail e esta senha.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate();
                }}
                className="mt-5 space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-base-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-base-50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha inicial</Label>
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    className="bg-base-50"
                    required
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-base-200 bg-base-50 px-4 py-3">
                  <Label htmlFor="isAdmin" className="text-sm">
                    Administrador do cliente
                  </Label>
                  <Switch id="isAdmin" checked={isTenantAdmin} onCheckedChange={setIsTenantAdmin} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando…" : "Criar acesso"}
                </Button>
              </form>
            </Cartao>
          </section>
        </>
      )}
    </AppShell>
  );
}
