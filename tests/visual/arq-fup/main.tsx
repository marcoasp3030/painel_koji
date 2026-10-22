/** Prévia com dados fictícios das telas de documentos e follow-up. Não fala com o gateway. */
import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Checkbox } from "@/components/ui/checkbox";
import { CabecalhoPagina } from "@/components/luxtia/Superficie";
import { CampoAtendimento } from "@/components/luxtia/comportamento/CampoAtendimento";
import { ChavesFormularioTela } from "@/components/luxtia/documentos/ChavesFormulario";
import { DocumentosTela } from "@/components/luxtia/documentos/Documentos";
import { BlocoFollowUp, SeloOptOut } from "@/components/luxtia/FollowUpConversa";
import { WebhooksSaidaTela } from "@/components/luxtia/WebhooksSaida";
import { gradeJanela } from "@/lib/gateway/followup";
import { ESCOPO } from "@/lib/gateway/vocabulario";
import type { Json } from "@/lib/gateway/tipos";
import type { CampoEsquema } from "@/lib/gateway/atendimento";
import "./preview.css";

const tela = new URLSearchParams(location.search).get("tela") ?? "chaves";
const agentes = [
  { id: "ag_koji", nome: "By Koji" },
  { id: "ag_balcao", nome: "Balcão" },
];
const chaves = [
  {
    id: "key_f1",
    nome: "Site da loja",
    agente_id: "ag_koji",
    limite_por_minuto: 10,
    max_bytes: null,
    tipos_aceitos: null,
    modos: ["agente"],
    origens_permitidas: ["https://loja.exemplo.com.br"],
    expira_em: null,
    criado_em: "2026-10-21T13:00:00Z",
    ultimo_uso_em: null,
    revogada_em: null,
    revogada_por: null,
  },
];
const documentos = [
  {
    id: "anx_boleto",
    agente_id: "ag_koji",
    conversation_id: "c1",
    origem: "api",
    modo: "agente",
    nome: "boleto-outubro.pdf",
    formato: "pdf",
    tamanho_bytes: 48211,
    estado: "pronto",
    motivo: null,
    paginas: 2,
    tipo_documento: "boleto",
    referencia: "pedido-77",
    criado_em: "2026-10-21T16:02:00Z",
    processado_em: "2026-10-21T16:02:08Z",
    expira_em: "2026-11-20T16:02:00Z",
    apagado_em: null,
  },
  {
    id: "anx_nota",
    agente_id: "ag_koji",
    conversation_id: null,
    origem: "api",
    modo: "extrair",
    nome: "nfe.xml",
    formato: "xml",
    tamanho_bytes: 12000,
    estado: "pronto",
    motivo: null,
    paginas: 1,
    tipo_documento: "nfe",
    referencia: null,
    criado_em: "2026-10-20T18:00:00Z",
    processado_em: null,
    expira_em: null,
    apagado_em: null,
  },
];
const detalhe = {
  ...documentos[0]!,
  verificacao_pagamento: { estado: "nao_verificado" },
  conteudo: {
    paginas: [],
    avisos: [],
    campos: {
      valor: { valor: "152,30", confianca: "validado", fonte: "regra" },
      beneficiario: { valor: "By Koji Ltda", confianca: "lido_do_texto", fonte: "texto" },
      vencimento: { valor: "25/10/2026", confianca: "a_conferir", fonte: "texto" },
    },
  },
};
const pagina = {
  anexo_id: "anx_boleto",
  pagina: 1,
  origem: "texto",
  texto: "Recibo do pagador\nBeneficiário: By Koji Ltda\nValor: R$ 152,30\nVencimento: 25/10/2026",
  tabelas: [
    {
      id: "tab_1_1",
      linhas: [
        ["Item", "Valor"],
        ["Mensalidade", "152,30"],
      ],
    },
  ],
};

function Moldura({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-background px-6 py-8">
      <CabecalhoPagina sobretitulo="Agentes" titulo={titulo} descricao={descricao} />
      {children}
    </main>
  );
}

function Escopos() {
  const lista = [
    "conversar",
    "eventos:ler",
    "notificar",
    "ferramentas:catalogo",
    "callback",
    "documentos:enviar",
  ];
  const [marcados, setMarcados] = useState(["conversar", "documentos:enviar"]);
  return (
    <Moldura
      titulo="Chaves de API"
      descricao="Marque Enviar documentos na chave da empresa. Vale em servidor ou n8n."
    >
      <fieldset className="mt-6 max-w-xl space-y-2 rounded-xl border border-base-200 bg-card p-5">
        <legend className="px-1 text-sm font-medium">O que a chave pode fazer</legend>
        {lista.map((e) => (
          <label key={e} className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={marcados.includes(e)}
              onCheckedChange={(marcado) =>
                setMarcados((atual) => (marcado ? [...atual, e] : atual.filter((x) => x !== e)))
              }
            />
            <span>
              <span>{ESCOPO[e]?.rotulo ?? e}</span>
              <span className="block text-xs text-ink-500">{ESCOPO[e]?.ajuda}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Moldura>
  );
}

function Chaves() {
  const [nova, setNova] = useState<string | null>(
    new URLSearchParams(location.search).get("segredo") ? "gwf_exemplo_nao_usar_123" : null,
  );
  return (
    <Moldura
      titulo="Chaves de formulário"
      descricao="Chaves para um site enviar documentos a um agente. O valor aparece uma única vez."
    >
      <ChavesFormularioTela
        itens={chaves}
        agentes={agentes}
        podeCriar
        carregando={false}
        salvando={false}
        onCriar={() => setNova("gwf_exemplo_nao_usar_123")}
        onRevogar={() => undefined}
        chaveNova={nova}
        onFecharChave={() => setNova(null)}
      />
    </Moldura>
  );
}

function Documentos() {
  const aberto = new URLSearchParams(location.search).get("detalhe") === "1";
  return (
    <Moldura
      titulo="Documentos"
      descricao="Arquivos recebidos, com a leitura e a confiança de cada campo."
    >
      <DocumentosTela
        itens={documentos}
        filtro={{ estado: "", tipo: "", desde: "", ate: "" }}
        onFiltro={() => undefined}
        carregando={false}
        temMais={false}
        carregandoMais={false}
        onMais={() => undefined}
        detalhe={aberto ? detalhe : null}
        pagina={aberto ? pagina : null}
        carregandoDetalhe={false}
        podeApagar
        onAbrir={() => undefined}
        onFechar={() => undefined}
        onPagina={() => undefined}
        onBaixar={() => undefined}
        onApagar={() => undefined}
      />
    </Moldura>
  );
}

function Webhooks() {
  return (
    <Moldura
      titulo="Webhooks de saída"
      descricao="Avisos de documento, resposta do agente e follow-up."
    >
      <WebhooksSaidaTela
        itens={[
          {
            id: "wh_1",
            url: "https://sistema.exemplo.com.br/luxtia",
            eventos: ["documento.pronto", "conversa.resposta", "follow_up.agendado"],
            ativo: true,
          },
        ]}
        carregando={false}
        salvando={false}
        entregas={null}
        onCriar={() => undefined}
        onSalvar={() => undefined}
        onDesativar={() => undefined}
        onTestar={() => undefined}
        onEntregas={() => undefined}
        segredo={null}
        onFecharSegredo={() => undefined}
      />
    </Moldura>
  );
}

const DEFS: Record<string, CampoEsquema> = {
  follow_up_ativo: {
    tipo: "escolha",
    opcoes: ["on", "off"],
    editavel: true,
    disponivel: true,
    grupo: "follow_up",
  },
  follow_up_primeiro_min: {
    tipo: "inteiro",
    min: 5,
    max: 1440,
    editavel: true,
    disponivel: true,
    grupo: "follow_up",
  },
  follow_up_segundo_min: {
    tipo: "inteiro",
    min: 5,
    max: 1440,
    editavel: true,
    disponivel: true,
    grupo: "follow_up",
  },
  follow_up_limite_dia: {
    tipo: "inteiro",
    min: 0,
    max: 5,
    editavel: true,
    disponivel: true,
    grupo: "follow_up",
  },
  follow_up_janela: { tipo: "horarios", editavel: true, disponivel: true, grupo: "follow_up" },
  follow_up_escopo: {
    tipo: "escolha",
    opcoes: ["pedido_em_andamento", "pergunta_pendente"],
    editavel: true,
    disponivel: true,
    grupo: "follow_up",
  },
  follow_up_fora_unidade: {
    tipo: "escolha",
    opcoes: ["cancelar", "adiar_abertura"],
    editavel: true,
    disponivel: true,
    grupo: "follow_up",
  },
};

function FollowUpConfig() {
  const [valores, setValores] = useState<Record<string, Json>>({
    follow_up_ativo: "on",
    follow_up_primeiro_min: 15,
    follow_up_segundo_min: 60,
    follow_up_limite_dia: 2,
    follow_up_janela: gradeJanela("09:00", "22:00"),
    follow_up_escopo: "pedido_em_andamento",
    follow_up_fora_unidade: "cancelar",
  });
  return (
    <Moldura
      titulo="Comportamento do agente"
      descricao="Follow-up deste agente. Ligado, o gateway só anota o que enviaria."
    >
      <div className="mt-6 max-w-2xl space-y-3">
        {Object.entries(DEFS).map(([campo, def]) => (
          <CampoAtendimento
            key={campo}
            parte="comportamentos"
            campo={campo}
            def={def}
            situacao={{
              valor: valores[campo] ?? null,
              origem: "agente",
              personalizado: true,
              editado: false,
              noRascunho: false,
            }}
            podeEditar
            escopo="agente"
            erros={[]}
            bloqueios={[]}
            avisos={[]}
            mudar={(v) => setValores((s) => ({ ...s, [campo]: v }))}
            voltarAoPadrao={() => undefined}
          />
        ))}
      </div>
    </Moldura>
  );
}

function Conversa() {
  return (
    <Moldura
      titulo="Conversas"
      descricao="Follow-up da conversa e o pedido do contato para não receber."
    >
      <div className="mt-6 max-w-xl rounded-xl border border-base-200 bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <h2 className="font-display text-xl">Ana Souza</h2>
          <SeloOptOut
            optOut={{
              ativo: true,
              origem: "frase",
              criado_em: "2026-10-21T14:00:00Z",
              actor: null,
              removido_em: null,
              removido_por: null,
            }}
            podeReativar
            onReativar={() => undefined}
          />
        </div>
        <BlocoFollowUp
          itens={[
            {
              id: 1,
              atendimento_id: "at_1",
              agente_id: "ag_koji",
              ordinal: 1,
              tipo: "confirmar_pedido",
              pergunta: null,
              estado: "agendado",
              motivo: null,
              previsto_em: "2026-10-21T19:15:00Z",
              criado_em: null,
              atualizado_em: null,
            },
            {
              id: 2,
              atendimento_id: "at_0",
              agente_id: "ag_koji",
              ordinal: 1,
              tipo: "informar_horario",
              pergunta: null,
              estado: "cancelado",
              motivo: "cliente_respondeu",
              previsto_em: "2026-10-20T18:00:00Z",
              criado_em: null,
              atualizado_em: null,
            },
            {
              id: 3,
              atendimento_id: "at_0",
              agente_id: "ag_koji",
              ordinal: 1,
              tipo: "escolher_item",
              pergunta: null,
              estado: "ensaio_enviaria",
              motivo: null,
              previsto_em: "2026-10-19T15:40:00Z",
              criado_em: null,
              atualizado_em: null,
            },
          ]}
          carregando={false}
          podeCancelar
          cancelando={false}
          onCancelar={() => undefined}
        />
      </div>
    </Moldura>
  );
}

const telas: Record<string, () => ReactNode> = {
  escopos: Escopos,
  chaves: Chaves,
  documentos: Documentos,
  webhooks: Webhooks,
  followup: FollowUpConfig,
  conversa: Conversa,
};
const Tela = telas[tela] ?? Chaves;
createRoot(document.getElementById("root")!).render(<Tela />);
