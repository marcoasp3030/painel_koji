import type { ModuloGateway } from "./modulo.server";
import type { AgenteDetalhe } from "./tipos";
import { erroCapacidade, problemaCapacidade, type CampoCapacidade } from "./capacidade";
type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;
export async function capacidade(
  sessao: Sessao,
  empresa: string,
  agente?: string,
  escrita?: { valor: unknown },
) {
  // Conferência explícita também nas leituras, antes de qualquer chamada externa.
  await sessao.plataforma();
  const t = await sessao.tenant(empresa);
  const campo: CampoCapacidade = agente ? "max_concorrencia" : "max_lotes_simultaneos";
  const partes = agente ? ["agentes", agente] : ["config"];
  if (escrita) {
    const problema = problemaCapacidade(escrita.valor);
    if (problema) return { ok: false as const, erro: { campo, mensagem: problema } };
    try {
      await t.chamar(agente ? "PATCH" : "PUT", partes, { corpo: { [campo]: escrita.valor } });
    } catch (e) {
      const erro = erroCapacidade(e, campo);
      if (erro) return { ok: false as const, erro };
      throw e;
    }
  }
  const { dados } = await t.chamar<AgenteDetalhe & Record<string, unknown>>("GET", partes);
  const valor = dados[campo];
  const efetivo = agente ? dados.configuracao_efetiva?.[campo] : (valor ?? 5);
  return {
    ok: true as const,
    valor: typeof valor === "number" ? valor : null,
    efetivo: typeof efetivo === "number" ? efetivo : null,
  };
}
