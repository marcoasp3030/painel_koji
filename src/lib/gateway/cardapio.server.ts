import { peloMenos } from "@/lib/acesso/papeis";
import type { Json } from "./tipos";
import { cardapioSchema, type ItemCardapio } from "./cardapio";
import { autorizar, type ModuloGateway } from "./modulo.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";
type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;

const POR_PAGINA = 100;

/** Só os campos de consulta do cardápio; observação interna não sai do servidor. */
export function projetarItem(v: unknown, admin = false): ItemCardapio {
  const i = v as Record<string, unknown>;
  const d = i["disponibilidade"] as ItemCardapio["disponibilidade"];
  return {
    categoria_id: i["categoria_id"] as number,
    posicao: i["posicao"] as number | null,
    prato: (i["prato"] as NonNullable<ItemCardapio["prato"]>) ?? null,
    esgotado_ate: i["esgotado_ate"] as string | null,
    esgotado_motivo: i["esgotado_motivo"] as string | null,
    arquivado: i["arquivado"] as boolean,
    arquivado_em: i["arquivado_em"] as string | null,
    alcoolico: i["alcoolico"] as boolean,
    delivery: i["delivery"] as string,
    ...(admin
      ? {
          observacao: i["observacao"] as string | null,
          aplicado_em: (i["aplicado_em"] as NonNullable<ItemCardapio["aplicado_em"]>) ?? [],
        }
      : {}),
    atualizado_em: i["atualizado_em"] as string,
    disponivel_agora: i["disponivel_agora"] as boolean,
    indisponivel_motivo: i["indisponivel_motivo"] as string | null,
    data_referencia: i["data_referencia"] as string,
    item_id: i["item_id"] as number,
    codigo: (i["codigo"] as string | null) ?? null,
    unidade: (i["unidade"] as string | null) ?? null,
    categoria: (i["categoria"] as string | null) ?? null,
    nome: i["nome"] as string,
    descricao: (i["descricao"] as string | null) ?? null,
    preco: (i["preco"] as number | null) ?? null,
    tipo: i["tipo"] as string,
    ativo: i["ativo"] as boolean,
    disponibilidade: d
      ? {
          dias_semana: d.dias_semana ?? [],
          exceto_feriado: Boolean(d.exceto_feriado),
          horario: d.horario ?? [],
          resumo: d.resumo ?? null,
        }
      : null,
  };
}

type Leitura = Extract<
  ReturnType<typeof cardapioSchema.parse>,
  { acao: "obter" | "categorias" | "historico" | "previa" }
>;
/** Rota do gateway de cada leitura do CAT2 (a prévia é POST, mas não grava). */
function leitura(d: Leitura): {
  metodo: "GET" | "POST";
  partes: string[];
  corpo?: Json;
  query?: Record<string, string | number | undefined>;
} {
  switch (d.acao) {
    case "obter":
      return { metodo: "GET", partes: ["catalogo", "itens", String(d.item_id)] };
    case "categorias":
      return {
        metodo: "GET",
        partes: ["catalogo", "categorias"],
        query: { unidade: d.unidade, arquivadas: d.arquivadas ? "true" : undefined },
      };
    case "historico":
      return {
        metodo: "GET",
        partes: ["gestao", "alteracoes"],
        query: { entidade: "catalogo_item", entidade_id: String(d.item_id), cursor: d.cursor },
      };
    case "previa":
      return {
        metodo: "POST",
        partes: ["catalogo", "disponibilidade", "previa"],
        corpo: { unidade: d.unidade, disponibilidade: d.disponibilidade } as Json,
      };
  }
}

/** Histórico do item: só o que a tela mostra. */
function historico(v: unknown): Json {
  const r = v as { itens?: Record<string, unknown>[]; proximo_cursor?: number | null };
  return {
    itens: (r.itens ?? []).map((h) => ({
      id: h["id"] as number,
      actor: (h["actor"] as string | null) ?? "",
      acao: (h["acao"] as string | null) ?? "",
      criado_em: h["criado_em"] as string,
      antes: (h["antes"] as Json) ?? null,
      depois: (h["depois"] as Json) ?? null,
    })),
    proximo_cursor: r.proximo_cursor ?? null,
  } as Json;
}

export async function executarCardapio(
  sessao: Sessao,
  entrada: unknown,
): Promise<
  | { ok: false; erro: { campo: string; mensagem: string }; atual?: ItemCardapio }
  | { ok: true; dados: Json }
> {
  const parsed = cardapioSchema.safeParse(entrada);
  if (!parsed.success)
    return {
      ok: false,
      erro: {
        campo: String(parsed.error.issues[0]?.path.at(-1) ?? "corpo"),
        mensagem: parsed.error.issues[0]?.message ?? "Confira os campos.",
      },
    };
  const d = parsed.data;
  const t = await sessao.tenant(d.empresa);
  const item = (v: unknown) => projetarItem(v, peloMenos(t.papel, "gestor"));
  try {
    if (
      d.acao === "obter" ||
      d.acao === "categorias" ||
      d.acao === "historico" ||
      d.acao === "previa"
    ) {
      const l = leitura(d);
      autorizar(t.papel, l.metodo, l.partes, l.corpo);
      const { dados } = await t.chamar(l.metodo, l.partes, {
        ...(l.corpo ? { corpo: l.corpo } : {}),
        ...(l.query ? { query: l.query } : {}),
      });
      if (d.acao === "obter") return { ok: true, dados: item(dados) as unknown as Json };
      if (d.acao === "historico") return { ok: true, dados: historico(dados) };
      return { ok: true, dados: dados as Json };
    }
    if (d.acao === "panorama") {
      const itens: ItemCardapio[] = [];
      let cursor = 0;
      // Carregamento completo e limitado, sem apresentar uma página como total.
      // A ordem por ID é a ordem do catálogo importado (DISP1).
      for (let pagina = 0; pagina < 50; pagina++) {
        const { dados } = await t.chamar<{ itens: unknown[]; proximo_cursor: number | null }>(
          "GET",
          ["catalogo", "itens"],
          { query: { limite: 200, cursor, arquivados: d.arquivados ? "true" : undefined } },
        );
        itens.push(...dados.itens.map(item));
        if (dados.proximo_cursor === null) {
          if (d.com_esgotados) {
            // O motivo principal pode ser "sem_preco"/"item_inativo" mesmo com estoque esgotado.
            // A filtragem do gateway é a fonte de verdade, não o relógio do navegador.
            const esgotados = new Set<number>();
            let depois = 0;
            for (let p = 0; ; p++) {
              if (p >= 50)
                throw new GatewayErro({
                  codigo: "UNAVAILABLE",
                  status: 503,
                  mensagem: "Catálogo excedeu o limite da consulta.",
                });
              const resposta = await t.chamar<{
                itens: { item_id: number }[];
                proximo_cursor: number | null;
              }>("GET", ["catalogo", "itens"], {
                query: {
                  limite: 200,
                  cursor: depois,
                  esgotados: "true",
                  arquivados: d.arquivados ? "true" : undefined,
                },
              });
              resposta.dados.itens.forEach((i) => esgotados.add(i.item_id));
              const proximo = resposta.dados.proximo_cursor;
              if (proximo === null) break;
              if (!Number.isInteger(proximo) || proximo <= depois)
                throw new GatewayErro({
                  codigo: "UNAVAILABLE",
                  status: 503,
                  mensagem: "O catálogo mudou. Atualize novamente.",
                });
              depois = proximo;
            }
            itens.forEach((i) => {
              i.esgotado_agora = esgotados.has(i.item_id);
            });
          }
          return { ok: true, dados: { itens } as unknown as Json };
        }
        if (!Number.isInteger(dados.proximo_cursor) || dados.proximo_cursor <= cursor)
          throw new GatewayErro({
            codigo: "UNAVAILABLE",
            status: 503,
            mensagem: "O catálogo mudou durante a leitura. Tente atualizar novamente.",
          });
        cursor = dados.proximo_cursor;
      }
      throw new GatewayErro({
        codigo: "UNAVAILABLE",
        status: 503,
        mensagem:
          "Este catálogo ultrapassa o limite de 10.000 itens desta tela. Solicite paginação com contagens ao administrador.",
      });
    }
    if (d.acao === "listar") {
      const partes = ["catalogo", "itens"];
      autorizar(t.papel, "GET", partes, undefined);
      const { dados } = await t.chamar("GET", partes, {
        query: {
          unidade: d.unidade,
          q: d.q || undefined,
          ativo: d.ativo === undefined ? undefined : String(d.ativo),
          cursor: d.cursor,
          limite: POR_PAGINA,
        },
      });
      const r = dados as { itens: unknown[]; proximo_cursor: number | null };
      return {
        ok: true,
        dados: { itens: r.itens.map(item), proximo_cursor: r.proximo_cursor ?? null } as Json,
      };
    }
    const partes = ["catalogo", "itens", String(d.item_id)];
    const corpo =
      d.acao === "editar"
        ? { ...d.campos, atualizado_em: d.atualizado_em }
        : { disponibilidade: d.disponibilidade, atualizado_em: d.atualizado_em };
    autorizar(t.papel, "PATCH", partes, corpo);
    const { dados } = await t.chamar("PATCH", partes, { corpo });
    return { ok: true, dados: item(dados) as unknown as Json };
  } catch (e) {
    if (e instanceof GatewayErro) {
      const campo = typeof e.detalhes["campo"] === "string" ? e.detalhes["campo"] : "corpo";
      return {
        ok: false,
        erro: { campo, mensagem: mensagemParaUsuario(e) },
        ...(e.status === 409 && e.itemAtual ? { atual: item(e.itemAtual) } : {}),
      };
    }
    throw e;
  }
}
