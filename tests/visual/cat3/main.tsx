import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { CardapioCat3 } from "@/components/luxtia/cardapio/CardapioCat3";
import { AtendimentosConversa } from "@/components/luxtia/AtendimentosConversa";
import { buscaCardapio } from "@/lib/gateway/cardapio-ux";
import type { ItemCardapio } from "@/lib/gateway/cardapio";
import type { ServicosCat2 } from "@/lib/gateway/cardapio-cat2";
import type { CategoriaCat3, ExecutarCat3 } from "@/lib/gateway/cat3";
import type { AtendimentoConversa } from "@/lib/gateway/enc1";
import { LuxtiaWordmark } from "@/components/luxtia/Brand";
import "./preview.css";
const unidades = [
  { codigo: "jardins", nome: "Jardins", fuso: "America/Sao_Paulo" },
  { codigo: "pinheiros", nome: "Pinheiros", fuso: "America/Sao_Paulo" },
];
const cats: CategoriaCat3[] = [
  {
    id: 1,
    nome: "Entradas",
    categoria: "Entradas",
    ordem: 1,
    posicao: 1,
    qtd_itens: 3,
    arquivada: false,
  },
  {
    id: 2,
    nome: "Pratos da casa",
    categoria: "Pratos da casa",
    ordem: 2,
    posicao: 2,
    qtd_itens: 3,
    arquivada: false,
  },
];
const nomes = [
  "Edamame",
  "Sunomono",
  "Guioza de legumes",
  "Executivo de salmão",
  "Yakissoba da casa",
  "Tempurá de legumes",
];
const iniciais: ItemCardapio[] = unidades.flatMap((u, ui) =>
  nomes.map((nome, i) => ({
    item_id: ui * 10 + i + 1,
    nome,
    descricao: [
      "Soja verde no vapor com flor de sal.",
      "Pepino agridoce, gergelim e um toque de gengibre.",
      "Seis unidades douradas na chapa.",
    ][i % 3],
    preco: i === 2 ? null : 32 + i * 9 + ui * 2,
    unidade: u.codigo,
    categoria_id: i < 3 ? 1 : 2,
    categoria: i < 3 ? "Entradas" : "Pratos da casa",
    codigo: `${ui ? "PIN" : "JAR"}-000${i + 1}`,
    tipo: "item",
    alcoolico: false,
    delivery: "sim",
    ativo: true,
    observacao: "Finalizar com gergelim.",
    atualizado_em: "2026-10-20T14:00:00.123456Z",
    disponibilidade:
      i === 3
        ? {
            dias_semana: ["seg", "ter", "qua", "qui", "sex"],
            horario: [["12:00", "15:00"]],
            exceto_feriado: true,
            resumo: "segunda a sexta, 12h–15h, exceto feriados",
          }
        : null,
    disponivel_agora: i !== 2 && i !== 4,
    indisponivel_motivo: i === 2 ? "sem_preco" : i === 4 ? "esgotado" : null,
    esgotado_ate: i === 4 ? "2026-10-20T23:59:59-03:00" : null,
    arquivado: false,
    posicao: i + 1,
    prato: i === 0 ? { id: 1, codigo: "P-0001", nome } : null,
  })),
);
const ats: AtendimentoConversa[] = [
  {
    id: "at_a",
    numero: 3,
    estado: "em_atendimento_humano",
    aberto_em: "2026-10-20T16:05:00Z",
    encerrado_em: null,
    motivo_encerramento: null,
    motivo_inicio: "retorno_apos_encerramento",
    resumo: "Cliente consultou o cardápio e pediu ajuda com a entrega.",
    mensagens: 4,
    pedidos: [],
  },
  {
    id: "at_b",
    numero: 2,
    estado: "encerrado",
    aberto_em: "2026-10-19T15:00:00Z",
    encerrado_em: "2026-10-19T15:30:00Z",
    motivo_encerramento: "pedido_concluido",
    motivo_inicio: "primeiro_contato",
    desfecho: "pedido_feito",
    resumo: "Pedido #481 recebido e confirmado pela unidade.",
    mensagens: 8,
    pedidos: [{ numero: 481, status: "confirmado", modalidade: "retirada", total: 68 }],
  },
];
const esperar = () => new Promise((r) => setTimeout(r, 350));
function Preview() {
  const [itens, setItens] = useState(iniciais),
    [categorias, setCategorias] = useState(cats),
    [filtros, setFiltros] = useState(() =>
      buscaCardapio(Object.fromEntries(new URLSearchParams(location.search))),
    ),
    [selecionado, setSelecionado] = useState(""),
    [atendimentos, setAtendimentos] = useState(ats);
  const ref = useRef({ itens, categorias });
  ref.current = { itens, categorias };
  const ignorados = useRef(false);
  const admin = new URLSearchParams(location.search).get("papel") !== "membro",
    conversa = new URLSearchParams(location.search).get("tela") === "conversa";
  const atualizar = (novo: ItemCardapio) =>
    setItens((x) => x.map((i) => (i.item_id === novo.item_id ? novo : i)));
  const servicos = useMemo<ServicosCat2>(
    () => ({
      obter: async (id) => {
        await esperar();
        return ref.current.itens.find((i) => i.item_id === id)!;
      },
      categorias: async () => ({ categorias: ref.current.categorias }),
      atualizarLocal: atualizar,
      previa: async () => ({
        resumo: "segunda a sexta, 12h–15h, exceto feriados",
        disponivel_agora: true,
        indisponivel_motivo: null,
        data_referencia: "2026-10-20T13:00:00-03:00",
      }),
      historico: async () => ({
        itens: [
          {
            id: 1,
            actor: "Ana · administradora",
            criado_em: "2026-10-20T14:00:00Z",
            antes: { preco: 30 },
            depois: { preco: 32 },
          },
        ],
        proximo_cursor: null,
      }),
      editar: async (i, c) => {
        await esperar();
        const novo = { ...i, ...c, atualizado_em: new Date().toISOString() } as ItemCardapio;
        atualizar(novo);
        return { ok: true, item: novo };
      },
    }),
    [],
  );
  const executar = useMemo<ExecutarCat3>(
    () => async (d) => {
      await esperar();
      if (d.acao === "sugestoes")
        return {
          ok: true,
          dados: {
            total: 1,
            grupos:
              d.ignoradas === ignorados.current
                ? [
                    {
                      chave: "edamame",
                      nome: "Edamame",
                      conflito: null,
                      unidades: ["jardins", "pinheiros"],
                      prato: null,
                      itens: ref.current.itens
                        .filter((i) => i.nome === "Edamame")
                        .map((i) => ({
                          item_id: i.item_id,
                          unidade: i.unidade,
                          nome: i.nome,
                          preco: i.preco,
                          prato_id: null,
                        })),
                    },
                  ]
                : [],
            proximo_cursor: null,
          },
        };
      if (d.acao === "sugestoes_acao") {
        ignorados.current = d.operacao === "ignorar";
        return {
          ok: true,
          dados:
            d.operacao === "restaurar"
              ? { restauradas: d.chaves }
              : { resultados: d.chaves.map((chave) => ({ chave, ok: true })) },
        };
      }
      if (d.acao === "ligar")
        return {
          ok: true,
          dados: { resultados: d.grupos.map((g) => ({ chave: g.chave, ok: true })) },
        };
      if (d.acao === "lote")
        return {
          ok: true,
          dados: {
            simulacao: d.simulacao,
            resultados: d.itens.map((id) => {
              const i = ref.current.itens.find((x) => x.item_id === id)!;
              return i.preco === null
                ? { item_id: id, ok: false, motivo: "sem_preco" }
                : {
                    item_id: id,
                    ok: true,
                    antes: { preco: i.preco },
                    depois: {
                      preco: Number(
                        (i.preco * (1 + (d.percentual ?? 0) / 100) + (d.valor ?? 0)).toFixed(2),
                      ),
                    },
                  };
            }),
          },
        };
      if (d.acao === "ordenar_categorias") {
        setCategorias(d.categorias.map((id) => ref.current.categorias.find((c) => c.id === id)!));
        return { ok: true, dados: {} };
      }
      if (d.acao === "ordenar_itens") {
        setItens((x) =>
          x.map((i) =>
            d.itens.includes(i.item_id) ? { ...i, posicao: d.itens.indexOf(i.item_id) } : i,
          ),
        );
        return { ok: true, dados: {} };
      }
      if (d.acao === "item") {
        const i = ref.current.itens.find((x) => x.item_id === d.id)!;
        const novo = {
          ...i,
          disponivel_agora: d.operacao === "repor",
          indisponivel_motivo: d.operacao === "repor" ? null : "esgotado",
          esgotado_ate: d.operacao === "repor" ? null : "2026-10-20T23:59:59-03:00",
        };
        atualizar(novo);
        return { ok: true, dados: novo as never };
      }
      return { ok: true, dados: {} };
    },
    [],
  );
  const ler = useMemo(
    () => async () => ({ ok: true as const, dados: { itens: atendimentos, proximo_cursor: null } }),
    [atendimentos],
  );
  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-52 flex-col bg-purple-950 p-6 text-white lg:flex">
        <LuxtiaWordmark />
        <div className="mt-12 space-y-5 text-sm text-purple-200">
          <p>Visão geral</p>
          <p>Conversas</p>
          <p>Pedidos</p>
          <p className="rounded-lg bg-white/15 p-3 text-white">Cardápio</p>
          <p>Unidades</p>
        </div>
        <p className="mt-auto text-xs">
          Restaurante Jardim
          <br />
          {admin ? "Administrador" : "Atendente"}
        </p>
      </aside>
      <main className="min-h-screen lg:ml-52">
        <header className="border-b bg-card px-6 py-4 text-sm">
          Restaurante Jardim{" "}
          <strong className="float-right rounded bg-amber-100 px-3 py-1 text-xs text-amber-900">
            DEMONSTRAÇÃO · DADOS FICTÍCIOS
          </strong>
        </header>
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8">
          {conversa ? (
            <div className="mx-auto max-w-3xl rounded-2xl border bg-card">
              <h1 className="border-b p-5 text-xl font-semibold">Conversa · Marina Souza</h1>
              <AtendimentosConversa
                atual={atendimentos[0]}
                selecionado={selecionado}
                selecionar={setSelecionado}
                ler={ler}
                agir={async (op) => {
                  const a = {
                    ...atendimentos[0]!,
                    estado: op === "encerrar" ? ("encerrado" as const) : ("aberto" as const),
                    encerrado_em: op === "encerrar" ? "2026-10-20T17:00:00Z" : null,
                  };
                  setAtendimentos([a, ...atendimentos.slice(1)]);
                  return { ok: true, dados: { atendimento: a } };
                }}
                mudou={() => {}}
              />
              <div className="space-y-4 p-6">
                <p className="text-xs text-ink-500">
                  {selecionado === "at_b"
                    ? "Mensagens do atendimento #2"
                    : "Mensagens do atendimento #3"}
                </p>
                <p className="max-w-[80%] rounded-xl bg-base-100 p-4">
                  {selecionado === "at_b"
                    ? "Olá! Meu pedido foi confirmado?"
                    : "Boa tarde! Vocês entregam no meu bairro?"}
                </p>
                <p className="ml-auto max-w-[80%] rounded-xl bg-purple-100 p-4">
                  {selecionado === "at_b"
                    ? "Sim, a unidade confirmou seu pedido #481."
                    : "Boa tarde, Marina! Vou conferir para você."}
                </p>
              </div>
            </div>
          ) : (
            <CardapioCat3
              itens={itens}
              unidades={unidades}
              admin={admin}
              servicos={servicos}
              executar={executar}
              filtros={filtros}
              mudarFiltros={(f) => {
                setFiltros(f);
                history.replaceState(
                  {},
                  "",
                  `?${new URLSearchParams({ ...f, ...(!admin ? { papel: "membro" } : {}) })}`,
                );
              }}
              carregando={false}
              atualizar={() => {}}
              proteger={() => {}}
            />
          )}
        </div>
      </main>
      <Toaster />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
