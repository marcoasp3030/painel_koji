/**
 * Checklist de prontidão do agente. Só calcula; a tela decide, pelo papel,
 * se mostra o botão que leva ao que falta.
 */
import type { AgenteDetalhe, CanalGateway, CircuitoAgente, PapelGateway } from "./tipos";

export type AcaoProntidao = "ativar" | "criar_canal" | "ver_canais" | "configurar_ia" | "ativar_ia";

export type ItemProntidao = {
  chave: string;
  /** ok = pronto; pendente = falta algo; info = só informação. */
  estado: "ok" | "pendente" | "info";
  titulo: string;
  detalhe: string;
  acao?: AcaoProntidao;
};

function modoEfetivo(agente: AgenteDetalhe, campo: "agente_mode" | "send_mode", padrao: string) {
  const efetivo = agente.configuracao_efetiva?.[campo];
  return String(efetivo ?? agente[campo] ?? padrao);
}

export function conexaoSkyone(agente: AgenteDetalhe) {
  if (agente.provedor !== "skyone" || !agente.skyone_webhook_url) return "nao" as const;
  if (agente.skyone_auth_tipo === "nenhuma") return "sem_senha" as const;
  const completa =
    agente.skyone_auth_tipo === "basic"
      ? agente.skyone_auth_configurado && agente.skyone_auth_usuario_configurado
      : agente.skyone_auth_configurado;
  return completa ? ("sim" as const) : ("incompleta" as const);
}

function hora(valor: string | null) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? null
    : data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Basta saber de quem é o canal e se está ativo (vale para a lista do gateway). */
type CanalDaProntidao = Pick<CanalGateway, "agente_id" | "ativo">;

export function prontidao(
  agente: AgenteDetalhe,
  canais: CanalDaProntidao[],
  circuito?: CircuitoAgente | null,
  nomeModelo?: string | null,
): ItemProntidao[] {
  const itens: ItemProntidao[] = [];

  itens.push({
    chave: "modelo",
    estado: "ok",
    titulo: "Modelo",
    detalhe: `${nomeModelo ?? agente.modelo_id.replace(/_/g, " ")} (versão ${agente.modelo_versao})`,
  });

  itens.push(
    agente.status === "ativo"
      ? { chave: "situacao", estado: "ok", titulo: "Situação", detalhe: "Ativo" }
      : {
          chave: "situacao",
          estado: "pendente",
          titulo: "Situação",
          detalhe:
            agente.status === "pausado"
              ? "Pausado: não responde às mensagens recebidas."
              : "Rascunho: ainda não responde às mensagens recebidas.",
          acao: "ativar",
        },
  );

  const doAgente = canais.filter((c) => c.agente_id === agente.id);
  const ativos = doAgente.filter((c) => c.ativo);
  itens.push(
    ativos.length > 0
      ? {
          chave: "canal",
          estado: "ok",
          titulo: "Canal ligado",
          detalhe: ativos.length === 1 ? "1 canal ativo" : `${ativos.length} canais ativos`,
        }
      : doAgente.length > 0
        ? {
            chave: "canal",
            estado: "pendente",
            titulo: "Canal ligado",
            detalhe: "O canal deste agente está desativado.",
            acao: "ver_canais",
          }
        : {
            chave: "canal",
            estado: "pendente",
            titulo: "Canal ligado",
            detalhe: "Nenhum canal ligado a este agente.",
            acao: "criar_canal",
          },
  );

  const conexao = conexaoSkyone(agente);
  itens.push(
    conexao === "sim"
      ? { chave: "skyone", estado: "ok", titulo: "Conexão com o Skyone", detalhe: "Configurada" }
      : conexao === "sem_senha"
        ? {
            chave: "skyone",
            estado: "ok",
            titulo: "Conexão com o Skyone",
            detalhe: "Configurada sem senha (só vale em empresa de teste)",
          }
        : {
            chave: "skyone",
            estado: "pendente",
            titulo: "Conexão com o Skyone",
            detalhe:
              conexao === "incompleta"
                ? "Falta o usuário ou a senha do fluxo."
                : "Ainda não configurada.",
            acao: "configurar_ia",
          },
  );

  const respostas = modoEfetivo(agente, "agente_mode", "mock");
  itens.push(
    respostas === "live"
      ? { chave: "respostas", estado: "ok", titulo: "Respostas", detalhe: "IA real (Skyone)" }
      : {
          chave: "respostas",
          estado: "pendente",
          titulo: "Respostas",
          detalhe: "Em simulação: o agente responde sem chamar a IA.",
          acao: "ativar_ia",
        },
  );

  const envio = modoEfetivo(agente, "send_mode", "dry");
  itens.push({
    chave: "envio",
    estado: "info",
    titulo: "Envio aos clientes",
    detalhe:
      envio === "live"
        ? "Real: as respostas são enviadas aos clientes."
        : "Em teste: as respostas ainda não saem para os clientes.",
  });

  if (circuito && circuito.estado !== "fechado") {
    const quando = hora(circuito.aberto_ate);
    itens.push({
      chave: "falhas",
      estado: "pendente",
      titulo: "Falhas no Skyone",
      detalhe:
        circuito.estado === "aberto"
          ? `O Skyone falhou várias vezes seguidas.${quando ? ` Nova tentativa às ${quando}.` : ""}`
          : "O Skyone falhou várias vezes; a próxima mensagem testa a conexão de novo.",
    });
  }

  return itens;
}

export function resumoProntidao(itens: ItemProntidao[]) {
  const contados = itens.filter((i) => i.estado !== "info");
  return { prontos: contados.filter((i) => i.estado === "ok").length, total: contados.length };
}

/** Quem pode resolver cada pendência pelo painel (o servidor confere de novo). */
export function acaoPermitida(acao: AcaoProntidao, papel: PapelGateway, status: string) {
  if (papel === "plataforma") return true;
  if (acao === "ver_canais") return true;
  if (acao === "ativar") return papel === "admin" && status === "pausado";
  return false;
}
