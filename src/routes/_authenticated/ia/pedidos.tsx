import { createFileRoute } from "@tanstack/react-router";
import { PaginaGateway } from "@/components/luxtia/Gateway";
import { Pedidos } from "@/components/luxtia/Pedidos";

export const Route = createFileRoute("/_authenticated/ia/pedidos")({
  validateSearch: (s: Record<string, unknown>) => ({
    // Mesmo formato do número no gateway (pedidoSchema): só dígitos.
    ...(typeof s["pedido"] === "string" && /^\d{1,20}$/.test(s["pedido"])
      ? { pedido: s["pedido"] }
      : typeof s["pedido"] === "number" && Number.isSafeInteger(s["pedido"]) && s["pedido"] > 0
        ? { pedido: String(s["pedido"]) }
        : {}),
  }),
  head: () => ({ meta: [{ title: "Pedidos | Luxtia" }] }),
  component: PaginaPedidos,
});

function PaginaPedidos() {
  const busca = Route.useSearch();
  return (
    <PaginaGateway
      titulo="Pedidos"
      descricao="Acompanhe os pedidos da empresa e avance só o próximo passo que a loja pode dar."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <Pedidos key={ctx.empresa ?? "vinculada"} ctx={ctx} abrir={busca.pedido} />}
    </PaginaGateway>
  );
}
