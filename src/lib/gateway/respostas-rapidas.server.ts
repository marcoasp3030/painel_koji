/** Respostas rápidas no gateway. As regras de quem vê e quem escreve ficam lá; aqui valem o formato e a mensagem. */
import { GatewayErro } from "./erros";
import type { ModuloGateway } from "./modulo.server";
import { respostasSchema, type ListaRespostas, type RespostaRapida } from "./respostas-rapidas";

type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;

const CAMINHO = "respostas-rapidas";

/** Só `GatewayErro` passa pelo filtro de `comGateway`; um Error comum vira a mensagem genérica. */
function conflitoExplicado(erro: GatewayErro) {
  const campo = erro.detalhes["campo"];
  const mensagem =
    campo === "atalho"
      ? "Já existe uma resposta com este atalho."
      : campo === "limite"
        ? "O limite de 500 respostas foi atingido."
        : null;
  return mensagem ? new GatewayErro({ codigo: "CONFLICT", status: 409, mensagem }) : erro;
}

export async function executarRespostas(s: Sessao, entrada: unknown) {
  const p = respostasSchema.safeParse(entrada);
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
        const { dados } = await t.chamar<ListaRespostas>("GET", [CAMINHO]);
        return { itens: dados.itens } satisfies ListaRespostas;
      }
      case "criar": {
        const { atalho, texto, escopo } = d;
        const { dados } = await t.chamar<RespostaRapida>("POST", [CAMINHO], {
          corpo: { atalho, texto, escopo },
        });
        return dados;
      }
      case "alterar": {
        const { dados } = await t.chamar<RespostaRapida>("PATCH", [CAMINHO, String(d.id)], {
          corpo: { atalho: d.atalho, texto: d.texto },
        });
        return dados;
      }
      case "apagar":
        await t.chamar("DELETE", [CAMINHO, String(d.id)]);
        return { ok: true };
      case "usar":
        await t.chamar("POST", [CAMINHO, String(d.id), "uso"]);
        return { ok: true };
    }
  } catch (erro) {
    if (!(erro instanceof GatewayErro)) throw erro;
    // Gateway anterior a esta rota: a conversa segue funcionando, só sem a lista.
    if (erro.status === 404 && d.acao === "listar")
      return { itens: [], indisponivel: true } satisfies ListaRespostas;
    throw erro.status === 409 ? conflitoExplicado(erro) : erro;
  }
}
