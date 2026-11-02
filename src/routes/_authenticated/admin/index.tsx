import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronRight, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/luxtia/AppShell";
import { ChipFiltro } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filtrarClientes, type ClienteLinha } from "@/lib/clientes";
import { ADMIN_NAV } from "@/lib/nav";
import { createTenant, listTenants } from "@/lib/platform.functions";

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

const COLUNAS = "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_70px_90px_90px_16px]";

function AdminTenants() {
  const fetchTenants = useServerFn(listTenants);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [ordem, setOrdem] = useState("recentes");
  const [cadastroAberto, setCadastroAberto] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => fetchTenants(),
  });
  const lista = (data ?? []) as ClienteLinha[];
  const visiveis = filtrarClientes(lista, { busca, status, ordem });
  const contar = (s: string) => lista.filter((t) => t.status === s).length;

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin" telaCheia>
      <h1 className="sr-only">Clientes da plataforma</h1>
      <div className="flex min-h-0 flex-1 flex-col bg-card">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 px-3 py-1.5">
          <div className="relative min-w-40 flex-1 sm:max-w-64">
            <Search
              className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-500"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Buscar cliente"
              placeholder="Nome, e-mail ou identificador"
              className="h-8 pl-7 text-sm"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-0.5" role="group" aria-label="Filtrar por situação">
            <ChipFiltro
              ativo={!status}
              rotulo="Todos"
              total={lista.length}
              onClick={() => setStatus("")}
            />
            <ChipFiltro
              ativo={status === "active"}
              rotulo="Ativos"
              total={contar("active")}
              onClick={() => setStatus(status === "active" ? "" : "active")}
            />
            <ChipFiltro
              ativo={status === "suspended"}
              rotulo="Suspensos"
              total={contar("suspended")}
              onClick={() => setStatus(status === "suspended" ? "" : "suspended")}
            />
          </div>
          <select
            aria-label="Ordenar por"
            className="h-8 rounded-md border bg-card px-2 text-sm"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
          >
            <option value="recentes">Mais recentes</option>
            <option value="nome">Nome: A–Z</option>
          </select>
          <Button size="sm" className="ml-auto" onClick={() => setCadastroAberto(true)}>
            <Plus className="size-4" aria-hidden /> Novo cliente
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            aria-hidden
            className={`sticky top-0 z-10 hidden gap-3 border-b border-base-200 bg-card/95 px-4 py-1.5 text-xs font-medium text-ink-500 backdrop-blur lg:grid ${COLUNAS}`}
          >
            <span>Cliente</span>
            <span>Responsável</span>
            <span>Empresa do gateway</span>
            <span>Acessos</span>
            <span>Integrações</span>
            <span>Situação</span>
            <span />
          </div>
          {isLoading ? (
            <p role="status" className="p-4 text-sm text-ink-500">
              Carregando clientes…
            </p>
          ) : isError ? (
            <div role="alert" className="space-y-2 p-4 text-sm text-destructive">
              <p>Não foi possível carregar os clientes.</p>
              <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
                {isFetching ? "Carregando…" : "Tentar novamente"}
              </Button>
            </div>
          ) : visiveis.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">
              {lista.length
                ? "Nenhum cliente com esses filtros."
                : "Cadastre o primeiro cliente para gerenciar acessos e integrações."}
            </p>
          ) : (
            <ul>
              {visiveis.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/admin/$tenantId"
                    params={{ tenantId: t.id }}
                    className={`grid grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 gap-y-0.5 border-b border-base-200/70 px-4 py-2 transition-colors hover:bg-purple-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${COLUNAS}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {t.name}
                      </span>
                      <span className="block truncate text-xs text-ink-500">{t.slug}</span>
                    </span>
                    <ChevronRight className="size-4 text-ink-300 lg:order-last" aria-hidden />
                    <span className="min-w-0 max-lg:col-span-2">
                      <span className="block truncate text-xs text-ink-700">
                        {t.contact_name || "Sem responsável"}
                      </span>
                      {t.contact_email ? (
                        <span
                          className="hidden truncate text-xs text-ink-500 lg:block"
                          title={t.contact_email}
                        >
                          {t.contact_email}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`hidden min-w-0 truncate font-mono text-xs lg:block ${t.gateway_tenant_id ? "text-ink-700" : "text-gold-700"}`}
                    >
                      {t.gateway_tenant_id ?? "Sem vínculo"}
                    </span>
                    <span className="hidden text-xs tabular-nums text-ink-700 lg:block">
                      {t.userCount}
                    </span>
                    <span className="hidden text-xs tabular-nums text-ink-700 lg:block">
                      {t.activeIntegrations}
                    </span>
                    <span className="max-lg:col-span-2">
                      <StatusBadge status={t.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {cadastroAberto ? <NovoCliente fechar={() => setCadastroAberto(false)} /> : null}
    </AppShell>
  );
}

function NovoCliente({ fechar }: { fechar: () => void }) {
  const queryClient = useQueryClient();
  const create = useServerFn(createTenant);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const criar = useMutation({
    mutationFn: () => {
      const cleanSlug = toSlug(slug || name);
      if (cleanSlug.length < 2) {
        throw new Error(
          "Informe um identificador com pelo menos 2 caracteres (letras ou números).",
        );
      }
      return create({ data: { name: name.trim(), slug: cleanSlug, contactName, contactEmail } });
    },
    onSuccess: () => {
      toast.success("Cliente criado com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
      fechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(a) => !a && fechar()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>
            Comece pelos dados do cliente. Depois, configure acessos e integrações.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            criar.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome do cliente</Label>
            <Input
              id="name"
              placeholder="Ex.: Restaurante Central"
              minLength={2}
              required
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(toSlug(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Identificador</Label>
            <Input
              id="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              onBlur={(e) => setSlug(toSlug(e.target.value))}
            />
            <p className="text-xs text-ink-500">Letras minúsculas, números e hífen.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Responsável</Label>
            <Input
              id="contactName"
              placeholder="Nome de quem cuida da operação"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">E-mail do responsável</Label>
            <Input
              id="contactEmail"
              placeholder="contato@empresa.com.br"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={criar.isPending}>
            {criar.isPending ? "Criando…" : "Criar cliente"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-purple-100 text-purple-700" : "bg-base-100 text-ink-500"
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-purple-500" : "bg-ink-300"}`} />
      {active ? "Ativo" : "Suspenso"}
    </span>
  );
}
