/**
 * Recursos do gateway que dependem de versão. Parâmetro do /testar que chama o
 * Skyone sem mudar o modo do agente, publicado na imagem gateway:8f387be.
 * Com null, o teste de conexão fica desativado na tela e recusado no servidor.
 */
export const PARAMETRO_TESTE_REAL: string | null = "usar_provedor_real";

export const TESTE_CONEXAO_DISPONIVEL = PARAMETRO_TESTE_REAL !== null;
