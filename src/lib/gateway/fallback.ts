import { GatewayErro, mensagemParaUsuario } from "./erros";
export const FALLBACK_PADRAO =
  "Tive uma instabilidade agora. Pode repetir sua mensagem em instantes? 🙏";
export function problemaFallback(valor: unknown): string | null {
  if (valor === null || valor === undefined || (typeof valor === "string" && !valor.trim()))
    return null;
  if (typeof valor !== "string" || [...valor.trim()].length < 15 || !/\p{L}/u.test(valor))
    return "Escreva pelo menos 15 caracteres, incluindo uma letra, ou deixe vazio para usar o padrão.";
  return null;
}
export function erroDoFallback(erro: unknown) {
  if (
    erro instanceof GatewayErro &&
    erro.codigo === "VALIDATION_ERROR" &&
    erro.detalhes["campo"] === "fallback"
  )
    return { campo: "fallback" as const, mensagem: mensagemParaUsuario(erro) };
  return null;
}
