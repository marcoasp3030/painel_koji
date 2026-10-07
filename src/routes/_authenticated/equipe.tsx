import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import { Eyebrow, GoldRule } from "@/components/luxtia/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TENANT_NAV } from "@/lib/nav";
import { createTenantUser, listMyTeam, removeTenantUser } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe · Acessos do seu negócio | Luxtia" },
      {
        name: "description",
        content: "Convide e remova pessoas com acesso às integrações do seu negócio na Luxtia.",
      },
      { property: "og:title", content: "Equipe · Luxtia" },
      { property: "og:description", content: "Gestão de acessos internos do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Equipe,
});

function Equipe() {
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(listMyTeam);
  const createUser = useServerFn(createTenantUser);
  const removeUser = useServerFn(removeTenantUser);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["team"], queryFn: () => fetchTeam() });

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({
        data: { tenantId: data!.tenant!.id, email, password, fullName, isTenantAdmin },
      }),
    onSuccess: () => {
      toast.success("Acesso criado.");
      setEmail("");
      setFullName("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeUser({ data: { id } }),
    onSuccess: () => {
      toast.success("Acesso removido.");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell nav={TENANT_NAV} context={data?.tenant?.name ?? "Cliente"}>
      <Eyebrow>Equipe</Eyebrow>
      <h1 className="mt-2 font-display text-4xl text-purple-800">Quem acessa a plataforma</h1>
      <GoldRule className="mt-5" />

      {isLoading || !data ? (
        <p className="mt-10 text-ink-500">Carregando…</p>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-base-200 bg-card">
            {data.members.length === 0 ? (
              <p className="p-6 text-ink-500">Nenhum acesso cadastrado.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-base-200 text-xs uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Pessoa</th>
                    <th className="px-5 py-3 font-medium">Perfil</th>
                    {data.isTenantAdmin ? <th className="px-5 py-3" /> : null}
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
                      {data.isTenantAdmin ? (
                        <td className="px-5 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeMutation.mutate(m.id)}
                          >
                            Remover
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data.isTenantAdmin && data.tenant ? (
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
                    Administrador
                  </Label>
                  <Switch id="isAdmin" checked={isTenantAdmin} onCheckedChange={setIsTenantAdmin} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando…" : "Criar acesso"}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
