import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rotuloCampo, textoValor, type Previa, type Visao } from "@/lib/gateway/atendimento";
import { Cartao } from "../Superficie";
import type { Chamar } from "./ComportamentoAgente";

/** O bloco `perfil_atendimento` exatamente como o gateway coloca no pacote do agente. */
export function PreviaAtendimento({
  chave,
  chamar,
  visao,
}: {
  chave: unknown[];
  chamar: Chamar;
  visao: Visao;
}) {
  const [fonte, setFonte] = useState<"rascunho" | "publicado">(
    visao.rascunho ? "rascunho" : "publicado",
  );
  const [modo, setModo] = useState<"legivel" | "json">("legivel");
  const q = useQuery({
    queryKey: [
      ...chave,
      "previa",
      fonte,
      visao.rascunho?.atualizado_em ?? null,
      visao.perfil_versao,
    ],
    queryFn: async () => (await chamar<Previa>({ acao: "previa", fonte }))!,
  });
  const json = q.data ? JSON.stringify(q.data.perfil_atendimento, null, 2) : "";
  return (
    <Cartao className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex rounded-md border border-base-200 p-0.5"
          role="radiogroup"
          aria-label="Fonte"
        >
          {(["rascunho", "publicado"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={fonte === f}
              disabled={f === "rascunho" && !visao.rascunho}
              onClick={() => setFonte(f)}
              className={`rounded px-3 py-1 text-sm disabled:opacity-50 ${fonte === f ? "bg-purple-50 font-medium text-purple-800" : "text-ink-500"}`}
            >
              {f === "rascunho" ? "Rascunho" : "Publicado"}
            </button>
          ))}
        </div>
        <div
          className="flex rounded-md border border-base-200 p-0.5"
          role="radiogroup"
          aria-label="Formato"
        >
          {(["legivel", "json"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={`rounded px-3 py-1 text-sm ${modo === m ? "bg-purple-50 font-medium text-purple-800" : "text-ink-500"}`}
            >
              {m === "legivel" ? "Legível" : "Como o agente recebe"}
            </button>
          ))}
        </div>
        {q.data ? (
          <span className="text-xs text-ink-500">
            perfil_versao: <code>{q.data.perfil_versao}</code>
          </span>
        ) : null}
      </div>
      {!visao.rascunho ? (
        <p className="text-xs text-ink-500">Sem rascunho: a prévia mostra o que está publicado.</p>
      ) : null}
      {q.isPending ? <p role="status">Montando a prévia…</p> : null}
      {q.isError ? (
        <p role="alert" className="text-destructive">
          {q.error.message}
        </p>
      ) : null}
      {q.data && modo === "legivel" ? (
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,220px)_1fr]">
          {Object.entries(q.data.perfil_atendimento).map(([campo, valor]) => (
            <div key={campo} className="contents">
              <dt className="text-ink-500">{rotuloCampo(campo)}</dt>
              <dd className="whitespace-pre-wrap break-words text-ink-700">{textoValor(valor)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {q.data && modo === "json" ? (
        <div className="space-y-2">
          <pre className="max-h-[50vh] overflow-auto rounded-md bg-base-100 p-3 font-mono text-xs text-ink-700">
            {json}
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void navigator.clipboard.writeText(json).then(
                () => toast.success("Copiado."),
                () => toast.error("Não foi possível copiar."),
              )
            }
          >
            <Copy className="size-4" aria-hidden /> Copiar
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-ink-500">
        É o bloco <code>perfil_atendimento</code> que vai no pacote ao agente. As instruções da
        plataforma seguem à parte e não aparecem aqui.
      </p>
    </Cartao>
  );
}
