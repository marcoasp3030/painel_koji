/** Chamadas de documentos e chaves de formulário. O papel é conferido no módulo. */
import { GatewayErro, mensagemParaUsuario } from "./erros";
import type { ModuloGateway } from "./modulo.server";
import {
  chaveFormularioSchema,
  documentosSchema,
  type ChaveFormulario,
  type DocumentoDetalhe,
  type DocumentoResumo,
  type TextoPagina,
} from "./documentos";

type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;
type Pagina<T> = { itens: T[]; proximo_cursor: string | null };

function recusar(erro: unknown): never {
  if (erro instanceof GatewayErro) throw new Error(mensagemParaUsuario(erro));
  throw erro;
}

export async function executarDocumentos(s: Sessao, entrada: unknown) {
  const p = documentosSchema.safeParse(entrada);
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
        const { dados } = await t.chamar<Pagina<DocumentoResumo>>("GET", ["anexos"], {
          query: { limite: 50, estado: d.estado || undefined, cursor: d.cursor ?? undefined },
        });
        return dados;
      }
      case "detalhe": {
        const { dados } = await t.chamar<DocumentoDetalhe>("GET", ["anexos", d.id]);
        return dados;
      }
      case "texto": {
        const { dados } = await t.chamar<TextoPagina>("GET", ["anexos", d.id, "texto"], {
          query: { pagina: d.pagina },
        });
        return dados;
      }
      case "baixar": {
        const { dados } = await t.chamar<{ nome: string; tipo: string; base64: string }>(
          "GET",
          ["anexos", d.id, "original"],
          { arquivo: true },
        );
        return dados;
      }
      case "apagar": {
        const { dados } = await t.chamar<DocumentoResumo>("DELETE", ["anexos", d.id]);
        return dados;
      }
    }
  } catch (erro) {
    recusar(erro);
  }
}

export async function executarChaveFormulario(s: Sessao, entrada: unknown) {
  const p = chaveFormularioSchema.safeParse(entrada);
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
        const { dados } = await t.chamar<{ itens: ChaveFormulario[] }>("GET", [
          "chaves-formulario",
        ]);
        return dados;
      }
      case "criar": {
        const { dados } = await t.chamar<ChaveFormulario & { chave: string }>(
          "POST",
          ["chaves-formulario"],
          {
            corpo: {
              nome: d.nome,
              agente_id: d.agente_id,
              limite_por_minuto: d.limite_por_minuto,
              origens: d.origens,
            },
          },
        );
        return dados;
      }
      case "revogar": {
        const { dados } = await t.chamar<ChaveFormulario>("DELETE", ["chaves-formulario", d.id]);
        return dados;
      }
    }
  } catch (erro) {
    recusar(erro);
  }
}
