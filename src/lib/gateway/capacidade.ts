import { GatewayErro, mensagemParaUsuario } from "./erros";
export const AJUDA_CAPACIDADE =
  "Quantas conversas podem ser atendidas ao mesmo tempo. Regra prática: limite ≈ chamadas por minuto do fluxo no Skyone × duração média da resposta em minutos (ex.: 240 × 8 s ÷ 60 ≈ 30). Valores altos demais só fazem as conversas esperarem a cota do Skyone.";
export type CampoCapacidade = "max_lotes_simultaneos" | "max_concorrencia";
export function problemaCapacidade(valor: unknown) {
  return valor === null ||
    (typeof valor === "number" && Number.isInteger(valor) && valor >= 1 && valor <= 100)
    ? null
    : "Informe um número inteiro de 1 a 100 ou volte ao padrão.";
}
export function erroCapacidade(e: unknown, campo: CampoCapacidade) {
  return e instanceof GatewayErro && e.detalhes["campo"] === campo
    ? { campo, mensagem: mensagemParaUsuario(e) }
    : null;
}
