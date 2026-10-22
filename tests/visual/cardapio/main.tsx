import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { ClipboardList, Menu, MessagesSquare, Store, UtensilsCrossed } from "lucide-react";
import { LuxtiaWordmark } from "@/components/luxtia/Brand";
import { CardapioVista } from "@/components/luxtia/cardapio/CardapioVista";
import { buscaCardapio } from "@/lib/gateway/cardapio-ux";
import { criarServicos, iniciais, unidades } from "./gateway-falso";
import "./preview.css";
function Preview() {
  const [itens, setItens] = useState(iniciais);
  const ref = useRef(itens);
  ref.current = itens;
  const [filtros, setFiltros] = useState(() =>
    buscaCardapio(Object.fromEntries(new URLSearchParams(location.search))),
  );
  const admin = new URLSearchParams(location.search).get("papel") !== "membro";
  const { servicos, salvar } = useMemo(
    () =>
      criarServicos(
        () => ref.current,
        (novo) => {
          ref.current = ref.current.map((x) => (x.item_id === novo.item_id ? novo : x));
          setItens(ref.current);
        },
        "voce@restaurantejardim.com.br",
      ),
    [],
  );
  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col bg-purple-900 p-6 text-white lg:flex">
        <LuxtiaWordmark />
        <div className="mt-12 space-y-3 text-sm">
          <p className="mb-5 text-[10px] uppercase tracking-widest text-purple-300">Operação</p>
          {[
            [Store, "Unidades e horários"],
            [ClipboardList, "Pedidos"],
            [MessagesSquare, "Conversas"],
            [UtensilsCrossed, "Cardápio"],
          ].map(([Icon, nome]) => {
            const I = Icon as typeof Store;
            return (
              <div
                key={String(nome)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 ${nome === "Cardápio" ? "bg-white/15 text-white" : "text-purple-200"}`}
              >
                <I className="size-4" />
                {String(nome)}
              </div>
            );
          })}
        </div>
        <div className="mt-auto border-t border-white/15 pt-4 text-xs text-purple-200">
          Empresa de demonstração
          <br />
          <span className="mt-1 block">{admin ? "Administrador" : "Atendente"}</span>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-56">
        <header className="flex h-16 items-center justify-between border-b border-base-200 bg-card px-5 lg:px-10">
          <span className="flex items-center gap-2 text-sm text-ink-500">
            <Menu className="size-5 lg:hidden" />
            Gestão da empresa
          </span>
          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs text-purple-800">
            Demonstração · dados fictícios
          </span>
        </header>
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
                Operação
              </p>
              <h1 className="mt-1 font-display text-4xl text-purple-900">Cardápio</h1>
              <p className="mt-2 text-sm text-ink-500">Seu cardápio organizado, todos os dias.</p>
            </div>
            <span className="hidden rounded-lg border border-base-200 bg-card px-4 py-2 text-sm text-ink-700 sm:block">
              Restaurante Jardim
            </span>
          </div>
          <CardapioVista
            itens={itens}
            unidades={unidades}
            admin={admin}
            filtros={filtros}
            mudarFiltros={(f) => {
              setFiltros(f);
              const q = new URLSearchParams({ ...f, ...(!admin ? { papel: "membro" } : {}) });
              history.replaceState(null, "", "?" + q);
            }}
            salvar={salvar}
            servicos={servicos}
            atualizar={() => {}}
          />
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
