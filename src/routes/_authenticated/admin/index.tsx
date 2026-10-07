import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import { Eyebrow, GoldRule } from "@/components/luxtia/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTenant, listTenants, setTenantStatus } from "@/lib/platform.functions";
import { ADMIN_NAV } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Super Admin · Clientes da plataforma Luxtia" },
      {
        name: "description",
        content: "Crie e gerencie clientes, acessos e integrações da plataforma Luxtia.",
      },
      { property: "og:title", content: "Super Admin · Luxtia" },
      { property: "og:description", content: "Gestão de clientes e acessos da plataforma Luxtia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminTenants,
});

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AdminTenants() {
  const queryClient = useQueryClient();
  const fetchTenants = useServerFn(listTenants);
  const create = useServerFn(createTenant);
  const setStatus = useServerFn(setTenantStatus);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => fetchTenants(),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const cleanSlug = toSlug(slug || name);
      if (cleanSlug.length < 2) {
        throw new Error("Informe um identificador com pelo menos 2 caracteres (letras ou números).");
      }
      return create({ data: { name: name.trim(), slug: cleanSlug, contactName, contactEmail } });
    },
    onSuccess: () => {
      toast.success("Cliente criado.");
      setName("");
      setSlug("");
      setSlugTouched(false);
      setContactName("");
      setContactEmail("");
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "suspended" }) =>
      setStatus({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenants"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin">
      <Eyebrow>Clientes</Eyebrow>
      <h1 className="mt-2 font-display text-4xl text-purple-800">Clientes da plataforma</h1>
      <GoldRule className="mt-5" />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border border-base-200 bg-card">
          {isLoading ? (
            <p className="p-6 text-ink-500">Carregando…</p>
          ) : !tenants || tenants.length === 0 ? (
            <p className="p-6 text-ink-500">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-base-200 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Acessos</th>
                  <th className="px-5 py-3 font-medium">Integrações ativas</th>
                  <th className="px-5 py-3 font-medium">Situação</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {tenants.map((t: any) => (
                  <tr key={t.id} className="border-b border-base-200 last:border-0">
                    <td className="px-5 py-4">
                      <Link
                        to="/admin/$tenantId"
                        params={{ tenantId: t.id }}
                        className="font-medium text-purple-600 hover:text-purple-500"
                      >
                        {t.name}
                      </Link>
                      <p className="text-xs text-ink-500">{t.slug}</p>
                    </td>
                    <td className="px-5 py-4 tabular-nums">{t.userCount}</td>
                    <td className="px-5 py-4 tabular-nums">{t.activeIntegrations} de 4</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          statusMutation.mutate({
                            id: t.id,
                            status: t.status === "active" ? "suspended" : "active",
                          })
                        }
                      >
                        {t.status === "active" ? "Suspender" : "Reativar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="h-fit rounded-lg border border-base-200 bg-card p-6"
        >
          <h2 className="font-display text-xl text-purple-800">Novo cliente</h2>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(toSlug(e.target.value));
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Identificador</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                onBlur={(e) => setSlug(toSlug(e.target.value))}
                required
              />
              <p className="text-xs text-ink-500">
                Apenas letras minúsculas, números e hífen; mínimo de 2 caracteres.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Responsável</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">E-mail do responsável</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando…" : "Criar cliente"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-purple-100 text-purple-700" : "bg-base-100 text-ink-500"
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-purple-500" : "bg-ink-300"}`} />
      {active ? "Ativo" : "Suspenso"}
    </span>
  );
}
