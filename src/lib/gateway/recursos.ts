/**
 * Recursos do gateway que dependem de versão. Quando o gateway publicar o
 * /testar que chama o Skyone sem mudar o modo do agente, preencher aqui o
 * nome do parâmetro (ex.: "usar_provedor_real") e o teste de conexão é liberado.
 */
export const PARAMETRO_TESTE_REAL: string | null = null;

export const TESTE_CONEXAO_DISPONIVEL = PARAMETRO_TESTE_REAL !== null;
