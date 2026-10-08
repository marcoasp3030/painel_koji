import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import { CabecalhoPagina, Cartao, EstadoVazio, Iniciais, Metrica } from "@/components/luxtia/Superficie";
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
  const [busca, setBusca] = useState("");

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

  const lista = tenants ?? [];
  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? lista.filter((t: { name?: string; slug?: string; contact_name?: string; contact_email?: string }) =>
        [t.name, t.slug, t.contact_name, t.contact_email].some((campo) =>
          (campo ?? "").toLowerCase().includes(termo),
        ),
      )
    : lista;
  const ativos = lista.filter((t: { status: string }) => t.status === "active").length;

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin">
      <CabecalhoPagina
        sobretitulo="Operação"
        titulo="Clientes da plataforma"
        descricao="Acompanhe quem está ativo e cadastre um novo cliente sem sair desta tela."
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Metrica rotulo="Clientes" valor={isLoading ? "—" : lista.length} detalhe="Cadastrados" />
        <Metrica rotulo="Ativos" valor={isLoading ? "—" : ativos} detalhe="Podem operar" />
        <Metrica
          rotulo="Suspensos"
          valor={isLoading ? "—" : lista.length - ativos}
          detalhe="Acesso pausado"
        />
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_20rem]">
        <Cartao>
          <div className="flex flex-col gap-3 border-b border-base-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-ink-900">Lista</p>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou identificador"
              aria-label="Buscar cliente"
              className="bg-base-50 sm:max-w-xs"
            />
          </div>
          {isLoading ? (
            <p className="p-6 text-ink-500">Carregando…</p>
          ) : lista.length === 0 ? (
            <EstadoVazio
              titulo="Nenhum cliente ainda"
              texto="Use o formulário ao lado para cadastrar o primeiro cliente da plataforma."
            />
          ) : filtrados.length === 0 ? (
            <EstadoVazio
              titulo="Nada encontrado"
              texto="Nenhum cliente corresponde à busca. Tente o nome ou o identificador."
            />
          ) : (
            <ul>
              {filtrados.map((t: any) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 border-b border-base-200 px-5 py-4 last:border-0 sm:flex-row sm:items-center"
                >
                  <Link
                    to="/admin/$tenantId"
                    params={{ tenantId: t.id }}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Iniciais nome={t.name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-purple-800">{t.name}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {t.slug}
                        {typeof t.userCount === "number"
                          ? ` · ${t.userCount} ${t.userCount === 1 ? "acesso" : "acessos"}`
                          : ""}
                      </span>
                    </span>
                  </Link>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <StatusBadge status={t.status} />
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao className="p-6">
          <h2 className="font-display text-xl text-purple-800">Novo cliente</h2>
          <p className="mt-1 text-sm text-ink-500">O identificador é gerado a partir do nome.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="mt-5 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(toSlug(e.target.value));
                }}
                className="bg-base-50"
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
                className="bg-base-50"
                required
              />
              <p className="text-xs text-ink-500">Letras minúsculas, números e hífen.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Responsável</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="bg-base-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">E-mail do responsável</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="bg-base-50"
              />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando…" : "Criar cliente"}
            </Button>
          </form>
        </Cartao>
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
