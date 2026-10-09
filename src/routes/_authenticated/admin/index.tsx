import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import { CabecalhoPagina, Cartao, EstadoVazio, Iniciais } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTenant, listTenants, setTenantStatus } from "@/lib/platform.functions";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PauseCircle,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
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

type Cliente = {
  id: string;
  name: string;
  slug: string;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  userCount: number;
  activeIntegrations: number;
};

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
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [filtro, setFiltro] = useState("all");
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState("recentes");

  const {
    data: tenants,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => fetchTenants(),
  });

  const createMutation = useMutation({
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
      setCadastroAberto(false);
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
    mutationFn: (vars: { id: string; status: "active" | "suspended" }) => setStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Status do cliente atualizado.");
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista: Cliente[] = tenants ?? [];
  const normalizar = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const termo = normalizar(busca.trim());
  const filtrados = lista.filter(
    (t) =>
      (filtro === "all" || t.status === filtro) &&
      [t.name, t.slug, t.contact_name, t.contact_email].some((campo) =>
        normalizar(campo ?? "").includes(termo),
      ),
  );
  if (ordem === "nome") filtrados.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const ativos = lista.filter((t) => t.status === "active").length;
  const suspensos = lista.filter((t) => t.status === "suspended").length;
  const paginas = Math.max(1, Math.ceil(filtrados.length / 10));
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * 10, paginaAtual * 10);
  const metricas = [
    {
      rotulo: "Total de clientes",
      valor: lista.length,
      detalhe: "Sua base na plataforma",
      icone: Building2,
    },
    {
      rotulo: "Clientes ativos",
      valor: ativos,
      detalhe: "Com acesso à plataforma",
      icone: CheckCircle2,
    },
    {
      rotulo: "Clientes suspensos",
      valor: suspensos,
      detalhe: "Com o acesso pausado",
      icone: PauseCircle,
    },
  ];

  return (
    <AppShell nav={ADMIN_NAV} context="Super Admin">
      <Dialog open={cadastroAberto} onOpenChange={setCadastroAberto}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <header>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500">
              Gestão de clientes
            </p>
            <h1 className="mt-1 font-display text-2xl leading-tight text-purple-800 sm:text-3xl">
              Clientes da plataforma
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              Gerencie clientes, acessos e integrações em um só lugar.
            </p>
          </header>
          <DialogTrigger asChild>
            <Button className="h-10 shrink-0 gap-2 rounded-lg px-5 shadow-sm">
              <Plus className="size-4" aria-hidden /> Novo cliente
            </Button>
          </DialogTrigger>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {metricas.map(({ rotulo, valor, detalhe, icone: Icone }, index) => (
            <div
              key={rotulo}
              className={`relative overflow-hidden rounded-xl border px-4 py-3 ${index === 0 ? "border-purple-800 bg-purple-800 text-base-50" : "border-base-200 bg-card text-purple-800"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`text-sm font-medium ${index === 0 ? "text-purple-200" : "text-ink-500"}`}
                >
                  {rotulo}
                </p>
                <span
                  className={`rounded-lg p-2 ${index === 0 ? "bg-purple-700 text-gold-300" : "bg-purple-50 text-purple-500"}`}
                >
                  <Icone className="size-5" aria-hidden />
                </span>
              </div>
              <p className="mt-1 font-display text-3xl leading-none tabular-nums">
                {isLoading || isError ? "—" : valor}
              </p>
              <p className={`mt-1.5 text-xs ${index === 0 ? "text-purple-200" : "text-ink-500"}`}>
                {detalhe}
              </p>
            </div>
          ))}
        </div>

        <Cartao className="mt-4 overflow-hidden rounded-xl">
          <div className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg text-purple-800">Sua base de clientes</h2>
              <p className="mt-1 text-sm text-ink-500">
                Encontre um cliente e acompanhe sua operação.
              </p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-3 size-4 text-ink-500"
                aria-hidden
              />
              <Input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar nome, e-mail ou identificador"
                aria-label="Buscar cliente"
                className="h-10 rounded-xl bg-base-50 pl-9 pr-9"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setPagina(1);
                  }}
                  aria-label="Limpar busca"
                  className="absolute right-1 top-1 rounded-lg p-2 text-ink-500 hover:bg-purple-100 focus-visible:outline-ring"
                >
                  <X className="size-4" />
                </button>
              )}
            </label>
          </div>
          <div className="flex flex-col justify-between gap-3 border-y border-base-200 bg-base-50/70 px-4 py-2 sm:flex-row sm:items-center">
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="Filtrar clientes por status"
            >
              {[
                { value: "all", label: "Todos", count: lista.length },
                { value: "active", label: "Ativos", count: ativos },
                { value: "suspended", label: "Suspensos", count: suspensos },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filtro === item.value}
                  onClick={() => {
                    setFiltro(item.value);
                    setPagina(1);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-ring ${filtro === item.value ? "bg-purple-800 text-base-50 shadow-sm" : "text-ink-500 hover:bg-purple-100 hover:text-purple-800"}`}
                >
                  {item.label}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${filtro === item.value ? "bg-white/15" : "bg-base-200/60"}`}
                  >
                    {isLoading || isError ? "—" : item.count}
                  </span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-500">
              Ordenar por
              <select
                value={ordem}
                onChange={(e) => {
                  setOrdem(e.target.value);
                  setPagina(1);
                }}
                className="min-h-9 rounded-lg border border-base-200 bg-card px-2 text-ink-700 focus-visible:outline-ring"
              >
                <option value="recentes">Mais recentes</option>
                <option value="nome">Nome: A–Z</option>
              </select>
            </label>
          </div>
          {isLoading ? (
            <div role="status" className="space-y-5 p-6">
              <span className="sr-only">Carregando clientes</span>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-7 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div role="alert" className="pb-8 text-center">
              <EstadoVazio
                titulo="Não foi possível carregar os clientes"
                texto="Tente novamente para consultar sua base de clientes."
              />
              <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>
                {isFetching ? "Carregando…" : "Tentar novamente"}
              </Button>
            </div>
          ) : lista.length === 0 ? (
            <div className="pb-8 text-center">
              <EstadoVazio
                titulo="Seu próximo cliente começa aqui"
                texto="Cadastre o primeiro cliente para gerenciar seus acessos e integrações."
              />
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" aria-hidden /> Cadastrar primeiro cliente
                </Button>
              </DialogTrigger>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="pb-8 text-center">
              <EstadoVazio
                titulo="Nenhum cliente encontrado"
                texto="Tente outro nome, identificador ou e-mail, ou ajuste o filtro de status."
              />
              <Button
                variant="outline"
                onClick={() => {
                  setBusca("");
                  setFiltro("all");
                  setPagina(1);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <>
              <div
                className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem_10rem] gap-4 border-b border-base-200 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-ink-500 xl:grid"
                aria-hidden
              >
                <span>Cliente</span>
                <span>Responsável</span>
                <span>Status</span>
                <span className="text-right">Ações</span>
              </div>
              <ul className="divide-y divide-base-200">
                {visiveis.map((t) => (
                  <li
                    key={t.id}
                    className="grid gap-3 px-4 py-3 transition-colors hover:bg-purple-50/50 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem_10rem] xl:items-center"
                  >
                    <Link
                      to="/admin/$tenantId"
                      params={{ tenantId: t.id }}
                      className="group flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Iniciais nome={t.name} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-purple-800 group-hover:underline">
                          {t.name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-ink-500">{t.slug}</span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3" aria-hidden />
                            {t.userCount} {t.userCount === 1 ? "acesso" : "acessos"}
                          </span>
                          <span>
                            {t.activeIntegrations}{" "}
                            {t.activeIntegrations === 1 ? "integração ativa" : "integrações ativas"}
                          </span>
                        </span>
                      </span>
                    </Link>
                    <div className="min-w-0 text-sm">
                      <p className="truncate text-ink-700">{t.contact_name || "Sem responsável"}</p>
                      <p
                        className="mt-1 truncate text-xs text-ink-500"
                        title={t.contact_email ?? undefined}
                      >
                        {t.contact_email || "E-mail não informado"}
                      </p>
                    </div>
                    <div>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2 xl:justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-ink-500"
                        disabled={statusMutation.isPending}
                        aria-label={`${t.status === "active" ? "Suspender" : "Reativar"} ${t.name}`}
                        onClick={() =>
                          statusMutation.mutate({
                            id: t.id,
                            status: t.status === "active" ? "suspended" : "active",
                          })
                        }
                      >
                        {statusMutation.isPending && statusMutation.variables?.id === t.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : null}
                        {t.status === "active" ? "Suspender" : "Reativar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0 rounded-lg"
                        asChild
                      >
                        <Link
                          to="/admin/$tenantId"
                          params={{ tenantId: t.id }}
                          aria-label={`Gerenciar ${t.name}`}
                        >
                          <ArrowUpRight className="size-4" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-200 bg-base-50/70 px-4 py-2.5">
                <p className="text-xs text-ink-500" role="status">
                  Mostrando {(paginaAtual - 1) * 10 + 1}–
                  {Math.min(paginaAtual * 10, filtrados.length)} de {filtrados.length} clientes
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-500">
                    Página {paginaAtual} de {paginas}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Página anterior"
                    disabled={paginaAtual === 1}
                    onClick={() => setPagina(paginaAtual - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Próxima página"
                    disabled={paginaAtual === paginas}
                    onClick={() => setPagina(paginaAtual + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Cartao>

        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl bg-card p-6 sm:p-8">
          <DialogHeader>
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <Building2 className="size-5" aria-hidden />
            </span>
            <DialogTitle className="font-display text-2xl text-purple-800">
              Novo cliente
            </DialogTitle>
            <DialogDescription>
              Comece pelos dados do cliente. Depois, configure seus acessos e integrações.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome do cliente <span className="text-ink-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex.: Restaurante Central"
                minLength={2}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(toSlug(e.target.value));
                }}
                className="h-11 rounded-lg bg-base-50"
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
                className="h-11 rounded-lg bg-base-50"
                required
              />
              <p className="text-xs text-ink-500">Letras minúsculas, números e hífen.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Responsável</Label>
              <Input
                id="contactName"
                placeholder="Nome de quem cuida da operação"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-11 rounded-lg bg-base-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">E-mail do responsável</Label>
              <Input
                id="contactEmail"
                placeholder="contato@empresa.com.br"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="h-11 rounded-lg bg-base-50"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Criando…" : "Criar cliente"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
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
