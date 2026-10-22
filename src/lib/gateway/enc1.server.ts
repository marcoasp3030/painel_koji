import {
  enc1Schema,
  type PaginaAtendimentos,
  type AtendimentoConversa,
  type RespostaEnc1,
} from "./enc1";
import type { ModuloGateway } from "./modulo.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import { exigirConversaVisivel } from "./ocultos";
export async function executarEnc1(
  s: Awaited<ReturnType<ModuloGateway["sessao"]>>,
  entrada: unknown,
): Promise<RespostaEnc1> {
  const p = enc1Schema.safeParse(entrada);
  if (!p.success)
    return { ok: false, status: 400, mensagem: "Confira a conversa e a ação informadas." };
  const d = p.data;
  try {
    const t = await s.tenant(d.empresa);
    await exigirConversaVisivel(t, d.conversa);
    if (d.acao === "listar") {
      const r = await t.chamar<PaginaAtendimentos>(
        "GET",
        ["conversas", d.conversa, "atendimentos"],
        { query: { limite: 20, cursor: d.cursor } },
      );
      return { ok: true, dados: r.dados };
    }
    const r = await t.chamar<{ atendimento: AtendimentoConversa }>(
      "POST",
      ["conversas", d.conversa, d.acao],
      d.acao === "encerrar" ? { corpo: { motivo: "manual" } } : {},
    );
    return { ok: true, dados: r.dados };
  } catch (e) {
    if (e instanceof GatewayErro)
      return {
        ok: false,
        status: e.status,
        mensagem:
          e.status === 409
            ? d.acao === "reabrir"
              ? "Só o último atendimento pode ser reaberto, e apenas se não houver outro aberto. Atualize e confira o último atendimento."
              : "Não há atendimento aberto para encerrar. Atualize a conversa."
            : mensagemParaUsuario(e),
      };
    throw e;
  }
}
