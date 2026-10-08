import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import {
  CabecalhoPagina,
  Cartao,
  EstadoVazio,
  Iniciais,
  Metrica,
} from "@/components/luxtia/Superficie";
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

  const membros = data?.members ?? [];
  const administradores = membros.filter((m: { is_tenant_admin?: boolean }) => m.is_tenant_admin).length;

  return (
    <AppShell nav={TENANT_NAV} context={data?.tenant?.name ?? "Cliente"}>
      <CabecalhoPagina
        sobretitulo="Operação"
        titulo="Quem acessa a plataforma"
        descricao="As pessoas desta lista entram com o e-mail e a senha definidos aqui."
      />

      {isLoading || !data ? (
        <p className="mt-8 text-ink-500">Carregando…</p>
      ) : (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Metrica rotulo="Pessoas" valor={membros.length} detalhe="Com acesso" />
            <Metrica rotulo="Administradores" valor={administradores} detalhe="Podem convidar" />
          </div>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_20rem]">
            <Cartao>
              {membros.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhum acesso ainda"
                  texto="Crie o primeiro acesso para que alguém da equipe entre na plataforma."
                />
              ) : (
                <ul>
                  {membros.map((m: any) => (
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
                        {data.isTenantAdmin ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeMutation.mutate(m.id)}
                          >
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>

            {data.isTenantAdmin && data.tenant ? (
              <Cartao className="p-6">
                <h2 className="font-display text-xl text-purple-800">Novo acesso</h2>
                <p className="mt-1 text-sm text-ink-500">A pessoa já entra com a senha inicial.</p>
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
                      Administrador
                    </Label>
                    <Switch id="isAdmin" checked={isTenantAdmin} onCheckedChange={setIsTenantAdmin} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando…" : "Criar acesso"}
                  </Button>
                </form>
              </Cartao>
            ) : null}
          </div>
        </>
      )}
    </AppShell>
  );
}
