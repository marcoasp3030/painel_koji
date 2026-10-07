import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import { Eyebrow, GoldRule } from "@/components/luxtia/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ADMIN_NAV } from "@/lib/nav";
import { PROVIDER_BY_KEY, PROVIDERS } from "@/lib/providers";
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
      <Link to="/admin" className="text-sm text-purple-500 hover:text-purple-400">
        ← Voltar para clientes
      </Link>

      {isLoading || !data ? (
        <p className="mt-8 text-ink-500">Carregando…</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <h1 className="font-display text-4xl text-purple-800">{data.tenant.name}</h1>
            <StatusBadge status={data.tenant.status} />
          </div>
          <p className="mt-2 text-ink-500">
            {data.tenant.slug}
            {data.tenant.contact_name ? ` · ${data.tenant.contact_name}` : ""}
            {data.tenant.contact_email ? ` · ${data.tenant.contact_email}` : ""}
          </p>
          <GoldRule className="mt-5" />

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/integracoes" search={{ tenantId }}>
                Configurar Integrações
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/ifood-debug" search={{ tenantId }}>
                Ver Debug iFood
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/99food-debug" search={{ tenantId }}>
                Ver Debug 99Food
              </Link>
            </Button>
          </div>


          <section className="mt-10">
            <Eyebrow>Integrações</Eyebrow>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PROVIDERS.map((p) => {
                const row = data.integrations.find((i: any) => i.provider === p.key);
                return (
                  <div key={p.key} className="rounded-lg border border-base-200 bg-card p-5">
                    <p className="font-display text-lg text-purple-800">{p.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-ink-500">
                      {p.category}
                    </p>
                    <p className="mt-4 text-sm text-ink-700">
                      {row?.enabled ? "Ativa" : "Não configurada"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <Eyebrow>Acessos</Eyebrow>
              <div className="mt-4 rounded-lg border border-base-200 bg-card">
                {data.members.length === 0 ? (
                  <p className="p-6 text-ink-500">Nenhum acesso criado para este cliente.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-base-200 text-xs uppercase tracking-wider text-ink-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Pessoa</th>
                        <th className="px-5 py-3 font-medium">Perfil</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.members.map((m: any) => (
                        <tr key={m.id} className="border-b border-base-200 last:border-0">
                          <td className="px-5 py-4">
                            <p className="font-medium text-ink-900">{m.full_name || m.email}</p>
                            <p className="text-xs text-ink-500">{m.email}</p>
                          </td>
                          <td className="px-5 py-4 text-ink-700">
                            {m.is_tenant_admin ? "Administrador" : "Usuário"}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeMutation.mutate(m.id)}
                            >
                              Remover
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-8 rounded-lg border border-base-200 bg-card p-6">
                <h2 className="font-display text-xl text-purple-800">Zona de risco</h2>
                <p className="mt-2 text-sm text-ink-500">
                  Excluir o cliente remove suas integrações e acessos definitivamente.
                </p>
                <Button
                  variant="destructive"
                  className="mt-4"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  Excluir cliente
                </Button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="h-fit rounded-lg border border-base-200 bg-card p-6"
            >
              <h2 className="font-display text-xl text-purple-800">Novo acesso</h2>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    required
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-base-200 px-4 py-3">
                  <Label htmlFor="isAdmin" className="text-sm">
                    Administrador do cliente
                  </Label>
                  <Switch id="isAdmin" checked={isTenantAdmin} onCheckedChange={setIsTenantAdmin} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando…" : "Criar acesso"}
                </Button>
              </div>
            </form>
          </section>
          <p className="mt-10 text-xs text-ink-500">
            Provedores disponíveis: {PROVIDERS.map((p) => PROVIDER_BY_KEY[p.key].name).join(" · ")}
          </p>
        </>
      )}
    </AppShell>
  );
}
