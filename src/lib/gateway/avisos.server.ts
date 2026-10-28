import { peloMenos } from "@/lib/acesso/papeis";
import { avisoSchema } from "./avisos";
import type { ModuloGateway } from "./modulo.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import type { Json } from "./tipos";
type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;
type Resultado =
  | { ok: true; dados: Json }
  | { ok: false; erro: { campo: string; mensagem: string; status: number; motivo?: string } };
export async function executarAvisos(sessao: Sessao, entrada: unknown): Promise<Resultado> {
  const p = avisoSchema.safeParse(entrada);
  if (!p.success)
    return {
      ok: false,
      erro: {
        status: 400,
        campo: String(p.error.issues[0]?.path.at(-1) ?? "corpo"),
        mensagem: "Confira os campos. O texto deve ter de 1 a 1000 caracteres.",
      },
    };
  try {
    const d = p.data;
    const t = await sessao.tenant(d.empresa);
    if (t.papel === "funcionario")
      return {
        ok: false,
        erro: {
          status: 403,
          campo: "corpo",
          mensagem: "Os avisos de pedido ficam com o supervisor e o gestor.",
        },
      };
    if (d.acao === "salvar" && !peloMenos(t.papel, "gestor"))
      return {
        ok: false,
        erro: {
          status: 403,
          campo: "corpo",
          mensagem: "Gravar o aviso fica com o gestor.",
        },
      };
    let r;
    if (d.acao === "ler") r = await t.chamar("GET", ["pedidos", "avisos"]);
    else if (d.acao === "reenviar")
      r = await t.chamar("POST", ["pedidos", d.numero, "avisos", d.status, "reenviar"], {
        corpo: d.mesmo_incerto ? { mesmo_incerto: true } : {},
      });
    else if (d.acao === "previa")
      r = await t.chamar("POST", ["pedidos", "avisos", d.status, "previa"], {
        corpo: { modalidade: d.modalidade, texto: d.texto },
      });
    else
      r = await t.chamar("PUT", ["pedidos", "avisos", d.status], {
        corpo: {
          modalidade: d.modalidade,
          ...(d.texto !== undefined ? { texto: d.texto } : {}),
          ...(d.ativo !== undefined ? { ativo: d.ativo } : {}),
        },
      });
    return { ok: true, dados: r.dados as Json };
  } catch (e) {
    if (!(e instanceof GatewayErro)) throw e;
    const motivo = typeof e.detalhes["motivo"] === "string" ? e.detalhes["motivo"] : undefined;
    const conflitos: Record<string, string> = {
      entrega_incerta:
        "O cliente pode já ter recebido este aviso. Confira o pedido atualizado antes de confirmar um novo reenvio.",
      aviso_nao_falhou: "Este aviso não está mais em falha. O pedido foi atualizado.",
      pedido_mudou_de_status: "O pedido mudou de status. Este aviso não pode ser reenviado.",
    };
    return {
      ok: false,
      erro: {
        status: e.status,
        campo: typeof e.detalhes["campo"] === "string" ? e.detalhes["campo"] : "corpo",
        mensagem:
          e.status === 403
            ? "Você não tem permissão para esta ação. A configuração dos avisos é exclusiva de administradores."
            : (motivo && conflitos[motivo]) || mensagemParaUsuario(e),
        ...(motivo ? { motivo } : {}),
      },
    };
  }
}
