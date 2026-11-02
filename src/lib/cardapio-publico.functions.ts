/**
 * Ponte da página pública do cardápio. Não há sessão: a credencial é o token do link, que vai no corpo para não aparecer
 * em log de URL. O gateway confere o token e todas as regras; aqui só se repassa, sem chave de painel.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/lib/gateway/tipos";
import { ipDoCliente } from "@/lib/ip-cliente";

const token = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const unidade = z.string().regex(/^[a-z0-9][a-z0-9_]{0,39}$/);

type Objeto = { [chave: string]: Json };
type Resposta =
  | { ok: true; dados: Objeto }
  | { ok: false; status: number; motivo: string | null; detalhes: Objeto };

/** Sem isto, todos os clientes de todas as empresas dividiriam o limite do IP do painel. */
async function origemDoCliente(): Promise<Record<string, string>> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const ip = ipDoCliente(getRequest().headers);
    return ip ? { "X-Real-IP": ip } : {};
  } catch {
    return {};
  }
}

async function chamar(rota: string, corpo: unknown): Promise<Resposta> {
  const admin = process.env["GATEWAY_ADMIN_URL"];
  if (!admin) return { ok: false, status: 503, motivo: null, detalhes: {} };
  const base = admin.replace(/\/admin\/v1\/?$/, "");
  try {
    const r = await fetch(`${base}/api/v1/publico/cardapio/${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await origemDoCliente()) },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await r.json().catch(() => ({}))) as Objeto;
    if (r.ok) return { ok: true, dados: json };
    const erro = (json["erro"] ?? {}) as { detalhes?: Objeto };
    const detalhes = erro.detalhes ?? {};
    return {
      ok: false,
      status: r.status,
      motivo: typeof detalhes["motivo"] === "string" ? detalhes["motivo"] : null,
      detalhes,
    };
  } catch {
    return { ok: false, status: 503, motivo: null, detalhes: {} };
  }
}

export const lerCardapio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token }).parse(d))
  .handler(({ data }) => chamar("ler", data));

export const lerUnidadeCardapio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, unidade }).parse(d))
  .handler(({ data }) => chamar("unidade", data));

export const lerCep = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, cep: z.string().regex(/^\d{8}$/) }).parse(d))
  .handler(({ data }) => chamar("cep", data));

export const cotarTaxaCardapio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token,
        unidade,
        bairro: z.string().max(80).nullable(),
        cep: z
          .string()
          .regex(/^\d{8}$/)
          .nullable(),
        bairro_confirmado: z.boolean(),
      })
      .parse(d),
  )
  .handler(({ data }) => chamar("taxa", data));

const escolha = z.object({
  grupo_id: z.number().int().positive(),
  opcao_id: z.number().int().positive(),
  quantidade: z.number().int().min(1).max(20),
});

export const enviarPedidoCardapio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token,
        unidade,
        itens: z
          .array(
            z.object({
              item_id: z.number().int().positive(),
              quantidade: z.number().int().min(1).max(99),
              observacao: z.string().max(300).nullable(),
              opcoes: z.array(escolha).max(50),
            }),
          )
          .min(1)
          .max(50),
        modalidade: z.enum(["delivery", "retirada"]),
        endereco: z.string().max(500).nullable(),
        bairro: z.string().max(80).nullable(),
        cep: z
          .string()
          .regex(/^\d{8}$/)
          .nullable(),
        bairro_confirmado: z.boolean(),
        forma_pagamento: z.string().regex(/^[a-z0-9_]{1,40}$/),
        troco_para: z.number().positive().max(100000).nullable(),
        observacao: z.string().max(500).nullable(),
        maioridade_confirmada: z.boolean(),
        total_visto: z.number().min(0),
      })
      .parse(d),
  )
  .handler(({ data }) => chamar("pedido", data));
