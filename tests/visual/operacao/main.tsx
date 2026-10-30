/** Prévia local das telas de pagamento e de pedidos. Dados fictícios. */
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { GestaoUnidades } from "@/components/luxtia/GestaoUnidades";
import { Pedidos } from "@/components/luxtia/Pedidos";
import { ContadorPedidos } from "@/components/luxtia/ContadorPedidos";
import "./preview.css";

const params = new URLSearchParams(location.search);
const tela = params.get("tela") ?? "pagamentos";
const ctx = { papel: "gestor" as const, empresa: "bykoji" };
const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Aviso() {
  const qc = useQueryClient();
  useEffect(() => {
    const t = window.setTimeout(() => {
      qc.setQueryData(["pedidos", "vinculada", "contagem"], {
        aguardando_loja: {
          total: 1,
          mais_antigo_em: "2026-10-29T22:10:00-03:00",
          por_unidade: [],
        },
        em_andamento: {},
        avisos_com_falha: 0,
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [qc]);
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-base-200 bg-card px-3 py-2 text-sm">
      <span>Pedidos</span>
      <ContadorPedidos papel="gestor" />
    </div>
  );
}

function Pagina() {
  if (tela === "pedidos") {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <Aviso />
        <Pedidos ctx={ctx} abrir={params.get("pedido") ?? undefined} />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl p-4">
      <GestaoUnidades
        ctx={ctx}
        unidadeId="uni_morumbi"
        secao="pagamentos"
        aoNavegar={() => undefined}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={cliente}>
    <Toaster position="top-right" />
    <Pagina />
  </QueryClientProvider>,
);
