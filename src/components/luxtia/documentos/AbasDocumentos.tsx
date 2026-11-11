/** Abas Recebidos / Lotes sob Documentos (LOTE1-a). */
import { Link } from "@tanstack/react-router";

const ABAS = [
  { to: "/ia/documentos", rotulo: "Recebidos", exact: true },
  { to: "/ia/documentos/lotes", rotulo: "Lotes", exact: false },
] as const;

export function AbasDocumentos({ ativa }: { ativa: "recebidos" | "lotes" }) {
  return (
    <nav className="mt-4 flex gap-1 border-b border-base-200" aria-label="Documentos">
      {ABAS.map((aba) => {
        const selecionada =
          (ativa === "recebidos" && aba.rotulo === "Recebidos") ||
          (ativa === "lotes" && aba.rotulo === "Lotes");
        return (
          <Link
            key={aba.to}
            to={aba.to}
            className={
              selecionada
                ? "-mb-px border-b-2 border-ink-900 px-3 py-2 text-sm font-medium text-ink-900"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-ink-500 hover:text-ink-800"
            }
            aria-current={selecionada ? "page" : undefined}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
