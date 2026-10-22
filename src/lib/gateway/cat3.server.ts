import { cat3Schema, validarLote, type RespostaCat3 } from "./cat3";
import { autorizar, type ModuloGateway } from "./modulo.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import { projetarItem } from "./cardapio.server";
import type { MetodoGateway } from "./cliente.server";
import type { Json } from "./tipos";
export async function executarCat3(
  s: Awaited<ReturnType<ModuloGateway["sessao"]>>,
  entrada: unknown,
): Promise<RespostaCat3> {
  const p = cat3Schema.safeParse(entrada);
  if (!p.success)
    return {
      ok: false,
      erro: {
        campo: String(p.error.issues[0]?.path.at(-1) ?? "corpo"),
        mensagem: p.error.issues[0]?.message ?? "Confira os campos.",
        status: 400,
      },
    };
  const d = p.data;
  try {
    const t = await s.tenant(d.empresa);
    const partes: string[] = ["catalogo"];
    let metodo: MetodoGateway = "POST",
      corpo: Json | undefined,
      query: Record<string, string | number | undefined> | undefined;
    switch (d.acao) {
      case "criar":
        partes.push("itens");
        corpo = JSON.parse(JSON.stringify(d.campos)) as Json;
        break;
      case "item":
        partes.push("itens", String(d.id), d.operacao);
        corpo = d.operacao === "esgotar" ? { ate: "fim_do_dia" } : undefined;
        break;
      case "categoria_criar":
        partes.push("categorias");
        corpo = { unidade: d.unidade, nome: d.nome };
        break;
      case "categoria_renomear":
        partes.push("categorias", String(d.id));
        metodo = "PATCH";
        corpo = { nome: d.nome };
        break;
      case "categoria_arquivar":
        partes.push("categorias", String(d.id), "arquivar");
        if (d.itens === "mover" && !d.destino)
          throw new GatewayErro({
            codigo: "VALIDATION_ERROR",
            status: 400,
            detalhes: { campo: "destino" },
            mensagem: "Escolha a categoria de destino.",
          });
        corpo = { itens: d.itens, ...(d.destino ? { destino: d.destino } : {}) };
        break;
      case "ordenar_categorias":
        partes.push("categorias", "ordem");
        metodo = "PUT";
        corpo = { unidade: d.unidade, categorias: d.categorias };
        break;
      case "ordenar_itens":
        partes.push("categorias", String(d.id), "ordem");
        metodo = "PUT";
        corpo = { itens: d.itens };
        break;
      case "copiar":
        partes.push("copiar");
        corpo = { itens: d.itens, destino: d.destino, ligar: d.ligar };
        break;
      case "lote": {
        const erro = validarLote(d);
        if (erro)
          throw new GatewayErro({ codigo: "VALIDATION_ERROR", status: 400, mensagem: erro });
        partes.push("lote");
        corpo = {
          itens: d.itens,
          acao: d.operacao,
          simulacao: d.simulacao,
          ...(d.percentual !== undefined ? { percentual: d.percentual } : {}),
          ...(d.valor !== undefined ? { valor: d.valor } : {}),
          ...(d.categoria_id ? { categoria_id: d.categoria_id } : {}),
          ...(d.operacao === "esgotar" ? { ate: "fim_do_dia" } : {}),
        };
        break;
      }
      case "sugestoes":
        partes.push("pratos", "sugestoes");
        metodo = "GET";
        query = { ignoradas: String(d.ignoradas), limite: 100, cursor: d.cursor };
        break;
      case "ligar":
        partes.push("pratos", "sugestoes", "confirmar");
        corpo = JSON.parse(JSON.stringify({ grupos: d.grupos })) as Json;
        break;
      case "sugestoes_acao":
        partes.push("pratos", "sugestoes", d.operacao);
        corpo = { chaves: d.chaves };
        break;
    }
    autorizar(t.papel, metodo, partes, corpo);
    const r = await t.chamar(metodo, partes, {
      ...(corpo !== undefined ? { corpo } : {}),
      ...(query ? { query } : {}),
    });
    return {
      ok: true,
      dados: (d.acao === "criar" || d.acao === "item"
        ? projetarItem(r.dados, t.papel !== "membro")
        : r.dados) as Json,
    };
  } catch (e) {
    if (e instanceof GatewayErro)
      return {
        ok: false,
        erro: {
          campo: typeof e.detalhes["campo"] === "string" ? e.detalhes["campo"] : "corpo",
          mensagem: mensagemParaUsuario(e),
          status: e.status,
        },
      };
    throw e;
  }
}
