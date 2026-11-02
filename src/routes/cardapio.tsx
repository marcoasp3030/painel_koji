import { createFileRoute } from "@tanstack/react-router";
import { CardapioCliente } from "@/components/cardapio/CardapioCliente";

/** Página pública do cliente. O token fica depois do #: não vai ao servidor, a logs nem a outros sites. */
export const Route = createFileRoute("/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio" },
      { name: "description", content: "Monte seu pedido." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
      { name: "theme-color", content: "#2e2340" },
    ],
  }),
  component: CardapioCliente,
});
