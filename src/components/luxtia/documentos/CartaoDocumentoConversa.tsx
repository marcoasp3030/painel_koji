/** Cartão do arquivo dentro da conversa simulada. */
import { Etiqueta } from "@/components/luxtia/Gateway";
import { AVISO_AINDA_LENDO, ROTULO_ESTADO_DOCUMENTO, rotuloTipo } from "@/lib/gateway/documentos";

export function CartaoDocumentoConversa({
  nome,
  tipo,
  formato,
  estado,
  id,
  leituraDemorada = false,
}: {
  nome: string;
  tipo: string | null;
  formato: string | null;
  estado: string;
  id: string | null;
  /** Passou de 30 s em Processando. */
  leituraDemorada?: boolean;
}) {
  const selo = ROTULO_ESTADO_DOCUMENTO[estado] ?? { rotulo: estado, tom: "neutro" as const };
  const rotulo = tipo ? rotuloTipo(tipo) : formato ? formato.toUpperCase() : "Documento";
  return (
    <div className="rounded-2xl rounded-br-md border border-base-200 bg-card px-3 py-2 text-ink-900 shadow-[0_1px_2px_rgba(26,21,32,0.06)]">
      <p className="font-medium">{nome}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        <Etiqueta>{rotulo}</Etiqueta>
        <Etiqueta tom={selo.tom}>{selo.rotulo}</Etiqueta>
      </p>
      {id ? (
        <a
          className="mt-2 inline-block text-xs font-medium text-purple-700 underline underline-offset-2"
          href={`/ia/documentos?documento=${encodeURIComponent(id)}`}
        >
          Ver em Documentos
        </a>
      ) : null}
      {leituraDemorada && estado === "processando" ? (
        <p className="mt-2 text-xs text-gold-700">{AVISO_AINDA_LENDO}</p>
      ) : null}
    </div>
  );
}
