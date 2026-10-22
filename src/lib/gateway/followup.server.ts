/** Follow-ups da conversa e opt-out do contato. Reativar só admin e plataforma. */
import { GatewayErro, mensagemParaUsuario } from "./erros";
import type { ModuloGateway } from "./modulo.server";
import {
  followUpSchema,
  listaFollowUpAusente,
  MENSAGEM_FOLLOWUP_AUSENTE,
  type ListaFollowUp,
  type OptOutFollowUp,
} from "./followup";

type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;

export async function executarFollowUp(s: Sessao, entrada: unknown) {
  const p = followUpSchema.safeParse(entrada);
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
        const { dados } = await t.chamar<ListaFollowUp>("GET", [
          "conversas",
          d.conversa,
          "follow-ups",
        ]);
        return dados;
      }
      case "cancelar": {
        const { dados } = await t.chamar<{ ok: boolean; cancelados: number }>(
          "POST",
          ["conversas", d.conversa, "follow-ups", "cancelar"],
          { corpo: { motivo: d.motivo ?? "painel" } },
        );
        return dados;
      }
      case "ver_opt_out": {
        const { dados } = await t.chamar<OptOutFollowUp>("GET", [
          "contatos",
          d.contato,
          "opt-out-follow-up",
        ]);
        return dados;
      }
      case "reativar": {
        const { dados } = await t.chamar<OptOutFollowUp>(
          "DELETE",
          ["contatos", d.contato, "opt-out-follow-up"],
          { corpo: { motivo: d.motivo } },
        );
        return dados;
      }
    }
  } catch (erro) {
    // Rota ainda não publicada: a conversa e o restante da tela continuam.
    if (erro instanceof GatewayErro && erro.status === 404) {
      if (d.acao === "listar") return listaFollowUpAusente();
      throw new Error(MENSAGEM_FOLLOWUP_AUSENTE);
    }
    if (erro instanceof GatewayErro) throw new Error(mensagemParaUsuario(erro));
    throw erro;
  }
}
