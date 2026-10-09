/**
 * Integração: um usuário comum não altera tenants.gateway_tenant_id pela API REST.
 * Cria um membro temporário (admin da empresa koji), tenta alterar a coluna e
 * remove o membro no fim. Só roda com a stack no ar:
 *
 *   docker run --rm --network painel_koji_interno --env-file .env \
 *     -e PAINEL_REST_URL=http://api-rest:3000 -v "$PWD":/app:ro -w /app \
 *     oven/bun:1 bun test tests/integracao
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const REST = process.env["PAINEL_REST_URL"];
const JWT_SECRET = process.env["JWT_SECRET"];
const SERVICE_KEY = process.env["SERVICE_ROLE_KEY"];
const ativo = Boolean(REST && JWT_SECRET && SERVICE_KEY);

const base64url = (dados: ArrayBuffer | string) =>
  Buffer.from(typeof dados === "string" ? dados : new Uint8Array(dados)).toString("base64url");

async function assinarJwt(claims: Record<string, unknown>) {
  const cabecalho = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = base64url(JSON.stringify(claims));
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(`${cabecalho}.${corpo}`),
  );
  return `${cabecalho}.${corpo}.${base64url(assinatura)}`;
}

function rest(caminho: string, token: string, init: RequestInit = {}) {
  return fetch(`${REST}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers as Record<string, string>),
    },
  });
}

async function vinculoAtual(id: string) {
  const r = await rest(`/tenants?id=eq.${id}&select=gateway_tenant_id`, SERVICE_KEY!);
  const linhas = (await r.json()) as { gateway_tenant_id: string | null }[];
  return linhas[0]?.gateway_tenant_id ?? null;
}

describe.skipIf(!ativo)("gateway_tenant_id pela API REST", () => {
  const usuario = crypto.randomUUID();
  const slugTeste = `teste-rls-${usuario.slice(0, 8)}`;
  let token = "";
  let koji = "";
  let luxtia = "";
  let vinculoKoji: string | null = null;
  let vinculoLuxtia: string | null = null;

  beforeAll(async () => {
    const r = await rest("/tenants?select=id,slug&slug=in.(koji,luxtia)", SERVICE_KEY!);
    const linhas = (await r.json()) as { id: string; slug: string }[];
    koji = linhas.find((l) => l.slug === "koji")!.id;
    luxtia = linhas.find((l) => l.slug === "luxtia")!.id;
    vinculoKoji = await vinculoAtual(koji);
    vinculoLuxtia = await vinculoAtual(luxtia);

    const membro = await rest("/tenant_users", SERVICE_KEY!, {
      method: "POST",
      body: JSON.stringify({
        tenant_id: koji,
        user_id: usuario,
        email: "teste-rls@exemplo.invalid",
        is_tenant_admin: true,
      }),
    });
    expect(membro.status).toBe(201);

    const agora = Math.floor(Date.now() / 1000);
    token = await assinarJwt({
      sub: usuario,
      role: "authenticated",
      aud: "authenticated",
      email: "teste-rls@exemplo.invalid",
      iat: agora,
      exp: agora + 300,
    });
  });

  afterAll(async () => {
    await rest(`/tenant_users?user_id=eq.${usuario}`, SERVICE_KEY!, { method: "DELETE" });
    await rest(`/tenants?slug=eq.${slugTeste}`, SERVICE_KEY!, { method: "DELETE" });
  });

  test("o usuário enxerga a própria empresa (sessão válida)", async () => {
    const r = await rest(`/tenants?id=eq.${koji}&select=slug`, token);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([{ slug: "koji" }]);
  });

  test("admin da empresa não altera o vínculo da própria empresa", async () => {
    const r = await rest(`/tenants?id=eq.${koji}`, token, {
      method: "PATCH",
      body: JSON.stringify({ gateway_tenant_id: "postman_teste" }),
    });
    // RLS responde 200 sem linhas alteradas; o gatilho responderia 403.
    if (r.status === 200) expect(await r.json()).toEqual([]);
    else expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await vinculoAtual(koji)).toBe(vinculoKoji);
  });

  test("não altera o vínculo de outra empresa", async () => {
    const r = await rest(`/tenants?id=eq.${luxtia}`, token, {
      method: "PATCH",
      body: JSON.stringify({ gateway_tenant_id: "postman_teste" }),
    });
    if (r.status === 200) expect(await r.json()).toEqual([]);
    else expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await vinculoAtual(luxtia)).toBe(vinculoLuxtia);
  });

  test("não cria empresa já vinculada a um tenant", async () => {
    const r = await rest("/tenants", token, {
      method: "POST",
      body: JSON.stringify({ name: "Teste", slug: slugTeste, gateway_tenant_id: "postman_teste" }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    const existe = await rest(`/tenants?slug=eq.${slugTeste}&select=id`, SERVICE_KEY!);
    expect(await existe.json()).toEqual([]);
  });
});
