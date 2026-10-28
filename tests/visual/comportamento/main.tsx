/** Prévia das telas de comportamento com dados fictícios. Não fala com o gateway. */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { ComportamentoAgente } from "@/components/luxtia/comportamento/ComportamentoAgente";
import { Comportamento } from "@/components/luxtia/agente/Comportamento";
import { VisaoGeral } from "@/components/luxtia/agente/VisaoGeral";
import { prontidao } from "@/lib/gateway/prontidao";
import type { AgenteDetalhe } from "@/lib/gateway/tipos";
import "./preview.css";

const params = new URLSearchParams(location.search);
(globalThis as { __PREVIEW?: { papel: string; whatsapp: boolean } }).__PREVIEW = {
  papel: params.get("papel") ?? "admin",
  whatsapp: params.get("whatsapp") === "1",
};

const agente: AgenteDetalhe = {
  id: "ag_exemplo",
  tenant_id: "exemplo",
  modelo_id: "atendimento_restaurante",
  modelo_versao: 4,
  nome: "By Koji",
  status: "ativo",
  provedor: "skyone",
  skyone_estrategia: null,
  skyone_webhook_url: "https://fluxo.exemplo.com/agente",
  skyone_auth_tipo: "bearer",
  skyone_auth_configurado: true,
  timeout_s: 30,
  instrucoes_agente: null,
  debounce_s: null,
  max_wait_s: null,
  pause_minutes: null,
  slow_notice_s: null,
  aviso_demora: null,
  fallback: null,
  alerta_telefone: "11988880000",
  send_mode: "dry",
  agente_mode: "mock",
  modo_piloto: true,
  contatos_permitidos: ["11999990000"],
  configuracao_efetiva: {
    nome: "By Koji",
    modo_piloto: true,
    contatos_permitidos: ["11999990000"],
    alerta_telefone: "11988880000",
    send_mode: "dry",
    agente_mode: "mock",
    origem_config: {},
  },
};

const tela = params.get("tela") ?? "atendimento";
const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Pagina() {
  if (tela === "ficha") {
    return (
      <PaginaGateway
        sobretitulo="Agentes"
        titulo="By Koji"
        descricao="Ficha do agente."
        papeis={["plataforma", "admin", "membro"]}
      >
        {(ctx) => <Comportamento ctx={ctx} agente={agente} />}
      </PaginaGateway>
    );
  }
  if (tela === "visao") {
    return (
      <PaginaGateway
        sobretitulo="Agentes"
        titulo="By Koji"
        descricao="Visão geral."
        papeis={["plataforma", "admin", "membro"]}
      >
        {(ctx) => (
          <VisaoGeral
            ctx={ctx}
            agente={agente}
            itens={prontidao(agente, [])}
            salvando={false}
            onAcao={() => {}}
            onSituacao={() => {}}
          />
        )}
      </PaginaGateway>
    );
  }
  return (
    <PaginaGateway
      sobretitulo="Configurações"
      titulo="Comportamento do agente"
      descricao="Jeito de falar, regras da casa e comportamentos do atendimento. Edite em rascunho e publique quando estiver pronto."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <ComportamentoAgente ctx={ctx} />}
    </PaginaGateway>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={cache}>
    <Pagina />
  </QueryClientProvider>,
);
