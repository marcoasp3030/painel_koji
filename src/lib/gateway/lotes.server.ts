/** Chamadas de lotes (LOTE1-a). O papel é conferido no módulo. */
import { GatewayErro, mensagemParaUsuario } from "./erros";
import type { ModuloGateway } from "./modulo.server";
import {
  lotesSchema,
  mensagemArquivoLoteInvalido,
  type ArquivoLoteResumo,
  type LoteProgresso,
  type NotaLote,
  type RespostaEnvioArquivoLote,
} from "./lotes";

type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;
type Pagina<T> = { itens: T[]; proximo_cursor: string | null };

function recusar(erro: unknown): never {
  if (erro instanceof GatewayErro) throw new Error(mensagemParaUsuario(erro));
  throw erro;
}

export async function executarLotes(s: Sessao, entrada: unknown) {
  const p = lotesSchema.safeParse(entrada);
  if (!p.success) {
    throw new GatewayErro({
      codigo: "VALIDATION_ERROR",
      status: 400,
      mensagem: p.error.issues[0]?.message ?? "Confira os campos.",
    });
  }
  const d = p.data;
  try {
    const t = await s.tenant(d.empresa);
    switch (d.acao) {
      case "listar": {
        const { dados } = await t.chamar<Pagina<LoteProgresso>>("GET", ["lotes"], {
          query: {
            agente_id: d.agente_id,
            estado: d.estado,
            cursor: d.cursor,
            limite: 40,
          },
        });
        return dados;
      }
      case "criar": {
        const corpo = d.nome ? { nome: d.nome } : {};
        const { dados } = await t.chamar<LoteProgresso>(
          "POST",
          ["agentes", d.agente_id, "lotes"],
          { corpo },
        );
        return dados;
      }
      case "ver": {
        const { dados } = await t.chamar<LoteProgresso>("GET", ["lotes", d.lote_id]);
        return dados;
      }
      case "enviar": {
        const formato = mensagemArquivoLoteInvalido(d.nome, 1);
        if (formato) {
          throw new GatewayErro({ codigo: "VALIDATION_ERROR", status: 400, mensagem: formato });
        }
        const { dados } = await t.chamar<RespostaEnvioArquivoLote>(
          "POST",
          ["lotes", d.lote_id, "arquivos"],
          {
            formulario: {
              arquivo: {
                nome: d.nome,
                tipo: d.tipo || "application/octet-stream",
                base64: d.base64,
              },
              campos: {},
            },
            tempoLimiteMs: 60_000,
          },
        );
        return dados;
      }
      case "arquivos": {
        const { dados } = await t.chamar<Pagina<ArquivoLoteResumo>>(
          "GET",
          ["lotes", d.lote_id, "arquivos"],
          {
            query: {
              estado: d.estado,
              cursor: d.cursor,
              limite: 100,
            },
          },
        );
        return dados;
      }
      case "notas": {
        const { dados } = await t.chamar<{
          lote_id: string;
          estado: string;
          total: number;
          itens: NotaLote[];
        }>("GET", ["lotes", d.lote_id, "notas"]);
        return dados;
      }
      case "fechar": {
        const { dados } = await t.chamar<LoteProgresso>("POST", ["lotes", d.lote_id, "fechar"], {
          corpo: {},
        });
        return dados;
      }
      case "apagar": {
        const { dados } = await t.chamar<LoteProgresso>("DELETE", ["lotes", d.lote_id]);
        return dados;
      }
    }
  } catch (erro) {
    recusar(erro);
  }
}
