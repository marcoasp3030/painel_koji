import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppShell } from "@/components/luxtia/AppShell";
import { Eyebrow, GoldRule } from "@/components/luxtia/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_NAV, TENANT_NAV } from "@/lib/nav";
import { getMe, listAuditLogs, listTenants } from "@/lib/platform.functions";

const searchSchema = z.object({
  tenantId: z.string().uuid().optional(),
  actor: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/auditoria")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Auditoria · Histórico de ações da plataforma Luxtia" },
      {
        name: "description",
        content:
          "Acompanhe quem fez o quê na plataforma Luxtia: criação de clientes, acessos, mudanças de integração e testes de conexão.",
      },
      { property: "og:title", content: "Auditoria · Luxtia" },
      {
        property: "og:description",
        content: "Histórico de ações administrativas e testes de conexão da plataforma Luxtia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auditoria,
});

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Auditoria() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const fetchMe = useServerFn(getMe);
  const fetchLogs = useServerFn(listAuditLogs);
  const fetchTenants = useServerFn(listTenants);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const isSuperAdmin = Boolean(me?.isSuperAdmin);

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => fetchTenants(),
    enabled: isSuperAdmin,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", search],
    queryFn: () => fetchLogs({ data: search }),
  });

  // Os filtros vivem na URL: recarregar ou compartilhar o link mantém a busca.
  const setFilter = (patch: Record<string, string | undefined>) =>
    navigate({
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev, ...patch };
        for (const key of Object.keys(next)) {
          if (!next[key]) delete next[key];
        }
        return next;
      },
      replace: true,
    });

  const hasFilters = Object.values(search).some(Boolean);

  return (
    <AppShell
      nav={isSuperAdmin ? ADMIN_NAV : TENANT_NAV}
      context={isSuperAdmin ? "Super Admin" : (me?.tenant?.name ?? "Cliente")}
    >
      <Eyebrow>Auditoria</Eyebrow>
      <h1 className="mt-2 font-display text-4xl text-purple-800">Histórico de ações</h1>
      <p className="mt-3 max-w-xl text-ink-500">
        {isSuperAdmin
          ? "Todas as ações administrativas, testes de conexão e bloqueios de segurança da plataforma."
          : "Ações e testes de conexão realizados no seu negócio."}
      </p>
      <GoldRule className="mt-5" />

      <div className="mt-8 grid gap-4 rounded-lg border border-base-200 bg-card p-5 md:grid-cols-2 lg:grid-cols-5">
        {isSuperAdmin ? (
          <div className="space-y-2">
            <Label htmlFor="f-tenant">Cliente</Label>
            <select
              id="f-tenant"
              value={search.tenantId ?? ""}
              onChange={(e) => setFilter({ tenantId: e.target.value || undefined })}
              className="h-10 w-full rounded-md border border-base-200 bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              {(tenants ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="f-actor">Usuário</Label>
          <Input
            id="f-actor"
            placeholder="e-mail ou parte dele"
            defaultValue={search.actor ?? ""}
            onBlur={(e) => setFilter({ actor: e.target.value.trim() || undefined })}
            onKeyDown={(e) => {
              if (e.key === "Enter") setFilter({ actor: e.currentTarget.value.trim() || undefined });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-action">Tipo de ação</Label>
          <select
            id="f-action"
            value={search.action ?? ""}
            onChange={(e) => setFilter({ action: e.target.value || undefined })}
            className="h-10 w-full rounded-md border border-base-200 bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            {(data?.actions ?? []).map((a: string) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-from">De</Label>
          <Input
            id="f-from"
            type="date"
            value={search.from ?? ""}
            onChange={(e) => setFilter({ from: e.target.value || undefined })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-to">Até</Label>
          <Input
            id="f-to"
            type="date"
            value={search.to ?? ""}
            onChange={(e) => setFilter({ to: e.target.value || undefined })}
          />
        </div>
      </div>

      {hasFilters ? (
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => navigate({ search: {}, replace: true })}
          >
            Limpar filtros
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="mt-10 text-ink-500">Carregando…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="mt-10 text-ink-500">
          {hasFilters
            ? "Nenhum registro para os filtros escolhidos."
            : "Nenhum registro por enquanto."}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-base-200 bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-base-200 text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Quando</th>
                {isSuperAdmin ? <th className="px-4 py-3 font-medium">Cliente</th> : null}
                <th className="px-4 py-3 font-medium">Quem</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Detalhe</th>
                <th className="px-4 py-3 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row: any) => (
                <tr key={row.id} className="border-b border-base-200 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500">
                    {formatDate(row.created_at)}
                  </td>
                  {isSuperAdmin ? (
                    <td className="px-4 py-3">{row.tenant_name ?? "—"}</td>
                  ) : null}
                  <td className="px-4 py-3">{row.actor_email ?? "—"}</td>
                  <td className="px-4 py-3 text-purple-800">
                    {row.action}
                    {row.target ? <span className="text-ink-500"> · {row.target}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-ink-500">{row.detail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === "alerta"
                          ? "rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-950"
                          : row.status === "success"
                            ? "rounded-full border border-base-200 px-2.5 py-1 text-xs text-purple-800"
                            : "rounded-full border border-destructive/40 px-2.5 py-1 text-xs text-destructive"
                      }
                    >
                      {row.status === "alerta" ? "Alerta" : row.status === "success" ? "Concluída" : "Falhou"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
