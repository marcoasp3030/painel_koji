/** Webhooks de saída. O segredo volta só na criação. */
import { GatewayErro, mensagemParaUsuario } from "./erros";
import type { ModuloGateway } from "./modulo.server";
import { webhookSchema, type EntregaWebhook, type WebhookSaida } from "./webhooks";

type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;

export async function executarWebhook(s: Sessao, entrada: unknown) {
  const p = webhookSchema.safeParse(entrada);
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
        const { dados } = await t.chamar<{ itens: WebhookSaida[] }>("GET", ["webhooks-saida"]);
        return dados;
      }
      case "criar": {
        const { dados } = await t.chamar<WebhookSaida>("POST", ["webhooks-saida"], {
          corpo: { url: d.url, eventos: d.eventos, ativo: d.ativo },
        });
        return dados;
      }
      case "editar": {
        const { dados } = await t.chamar<WebhookSaida>("PATCH", ["webhooks-saida", d.id], {
          corpo: { url: d.url, eventos: d.eventos, ativo: d.ativo },
        });
        return dados;
      }
      case "desativar": {
        const { dados } = await t.chamar<WebhookSaida>("DELETE", ["webhooks-saida", d.id]);
        return dados;
      }
      case "testar": {
        const { dados } = await t.chamar<{ entrega_id: number; status: string }>(
          "POST",
          ["webhooks-saida", d.id, "testar"],
          { corpo: {} },
        );
        return dados;
      }
      case "entregas": {
        const { dados } = await t.chamar<{ itens: EntregaWebhook[] }>("GET", [
          "webhooks-saida",
          d.id,
          "entregas",
        ]);
        return dados;
      }
    }
  } catch (erro) {
    if (erro instanceof GatewayErro) throw new Error(mensagemParaUsuario(erro));
    throw erro;
  }
}
