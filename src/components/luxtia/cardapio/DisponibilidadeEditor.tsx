import type { ReactNode } from "react";
import { Clock3, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DIAS } from "@/lib/gateway/gestao";
import {
  rascunhoDe,
  type ItemCardapio,
  type RascunhoDisponibilidade,
} from "@/lib/gateway/cardapio";
import { NOMES_DIA, resumoRascunho, horaDigitada } from "@/lib/gateway/cardapio-ux";
export function DisponibilidadeEditor({
  r,
  mudar,
  busy,
  itens,
  previa,
}: {
  r: RascunhoDisponibilidade;
  mudar: (r: RascunhoDisponibilidade) => void;
  busy: boolean;
  itens: ItemCardapio[];
  /** Substitui o resumo local (ex.: prévia ao vivo do gateway). */
  previa?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 font-semibold text-purple-900">
          <Clock3 className="size-4" />
          Disponibilidade
        </h3>
        <p className="mt-1 text-sm text-ink-500">Escolha quando este item pode ser oferecido.</p>
      </div>
      <fieldset disabled={busy} className="space-y-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
          Dias da semana
        </legend>
        <div className="flex flex-wrap gap-2">
          {[
            { nome: "Todos os dias", dias: [...DIAS] },
            { nome: "Dias úteis", dias: DIAS.slice(0, 5) },
            { nome: "Fim de semana", dias: DIAS.slice(5) },
          ].map((p) => (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              size="sm"
              key={p.nome}
              onClick={() => mudar({ ...r, sempre: false, dias: p.dias })}
            >
              {p.nome}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {DIAS.map((d, i) => (
            <button
              type="button"
              key={d}
              aria-label={NOMES_DIA[d]}
              aria-pressed={r.dias.includes(d)}
              className={`size-10 rounded-full border text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 ${r.dias.includes(d) ? "border-purple-800 bg-purple-800 text-white" : "border-base-200 bg-card text-ink-700"}`}
              onClick={() =>
                mudar({
                  ...r,
                  sempre: false,
                  dias: r.dias.includes(d)
                    ? r.dias.filter((x) => x !== d)
                    : DIAS.filter((x) => x === d || r.dias.includes(x)),
                })
              }
            >
              {["S", "T", "Q", "Q", "S", "S", "D"][i]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center justify-between rounded-lg border border-base-200 p-3 text-sm font-medium">
        Exceto feriados
        <Switch
          checked={r.excetoFeriado}
          disabled={busy}
          onCheckedChange={(v) => mudar({ ...r, sempre: false, excetoFeriado: v })}
        />
      </label>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
          Faixas de horário · 24 horas
        </legend>
        {!r.faixas.length && (
          <p className="text-sm text-ink-500">
            O dia inteiro. Adicione uma faixa para limitar o horário.
          </p>
        )}
        {r.faixas.map(([a, b], i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                maxLength={5}
                placeholder="12:00"
                aria-label={`Início da faixa ${i + 1}`}
                value={a}
                className="w-24 tabular-nums"
                onChange={(e) =>
                  mudar({
                    ...r,
                    sempre: false,
                    faixas: r.faixas.map((f, n) =>
                      n === i ? [horaDigitada(e.target.value), b] : f,
                    ),
                  })
                }
              />
              <span className="text-sm text-ink-500">a</span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                maxLength={5}
                placeholder="15:00"
                aria-label={`Fim da faixa ${i + 1}`}
                value={b}
                className="w-24 tabular-nums"
                onChange={(e) =>
                  mudar({
                    ...r,
                    sempre: false,
                    faixas: r.faixas.map((f, n) =>
                      n === i ? [a, horaDigitada(e.target.value)] : f,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover faixa ${i + 1}`}
                onClick={() =>
                  mudar({ ...r, sempre: false, faixas: r.faixas.filter((_, n) => n !== i) })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {b < a && <p className="text-xs text-ink-500">Termina no dia seguinte.</p>}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          className="px-0 text-purple-800"
          disabled={r.faixas.length >= 12 || busy}
          onClick={() => mudar({ ...r, sempre: false, faixas: [...r.faixas, ["12:00", "15:00"]] })}
        >
          <Plus className="mr-1 size-4" />
          Adicionar faixa
        </Button>
      </fieldset>
      {previa ?? (
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-4" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">
            Como vai aparecer
          </p>
          <p className="mt-2 text-sm font-medium text-purple-900">{resumoRascunho(r)}</p>
        </div>
      )}
      <label className="block text-sm font-medium">
        <span className="mb-2 flex items-center gap-2">
          <Copy className="size-4" />
          Copiar de outro item
        </span>
        <select
          value=""
          disabled={busy}
          className="min-h-11 w-full rounded-lg border border-base-200 bg-card px-3 text-sm"
          onChange={(e) => {
            const i = itens.find((x) => x.item_id === Number(e.target.value));
            if (i) mudar(rascunhoDe(i.disponibilidade));
          }}
        >
          <option value="">Escolher item desta unidade…</option>
          {itens.map((i) => (
            <option key={i.item_id} value={i.item_id}>
              {i.nome} · {i.categoria || "Sem categoria"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
