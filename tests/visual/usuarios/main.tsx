/** Prévia das telas de usuários com dados fictícios. Não fala com o gateway. */
import { createRoot } from "react-dom/client";
import { UsuariosTela, type UsuarioLinha } from "@/components/luxtia/Usuarios";
import { FaixaSeguranca } from "@/components/luxtia/Seguranca";
import { filtrarMenu, TENANT_NAV, type ItemMenu } from "@/lib/nav";
import type { PapelAcesso } from "@/lib/acesso/papeis";
import "./preview.css";

const pessoas: UsuarioLinha[] = [
  {
    id: "1",
    email: "ana.gestora@exemplo.com",
    nome: "Ana Gestora",
    papel: "gestor",
    ativo: true,
    unidades: [],
    convidado_em: "2026-10-20T12:00:00Z",
    ultimo_acesso: "2026-10-27T14:10:00Z",
  },
  {
    id: "2",
    email: "bruno.salao@exemplo.com",
    nome: "Bruno Supervisor",
    papel: "supervisor",
    ativo: true,
    unidades: ["centro", "jardins"],
    convidado_em: "2026-10-21T12:00:00Z",
    ultimo_acesso: "2026-10-26T18:00:00Z",
  },
  {
    id: "3",
    email: "carla.caixa@exemplo.com",
    nome: "Carla Funcionária",
    papel: "funcionario",
    ativo: true,
    unidades: ["centro"],
    convidado_em: "2026-10-28T11:00:00Z",
    ultimo_acesso: null,
  },
];

const unidades = [
  { codigo: "centro", nome: "Centro" },
  { codigo: "jardins", nome: "Jardins" },
  { codigo: "pinheiros", nome: "Pinheiros" },
];

function noop() {
  /* A prévia não grava. */
}

function Tela({
  concediveis,
  lista,
  unidadesTela,
  link = null,
}: {
  concediveis: PapelAcesso[];
  lista: UsuarioLinha[];
  unidadesTela: typeof unidades;
  link?: string | null;
}) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <UsuariosTela
        empresa="Luxbrain Testes"
        concediveis={concediveis}
        unidades={unidadesTela}
        usuarios={lista}
        onConvidar={noop}
        onAlterar={noop}
        onReenviar={noop}
        onRevogar={noop}
        linkConvite={link}
        convitePorEmail={false}
      />
    </div>
  );
}

function Menus() {
  const papeis: PapelAcesso[] = ["gestor", "supervisor", "funcionario"];
  return (
    <div className="grid gap-4 p-6 md:grid-cols-3">
      {papeis.map((papel) => (
        <section key={papel} className="rounded-xl bg-card p-4">
          <h2 className="mb-3 font-display text-xl text-purple-900">{papel}</h2>
          <ul className="space-y-1 text-sm">
            {filtrarMenu(TENANT_NAV, papel).map((item: ItemMenu) => (
              <li key={item.to}>{item.label}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const vista = new URLSearchParams(location.search).get("vista") ?? "gestor";
const raiz = document.getElementById("root");
if (raiz) {
  createRoot(raiz).render(
    vista === "supervisor" ? (
      <Tela
        concediveis={["funcionario"]}
        lista={pessoas.filter((p) => p.papel === "funcionario")}
        unidadesTela={unidades.filter((u) => u.codigo !== "pinheiros")}
      />
    ) : vista === "menu" ? (
      <Menus />
    ) : vista === "prazo" ? (
      <div>
        <FaixaSeguranca prazo="2026-11-04T18:00:00Z" bloqueado={false} />
        <Tela concediveis={["gestor", "supervisor", "funcionario"]} lista={pessoas} unidadesTela={unidades} />
      </div>
    ) : vista === "link" ? (
      <Tela
        concediveis={["gestor", "supervisor", "funcionario"]}
        lista={pessoas.map((p) =>
          p.id === "3"
            ? { ...p, convitePendente: true, conviteExpiraEm: "2026-10-29T18:00:00Z" }
            : p,
        )}
        unidadesTela={unidades}
        link="https://painel.luxbrain.com.br/#convite=exemplo-nao-vale"
      />
    ) : (
      <Tela concediveis={["gestor", "supervisor", "funcionario"]} lista={pessoas} unidadesTela={unidades} />
    ),
  );
}
