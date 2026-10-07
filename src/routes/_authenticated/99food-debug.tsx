import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/luxtia/AppShell";
import { Eyebrow, GoldRule } from "@/components/luxtia/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { ADMIN_NAV, TENANT_NAV } from "@/lib/nav";
import {
  getMe,
  listIntegrationRequestLogs,
  listTenants,
  listWebhookEvents,

  runFood99Test,
} from "@/lib/platform.functions";

const searchSchema = z.object({ tenantId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/99food-debug")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Debug do 99Food · histórico de chamadas | Luxtia" },
      {
        name: "description",
        content:
          "Acompanhe as chamadas feitas ao 99Food: endereço, dados enviados, resposta, código HTTP e tempo de resposta por cliente.",
      },
      { property: "og:title", content: "Debug do 99Food · Luxtia" },
      {
        property: "og:description",
        content: "Histórico técnico das chamadas do 99Food para diagnóstico rápido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Food99DebugPage,
  errorComponent: () => (
    <AppShell nav={TENANT_NAV} context="Cliente">
      <p className="text-sm text-ink-700">Não foi possível carregar o histórico agora.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell nav={TENANT_NAV} context="Cliente">
      <p className="text-sm text-ink-700">Página não encontrada.</p>
    </AppShell>
  ),
});

type LogRow = {
  id: string;
  action: string;
  method: string;
  url: string;
  request_payload: unknown;
  response_body: string | null;
  http_status: number | null;
  duration_ms: number | null;
  ok: boolean;
  error_detail: string | null;
  actor_email: string | null;
  created_at: string;
};

function Food99DebugPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const fetchMe = useServerFn(getMe);
  const fetchTenants = useServerFn(listTenants);
  const list = useServerFn(listIntegrationRequestLogs);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const isSuperAdmin = Boolean(me?.isSuperAdmin);
  const selectedTenantId = search.tenantId;

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => fetchTenants(),
    enabled: isSuperAdmin,
  });

  const selectedName =
    (tenants ?? []).find((t: any) => t.id === selectedTenantId)?.name ??
    me?.tenant?.name ??
    (isSuperAdmin ? "Super Admin" : "Cliente");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["food99-logs", onlyErrors, selectedTenantId ?? "self"],
    queryFn: () =>
      list({ data: { provider: "food99" as const, onlyErrors, tenantId: selectedTenantId } }),
  });

  const items = (data?.items ?? []) as LogRow[];

  return (
    <AppShell nav={isSuperAdmin ? ADMIN_NAV : TENANT_NAV} context={selectedName}>
      <Eyebrow>Diagnóstico</Eyebrow>
      <h1 className="mt-2 font-display text-3xl text-purple-800">Debug do 99Food</h1>
      <GoldRule className="mt-3" />
      <p className="mt-4 max-w-2xl text-sm text-ink-700">
        Cada verificação feita com o 99Food fica registrada aqui: o endereço chamado, os dados
        enviados (com segredos ocultos), a resposta recebida, o código de retorno e o tempo que o
        99Food levou para responder.
      </p>

      {isSuperAdmin ? (
        <div className="mt-6 max-w-sm space-y-2 rounded-lg border border-base-200 bg-card p-5">
          <Label htmlFor="debug-tenant-99">Cliente</Label>
          <select
            id="debug-tenant-99"
            value={selectedTenantId ?? ""}
            onChange={(e) =>
              navigate({ search: { tenantId: e.target.value || undefined }, replace: true })
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
        </div>
      ) : null}

      <TestCenter tenantId={selectedTenantId} onDone={() => refetch()} />

      <h2 className="mt-10 font-display text-2xl text-purple-800">Histórico de chamadas</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setOnlyErrors((v) => !v)}>
          {onlyErrors ? "Mostrar tudo" : "Só falhas"}
        </Button>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? <p className="text-sm text-ink-500">Carregando…</p> : null}
        {error ? (
          <p className="text-sm text-destructive">Não foi possível carregar o histórico agora.</p>
        ) : null}
        {!isLoading && !error && data && !data.tenantId ? (
          <p className="text-sm text-ink-700">
            Escolha um cliente acima para ver o histórico de chamadas.
          </p>
        ) : null}
        {!isLoading && !error && data?.tenantId && items.length === 0 ? (
          <p className="text-sm text-ink-700">
            Nenhuma chamada registrada ainda. Use “Testar conexão” na tela de Integrações.
          </p>
        ) : null}

        {items.map((row) => (
          <div key={row.id} className="rounded-lg border border-base-200 bg-card p-4">
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
              onClick={() => setOpenId((id) => (id === row.id ? null : row.id))}
            >
              <span>
                <span className="block font-display text-lg text-purple-800">{row.action}</span>
                <span className="mt-1 block text-xs text-ink-500">
                  {new Date(row.created_at).toLocaleString("pt-BR")}
                  {row.actor_email ? ` · ${row.actor_email}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs">
                <span className="rounded-full border border-base-200 px-3 py-1 text-ink-700">
                  {row.method}
                </span>
                <span
                  className={
                    row.ok
                      ? "rounded-full border border-gold-500/40 px-3 py-1 text-purple-800"
                      : "rounded-full border border-destructive/30 px-3 py-1 text-destructive"
                  }
                >
                  {row.http_status ? `HTTP ${row.http_status}` : "Sem resposta"}
                </span>
                <span className="text-ink-500">
                  {row.duration_ms != null ? `${(row.duration_ms / 1000).toFixed(1)}s` : "—"}
                </span>
              </span>
            </button>

            {openId === row.id ? (
              <div className="mt-4 space-y-3 border-t border-base-200 pt-4 text-xs">
                <div>
                  <p className="text-ink-500">Endereço</p>
                  <p className="mt-1 break-all text-ink-700">{row.url}</p>
                </div>
                <div>
                  <p className="text-ink-500">Dados enviados</p>
                  <pre className="mt-1 overflow-x-auto rounded-md bg-base-100 p-3 text-ink-700">
                    {row.request_payload ? JSON.stringify(row.request_payload, null, 2) : "—"}
                  </pre>
                </div>
                <div>
                  <p className="text-ink-500">Resposta</p>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-base-100 p-3 text-ink-700">
                    {row.response_body || "—"}
                  </pre>
                </div>
                {row.error_detail ? (
                  <div>
                    <p className="text-ink-500">Detalhe da falha</p>
                    <p className="mt-1 text-destructive">{row.error_detail}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <WebhookEvents tenantId={selectedTenantId} />
    </AppShell>
  );
}

/** Eventos recebidos pelo webhook da 99Food, guardados como chegaram. */
function WebhookEvents({ tenantId }: { tenantId?: string | undefined }) {
  const fetchEvents = useServerFn(listWebhookEvents);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["webhook-events", tenantId ?? "self"],
    queryFn: () => fetchEvents({ data: { tenantId, platform: "99food" } }),
    retry: false,
  });
  const items = (data?.items ?? []) as any[];

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-purple-800">Eventos recebidos do webhook</h2>
        <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>
      <p className="mt-2 text-sm text-ink-500">
        Cada evento enviado pela 99Food é guardado por inteiro, com o horário informado por ela e o
        horário em que chegou aqui.
      </p>

      {items.length === 0 ? (
        <p className="mt-6 text-ink-500">
          Nenhum evento recebido até agora. Cadastre a URL de webhook no painel da 99Food e crie um
          pedido de teste.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((row) => (
            <div key={row.id} className="rounded-lg border border-base-200 bg-card p-4">
              <button
                type="button"
                onClick={() => setOpenId(openId === row.id ? null : row.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-left text-sm"
              >
                <span className="text-ink-700">
                  <span className="font-medium text-purple-800">
                    {row.event_type || row.status_original || "Evento"}
                  </span>
                  {row.order_id ? ` · Pedido ${row.order_id}` : ""}
                </span>
                <span className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  {row.event_time ? (
                    <span>Na 99Food: {new Date(row.event_time).toLocaleString("pt-BR")}</span>
                  ) : null}
                  <span>Recebido: {new Date(row.received_at).toLocaleString("pt-BR")}</span>
                </span>
              </button>
              {openId === row.id ? (
                <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-base-100 p-3 text-xs text-ink-700">
                  {JSON.stringify(row.payload_original, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


type TestAction = "auth" | "store" | "status" | "polling" | "order" | "reviews";

type TestResult = {
  ok: boolean;
  message: string;
  action: TestAction;
  durationMs: number;
  checkedAt: string;
  calls: {
    label: string;
    method: string;
    url: string;
    ok: boolean;
    status: number | null;
    durationMs: number;
    detail: string;
    body: unknown;
  }[];
  merchant?: any;
  merchantStatus?: any;
  events?: any[];
  orders?: any[];
  reviews?: any[];
};

const TEST_BUTTONS: { action: TestAction; label: string }[] = [
  { action: "auth", label: "Testar autenticação" },
  { action: "store", label: "Loja e funcionamento" },
  { action: "polling", label: "Pedidos recentes" },
  { action: "reviews", label: "Avaliações" },
];

function money(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
}

function toTime(v: unknown): number | null {
  if (!v) return null;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : null;
}

type StepState = {
  key: string;
  label: string;
  status: "pending" | "running" | "ok" | "error" | "skipped";
  result?: TestResult;
  note?: string;
};

const STEP_PLAN: { key: TestAction | "order"; label: string }[] = [
  { key: "auth", label: "1. Validação do App ID e App Secret" },
  { key: "store", label: "2. Loja e status de funcionamento" },
  { key: "polling", label: "3. Pedidos recentes (polling)" },
  { key: "order", label: "4. Detalhes de um pedido" },
  { key: "reviews", label: "5. Avaliações" },
];

/** Central de testes interativos da integração com o 99Food. */
function TestCenter({ tenantId, onDone }: { tenantId?: string | undefined; onDone: () => void }) {
  const run = useServerFn(runFood99Test);
  const [orderId, setOrderId] = useState("");
  const [tab, setTab] = useState<"resumo" | "pedidos" | "avaliacoes" | "loja" | "json">("resumo");
  const [result, setResult] = useState<TestResult | null>(null);
  const [pending, setPending] = useState<TestAction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState[] | null>(null);
  const [e2eRunning, setE2eRunning] = useState(false);
  const [openStep, setOpenStep] = useState<string | null>(null);

  const busy = pending !== null || e2eRunning;

  const call = (action: TestAction, id?: string) =>
    run({ data: { tenantId, action, orderId: id } }) as Promise<TestResult>;

  async function runSingle(action: TestAction, id?: string) {
    setPending(action);
    setErrorMsg(null);
    setResult(null);
    setSteps(null);
    try {
      const r = await call(action, id);
      setResult(r);
      setTab(
        r.action === "polling" || r.action === "order"
          ? "pedidos"
          : r.action === "reviews"
            ? "avaliacoes"
            : r.action === "store" || r.action === "status"
              ? "loja"
              : "resumo",
      );
      onDone();
    } catch (e) {
      setErrorMsg((e as Error).message || "Não foi possível executar o teste agora.");
    } finally {
      setPending(null);
    }
  }

  /** Executa todas as etapas do fluxo em sequência, atualizando o painel em tempo real. */
  async function runEndToEnd() {
    setE2eRunning(true);
    setErrorMsg(null);
    setResult(null);
    setOpenStep(null);
    let current: StepState[] = STEP_PLAN.map((s) => ({
      key: s.key,
      label: s.label,
      status: "pending" as const,
    }));
    setSteps(current);

    const update = (key: string, patch: Partial<StepState>) => {
      current = current.map((s) => (s.key === key ? { ...s, ...patch } : s));
      setSteps(current);
    };

    const merged: TestResult = {
      ok: true,
      message: "Fluxo ponta a ponta concluído.",
      action: "auth",
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      calls: [],
      orders: [],
      reviews: [],
    };

    let discoveredOrderId = orderId.trim();
    const startedAt = Date.now();

    for (const step of STEP_PLAN) {
      if (step.key === "order" && !discoveredOrderId) {
        update("order", {
          status: "skipped",
          note: "Nenhum pedido informado e nenhum pedido retornado pelo polling.",
        });
        continue;
      }
      update(step.key, { status: "running" });
      try {
        const r = await call(step.key as TestAction, step.key === "order" ? discoveredOrderId : undefined);
        merged.calls.push(...r.calls);
        if (r.orders?.length) merged.orders = [...(merged.orders ?? []), ...r.orders];
        if (r.reviews?.length) merged.reviews = [...(merged.reviews ?? []), ...r.reviews];
        if (r.merchant) merged.merchant = r.merchant;
        if (r.merchantStatus) merged.merchantStatus = r.merchantStatus;
        if (step.key === "polling" && !discoveredOrderId) {
          const first = (r.orders ?? [])[0] ?? (r.events ?? [])[0];
          const id = first?.id ?? first?.orderId ?? "";
          if (id) discoveredOrderId = String(id);
        }
        update(step.key, { status: r.ok ? "ok" : "error", result: r });
        if (!r.ok) merged.ok = false;
        if (step.key === "auth" && !r.ok) {
          for (const rest of STEP_PLAN.slice(1)) {
            update(rest.key, { status: "skipped", note: "Etapa não executada: a autenticação falhou." });
          }
          break;
        }
      } catch (e) {
        merged.ok = false;
        update(step.key, {
          status: "error",
          note: (e as Error).message || "Falha ao executar esta etapa.",
        });
      }
    }

    merged.durationMs = Date.now() - startedAt;
    merged.message = merged.ok
      ? "Fluxo ponta a ponta concluído com sucesso."
      : "Fluxo ponta a ponta concluído com falhas em uma ou mais etapas.";
    setResult(merged);
    setTab("resumo");
    setE2eRunning(false);
    onDone();
  }

  return (
    <section className="mt-8 rounded-lg border border-base-200 bg-card p-6">
      <Eyebrow>Central de testes</Eyebrow>
      <h2 className="mt-2 font-display text-2xl text-purple-800">Testes interativos do 99Food</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-700">
        Cada botão faz uma chamada real ao 99Food usando as credenciais salvas deste cliente e
        registra tudo no histórico abaixo.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => runEndToEnd()}>
          {e2eRunning ? "Executando fluxo…" : "Executar teste ponta a ponta"}
        </Button>
        {TEST_BUTTONS.map((b) => (
          <Button
            key={b.action}
            variant="outline"
            disabled={busy}
            onClick={() => runSingle(b.action)}
          >
            {pending === b.action ? "Testando…" : b.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="order-id-99">Número do pedido</Label>
          <Input
            id="order-id-99"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="ID do pedido no 99Food"
            className="w-72"
          />
        </div>
        <Button
          variant="outline"
          disabled={busy || orderId.trim().length === 0}
          onClick={() => runSingle("order", orderId.trim())}
        >
          {pending === "order" ? "Consultando…" : "Consultar pedido"}
        </Button>
      </div>

      {errorMsg ? <p className="mt-4 text-sm text-destructive">{errorMsg}</p> : null}

      {steps ? (
        <div className="mt-6 border-t border-base-200 pt-5">
          <h3 className="font-display text-xl text-purple-800">Progresso do fluxo</h3>
          <div className="mt-3 space-y-2">
            {steps.map((s) => (
              <div key={s.key} className="rounded-md border border-base-200">
                <button
                  type="button"
                  onClick={() => setOpenStep((k) => (k === s.key ? null : s.key))}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-3 text-sm">
                    <span
                      aria-hidden
                      className={
                        s.status === "ok"
                          ? "text-success"
                          : s.status === "error"
                            ? "text-destructive"
                            : "text-ink-500"
                      }
                    >
                      {s.status === "ok"
                        ? "✓"
                        : s.status === "error"
                          ? "✕"
                          : s.status === "running"
                            ? "•••"
                            : s.status === "skipped"
                              ? "–"
                              : "○"}
                    </span>
                    <span className="text-ink-700">{s.label}</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-ink-500">
                    {s.status === "running" ? <span>Executando…</span> : null}
                    {s.result ? (
                      <>
                        <span className={s.result.ok ? "text-purple-800" : "text-destructive"}>
                          {s.result.calls[s.result.calls.length - 1]?.status
                            ? `HTTP ${s.result.calls[s.result.calls.length - 1]?.status}`
                            : "Sem resposta"}
                        </span>
                        <span>{(s.result.durationMs / 1000).toFixed(1)}s</span>
                      </>
                    ) : null}
                  </span>
                </button>
                {openStep === s.key ? (
                  <div className="space-y-3 border-t border-base-200 px-4 py-3 text-xs">
                    {s.note ? <p className="text-ink-700">{s.note}</p> : null}
                    {s.result ? (
                      <>
                        <p className={s.result.ok ? "text-ink-700" : "text-destructive"}>
                          {s.result.message}
                        </p>
                        {s.result.calls.map((c, i) => (
                          <div key={i}>
                            <p className="text-ink-500">
                              {c.label} · {c.method} {c.url} ·{" "}
                              {c.status ? `HTTP ${c.status}` : "Sem resposta"} ·{" "}
                              {(c.durationMs / 1000).toFixed(1)}s
                            </p>
                            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-base-100 p-3 text-ink-700">
                              {JSON.stringify(c.body, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 border-t border-base-200 pt-5">
          <div
            className={
              result.ok
                ? "rounded-md border border-success/30 bg-success-soft px-4 py-3 text-sm text-success"
                : "rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive"
            }
          >
            <span className="font-medium">{result.ok ? "Tudo certo" : "Não deu certo"}</span> ·{" "}
            {result.message}
            <span className="ml-1 text-ink-500">
              ({(result.durationMs / 1000).toFixed(1)}s ·{" "}
              {new Date(result.checkedAt).toLocaleString("pt-BR")})
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                ["resumo", "Resumo"],
                ["pedidos", "Pedidos"],
                ["avaliacoes", "Avaliações"],
                ["loja", "Status da loja"],
                ["json", "Resposta técnica"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={
                  tab === key
                    ? "rounded-full border border-gold-500/50 px-4 py-1.5 text-xs text-purple-800"
                    : "rounded-full border border-base-200 px-4 py-1.5 text-xs text-ink-500"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 text-sm">
            {tab === "resumo" ? (
              <ul className="space-y-2">
                {result.calls.map((c, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base-200 px-4 py-3"
                  >
                    <span className="text-ink-700">{c.label}</span>
                    <span className="flex items-center gap-3 text-xs">
                      <span className="rounded-full border border-base-200 px-3 py-1 text-ink-700">
                        {c.method}
                      </span>
                      <span className={c.ok ? "text-purple-800" : "text-destructive"}>
                        {c.status ? `HTTP ${c.status}` : "Sem resposta"}
                      </span>
                      <span className="text-ink-500">{(c.durationMs / 1000).toFixed(1)}s</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "pedidos" ? <OrdersTab orders={result.orders ?? []} /> : null}

            {tab === "avaliacoes" ? <ReviewsTab reviews={result.reviews ?? []} /> : null}

            {tab === "loja" ? (
              result.merchant ? (
                <div className="rounded-md border border-base-200 p-4">
                  <p className="font-display text-lg text-purple-800">
                    {result.merchant?.name ?? "Loja"}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {result.merchant?.address?.city ?? ""} {result.merchant?.address?.state ?? ""}
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-ink-700">
                    {(Array.isArray(result.merchantStatus)
                      ? result.merchantStatus
                      : result.merchantStatus
                        ? [result.merchantStatus]
                        : []
                    ).map((s: any, i: number) => (
                      <p key={i}>
                        {s?.operation ?? "Operação"}:{" "}
                        {s?.available === true
                          ? "Aberta agora"
                          : s?.available === false
                            ? "Fechada"
                            : (s?.state ?? "—")}
                        {s?.message?.title ? ` · ${s.message.title}` : ""}
                      </p>
                    ))}
                    {!result.merchantStatus ? <p>Status de funcionamento indisponível.</p> : null}
                  </div>
                </div>
              ) : (
                <p className="text-ink-700">
                  Use “Loja e funcionamento” para carregar os dados da loja.
                </p>
              )
            ) : null}

            {tab === "json" ? (
              <div className="space-y-3">
                {result.calls.map((c, i) => (
                  <div key={i}>
                    <p className="text-xs text-ink-500">
                      {c.label} · {c.method} {c.url}
                    </p>
                    <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-base-100 p-3 text-xs text-ink-700">
                      {JSON.stringify(c.body, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Barra de paginação reutilizável. */
function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-500">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span>
        Página {Math.min(page, pages)} de {pages} · {total} item(ns)
      </span>
      <Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Próxima
      </Button>
      <select
        value={pageSize}
        onChange={(e) => {
          onPageSize(Number(e.target.value));
          onPage(1);
        }}
        className="h-9 rounded-md border border-base-200 bg-background px-2 text-xs"
        aria-label="Itens por página"
      >
        {[5, 10, 20, 50].map((n) => (
          <option key={n} value={n}>
            {n} por página
          </option>
        ))}
      </select>
    </div>
  );
}

/** Aba de pedidos com filtro por período, ordenação e paginação. */
function OrdersTab({ orders }: { orders: any[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"recent" | "old" | "status">("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toT = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const list = orders.filter((o) => {
      const t = toTime(o?.createdAt ?? o?.orderTiming ?? o?.createdAtUTC);
      if (fromT != null && (t == null || t < fromT)) return false;
      if (toT != null && (t == null || t > toT)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "status")
        return String(a?.orderStatus ?? a?.status ?? "").localeCompare(
          String(b?.orderStatus ?? b?.status ?? ""),
        );
      const ta = toTime(a?.createdAt) ?? 0;
      const tb = toTime(b?.createdAt) ?? 0;
      return sort === "recent" ? tb - ta : ta - tb;
    });
  }, [orders, from, to, sort]);

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-base-200 p-4">
        <div className="space-y-1">
          <Label htmlFor="ord99-from" className="text-xs">
            De
          </Label>
          <Input
            id="ord99-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ord99-to" className="text-xs">
            Até
          </Label>
          <Input
            id="ord99-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ord99-sort" className="text-xs">
            Ordenar por
          </Label>
          <select
            id="ord99-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-10 rounded-md border border-base-200 bg-background px-3 text-sm"
          >
            <option value="recent">Mais recentes</option>
            <option value="old">Mais antigos</option>
            <option value="status">Situação</option>
          </select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setFrom("");
            setTo("");
            setSort("recent");
            setPage(1);
          }}
        >
          Limpar filtros
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-ink-700">Nenhum pedido para mostrar com esses filtros.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((o: any, i: number) => (
            <div key={i} className="rounded-md border border-base-200 p-4">
              <p className="font-display text-lg text-purple-800">
                Pedido {o?.displayId ?? o?.id ?? "—"}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {o?.customer?.name ?? "Cliente não informado"} ·{" "}
                {o?.orderType ?? o?.salesChannel ?? "—"} ·{" "}
                {money(o?.total?.orderAmount ?? o?.total?.subTotal)}
                {o?.createdAt ? ` · ${new Date(o.createdAt).toLocaleString("pt-BR")}` : ""}
              </p>
              <p className="mt-2 text-xs text-ink-700">
                Situação: {o?.orderStatus ?? o?.status ?? "—"}
              </p>
              {Array.isArray(o?.items) ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-ink-700">
                  {o.items.slice(0, 8).map((it: any, k: number) => (
                    <li key={k}>
                      {it?.quantity ?? 1}× {it?.name ?? "item"}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Pager
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={setPageSize}
      />
    </div>
  );
}

/** Aba de avaliações com filtro por período e nota, ordenação e paginação. */
function ReviewsTab({ reviews }: { reviews: any[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [score, setScore] = useState("");
  const [sort, setSort] = useState<"recent" | "high" | "low">("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toT = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const list = reviews.filter((r) => {
      const t = toTime(r?.createdAt);
      if (fromT != null && (t == null || t < fromT)) return false;
      if (toT != null && (t == null || t > toT)) return false;
      if (score && Number(r?.score) !== Number(score)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "high") return Number(b?.score ?? 0) - Number(a?.score ?? 0);
      if (sort === "low") return Number(a?.score ?? 0) - Number(b?.score ?? 0);
      return (toTime(b?.createdAt) ?? 0) - (toTime(a?.createdAt) ?? 0);
    });
  }, [reviews, from, to, score, sort]);

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-base-200 p-4">
        <div className="space-y-1">
          <Label htmlFor="rev99-from" className="text-xs">
            De
          </Label>
          <Input
            id="rev99-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rev99-to" className="text-xs">
            Até
          </Label>
          <Input
            id="rev99-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rev99-score" className="text-xs">
            Nota
          </Label>
          <select
            id="rev99-score"
            value={score}
            onChange={(e) => {
              setScore(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-base-200 bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} estrela{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rev99-sort" className="text-xs">
            Ordenar por
          </Label>
          <select
            id="rev99-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-10 rounded-md border border-base-200 bg-background px-3 text-sm"
          >
            <option value="recent">Mais recentes</option>
            <option value="high">Maior nota</option>
            <option value="low">Menor nota</option>
          </select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setFrom("");
            setTo("");
            setScore("");
            setSort("recent");
            setPage(1);
          }}
        >
          Limpar filtros
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-ink-700">Nenhuma avaliação para mostrar com esses filtros.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((r: any, i: number) => (
            <div key={i} className="rounded-md border border-base-200 p-4">
              <p className="font-display text-lg text-purple-800">
                {r?.score != null ? `${r.score} de 5` : "Avaliação"}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {r?.customerName ?? r?.customer?.name ?? "Cliente"} ·{" "}
                {r?.createdAt ? new Date(r.createdAt).toLocaleString("pt-BR") : "—"}
              </p>
              {r?.comment ? (
                <p className="mt-2 text-ink-700">“{r.comment}”</p>
              ) : (
                <p className="mt-2 text-ink-500">Sem comentário escrito.</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Pager
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={setPageSize}
      />
    </div>
  );
}
