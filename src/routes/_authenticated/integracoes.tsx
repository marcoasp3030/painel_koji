import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/luxtia/AppShell";
import { Eyebrow, GoldRule } from "@/components/luxtia/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { ADMIN_NAV, TENANT_NAV } from "@/lib/nav";
import { PROVIDER_BY_KEY, PROVIDERS, type ProviderKey } from "@/lib/providers";
import {
  getMe,
  listIntegrations,
  listTenants,
  saveIntegration,
  testIntegration,
} from "@/lib/platform.functions";

const searchSchema = z.object({ tenantId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/integracoes")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Integrações · iFood, 99Food, WhatsApp e Uazapi | Luxtia" },
      {
        name: "description",
        content:
          "Configure as credenciais das integrações de delivery e mensagens do seu negócio na plataforma Luxtia.",
      },
      { property: "og:title", content: "Integrações · Luxtia" },
      {
        property: "og:description",
        content: "Configuração das integrações de delivery e mensagens do cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Integracoes,
});

function Integracoes() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const fetchIntegrations = useServerFn(listIntegrations);
  const fetchMe = useServerFn(getMe);
  const fetchTenants = useServerFn(listTenants);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const isSuperAdmin = Boolean(me?.isSuperAdmin);

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => fetchTenants(),
    enabled: isSuperAdmin,
  });

  const selectedTenantId = search.tenantId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations", selectedTenantId ?? "self"],
    queryFn: () => fetchIntegrations({ data: { tenantId: selectedTenantId } }),
    retry: false,
  });

  const selectedName =
    (tenants ?? []).find((t: any) => t.id === selectedTenantId)?.name ??
    me?.tenant?.name ??
    (isSuperAdmin ? "Super Admin" : "Cliente");

  return (
    <AppShell nav={isSuperAdmin ? ADMIN_NAV : TENANT_NAV} context={selectedName}>
      <Eyebrow>Integrações</Eyebrow>
      <h1 className="mt-2 font-display text-4xl text-purple-800">Conexões do seu negócio</h1>
      <p className="mt-3 max-w-xl text-ink-500">
        Cada serviço guarda suas credenciais no servidor. Deixe um campo protegido em branco para
        manter o valor já salvo.
      </p>
      <GoldRule className="mt-5" />

      {isSuperAdmin ? (
        <div className="mt-8 max-w-sm space-y-2 rounded-lg border border-base-200 bg-card p-5">
          <Label htmlFor="tenant-picker">Cliente</Label>
          <select
            id="tenant-picker"
            value={selectedTenantId ?? ""}
            onChange={(e) =>
              navigate({
                search: { tenantId: e.target.value || undefined },
                replace: true,
              })
            }
            className="h-10 w-full rounded-md border border-base-200 bg-background px-3 text-sm"
          >
            <option value="">Escolha um cliente…</option>
            {(tenants ?? []).map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-500">
            As credenciais mostradas abaixo pertencem ao cliente escolhido.
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <p className="mt-10 text-ink-500">Carregando…</p>
      ) : error || !data || !data.tenantId ? (
        <p className="mt-10 text-ink-500">
          Esta área pertence aos clientes da plataforma. Escolha um cliente na lista acima para ver
          suas conexões.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {data.items.map((item: any) => (
            <IntegrationCard
              key={`${data.tenantId}-${item.provider}`}
              tenantId={selectedTenantId}
              provider={item.provider}
              enabled={item.enabled}
              updatedAt={item.updatedAt}
              fields={item.fields}
              canEdit={data.canEdit}
              lastTestOk={item.lastTestOk ?? null}
              lastTestAt={item.lastTestAt ?? null}
              lastTestMessage={item.lastTestMessage ?? null}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function IntegrationCard({
  tenantId,
  provider,
  enabled,
  updatedAt,
  fields,
  canEdit,
  lastTestOk,
  lastTestAt,
  lastTestMessage,
}: {
  tenantId?: string | undefined;
  provider: ProviderKey;
  enabled: boolean;
  updatedAt: string | null;
  fields: Record<string, { value: string; filled: boolean; secret: boolean }>;
  canEdit: boolean;
  lastTestOk: boolean | null;
  lastTestAt: string | null;
  lastTestMessage: string | null;
}) {
  const def = PROVIDER_BY_KEY[provider];
  const queryClient = useQueryClient();
  const save = useServerFn(saveIntegration);
  const test = useServerFn(testIntegration);
  const [result, setResult] = useState<TestResult | null>(null);
  // A 99Food aceita 1 consulta por minuto: trava o botão durante esse intervalo.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(def.fields.map((f) => [f.key, f.secret ? "" : (fields[f.key]?.value ?? "")])),
  );
  const [status, setStatus] = useState<{
    ok: boolean | null;
    at: string | null;
    message: string | null;
  }>({ ok: lastTestOk, at: lastTestAt, message: lastTestMessage });

  const mutation = useMutation({
    mutationFn: () => save({ data: { tenantId, provider, enabled: isEnabled, values } }),
    onSuccess: () => {
      toast.success(`${def.name} salvo.`);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: { tenantId, provider } }),
    onMutate: () => {
      setResult(null);
      if (provider === "food99") setCooldown(60);
    },
    onSuccess: (r: TestResult) => {
      setResult(r);
      setStatus({ ok: r.ok, at: r.checkedAt ?? new Date().toISOString(), message: r.message });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    },
    onError: (e: Error) => {
      setResult({ ok: false, message: e.message });
      setStatus({ ok: false, at: new Date().toISOString(), message: e.message });
    },
  });

  const statusLabel =
    status.ok === true ? "Conexão OK" : status.ok === false ? "Conexão com falha" : "Não testada";
  const statusClass =
    status.ok === true
      ? "border-success/40 bg-success-soft text-success"
      : status.ok === false
        ? "border-destructive/40 bg-base-100 text-destructive"
        : "border-base-200 bg-base-100 text-ink-500";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="rounded-lg border border-base-200 bg-card p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-purple-800">{def.name}</h2>
          <p className="mt-1 text-xs uppercase tracking-wider text-ink-500">{def.category}</p>
          <p className="mt-3 text-sm text-ink-700">{def.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-500">{isEnabled ? "Ativa" : "Inativa"}</span>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} disabled={!canEdit} />
        </div>
      </div>

      <div
        className={`mt-4 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${statusClass}`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            status.ok === true
              ? "bg-success"
              : status.ok === false
                ? "bg-destructive"
                : "bg-ink-300"
          }`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{statusLabel}</span>
        {status.at ? (
          <span className="text-xs opacity-80">
            Última verificação: {new Date(status.at).toLocaleString("pt-BR")}
          </span>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        {def.fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`${provider}-${field.key}`}>{field.label}</Label>
            {field.options ? (
              <select
                id={`${provider}-${field.key}`}
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                disabled={!canEdit}
                aria-describedby={field.help ? `${provider}-${field.key}-help` : undefined}
                className="h-10 w-full rounded-md border border-base-200 bg-background px-3 text-sm"
              >
                <option value="">Escolha…</option>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={`${provider}-${field.key}`}
                type={field.secret ? "password" : "text"}
                value={values[field.key] ?? ""}
                placeholder={
                  field.secret
                    ? fields[field.key]?.filled
                      ? `Salvo (${fields[field.key]?.value})`
                      : "Não configurado"
                    : (field.placeholder ?? "")
                }
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                disabled={!canEdit}
                autoComplete="off"
                aria-describedby={field.help ? `${provider}-${field.key}-help` : undefined}
              />
            )}
            {field.help ? (
              <p id={`${provider}-${field.key}-help`} className="text-xs text-ink-500">
                {field.help}
              </p>
            ) : null}
          </div>
        ))}

        {provider === "food99" ? <WebhookUrl provider={provider} /> : null}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-ink-500">
          {updatedAt
            ? `Atualizado em ${new Date(updatedAt).toLocaleString("pt-BR")}`
            : "Ainda não configurado"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || cooldown > 0}
          >
            {testMutation.isPending
              ? "Testando…"
              : cooldown > 0
                ? `Aguarde ${cooldown}s`
                : "Testar conexão"}
          </Button>
          {canEdit ? (
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          ) : null}
        </div>
      </div>

      {result ? (
        <p
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            result.ok
              ? "border-gold-500/40 bg-base-100 text-purple-800"
              : "border-destructive/30 bg-base-100 text-destructive"
          }`}
        >
          <span>{result.message}</span>
          {typeof result.durationMs === "number" ? (
            <span className="mt-1 block text-xs text-ink-500">
              Tempo de resposta: {(result.durationMs / 1000).toFixed(1)}s
            </span>
          ) : null}
          {result.steps?.length ? (
            <span className="mt-3 block space-y-1">
              {result.steps.map((step, i) => (
                <span key={i} className="block text-xs text-ink-700">
                  {step.ok ? "OK" : "Falhou"} · {step.label}
                  {step.status ? ` · HTTP ${step.status}` : ""} · {(step.durationMs / 1000).toFixed(1)}s
                </span>
              ))}
            </span>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}

/** URL de webhook do sistema, somente leitura, para cadastrar no painel da 99Food. */
function WebhookUrl({ provider }: { provider: ProviderKey }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = origin ? `${origin}/api/public/${provider}/webhook` : "";

  return (
    <div className="space-y-2 rounded-md border border-base-200 bg-base-100 p-4">
      <Label htmlFor={`${provider}-webhook`}>URL de Webhook (somente leitura)</Label>
      <div className="flex gap-2">
        <Input id={`${provider}-webhook`} value={url} readOnly onFocus={(e) => e.target.select()} />
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Endereço copiado.");
            } catch {
              toast.error("Não foi possível copiar. Selecione e copie manualmente.");
            }
          }}
        >
          Copiar
        </Button>
      </div>
      <p className="text-xs text-ink-500">
        Cadastre este endereço no painel da 99Food para receber eventos em tempo real. As
        assinaturas dos webhooks usam o próprio App Secret.
      </p>
    </div>
  );
}

type TestResult = {
  ok: boolean;
  message: string;
  durationMs?: number;
  checkedAt?: string;
  steps?: { label: string; ok: boolean; status: number | null; durationMs: number; detail: string }[];
};

export const PROVIDER_COUNT = PROVIDERS.length;
