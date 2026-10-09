/** Checklist de prontidão: os botões só aparecem para quem pode resolver o item. */
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acaoPermitida, type AcaoProntidao, type ItemProntidao } from "@/lib/gateway/prontidao";
import type { PapelGateway } from "@/lib/gateway/tipos";

const ROTULO_ACAO: Record<AcaoProntidao, string> = {
  ativar: "Ativar agente",
  criar_canal: "Criar canal",
  ver_canais: "Ver canais",
  configurar_ia: "Configurar",
  ativar_ia: "Ativar IA real",
};

/** Texto para quando a empresa vê a pendência mas não pode resolver. */
function semPermissao(item: ItemProntidao, papel: PapelGateway) {
  if (papel === "plataforma") return null;
  if (item.chave === "canal" || (item.chave === "situacao" && papel === "admin")) {
    return "Peça à administração da plataforma.";
  }
  return null;
}

export function Checklist({
  itens,
  papel,
  status,
  ocupado,
  onAcao,
}: {
  itens: ItemProntidao[];
  papel: PapelGateway;
  status: string;
  ocupado?: boolean;
  onAcao: (acao: AcaoProntidao) => void;
}) {
  return (
    <ul className="divide-y divide-base-200">
      {itens.map((item) => {
        const Icone =
          item.estado === "ok" ? CheckCircle2 : item.estado === "info" ? Info : TriangleAlert;
        const cor =
          item.estado === "ok"
            ? "text-success"
            : item.estado === "info"
              ? "text-purple-500"
              : "text-gold-700";
        const pode = item.acao && acaoPermitida(item.acao, papel, status);
        const aviso = item.estado === "pendente" && !pode ? semPermissao(item, papel) : null;
        return (
          <li key={item.chave} className="flex flex-wrap items-center gap-3 py-3">
            <Icone className={`size-5 shrink-0 ${cor}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-900">
                <span className="sr-only">
                  {item.estado === "ok" ? "Pronto: " : item.estado === "info" ? "" : "Pendente: "}
                </span>
                {item.titulo}
              </p>
              <p className="text-xs text-ink-500">
                {item.detalhe}
                {aviso ? ` ${aviso}` : ""}
              </p>
            </div>
            {pode && item.acao ? (
              <Button
                size="sm"
                variant={item.acao === "ver_canais" ? "outline" : "default"}
                disabled={ocupado}
                onClick={() => onAcao(item.acao!)}
              >
                {ROTULO_ACAO[item.acao]}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
