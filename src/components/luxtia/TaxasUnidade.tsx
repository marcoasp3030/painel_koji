/** Entrega da unidade: valor fixo, por bairro ou por faixa de CEP, e frete grátis. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { PedidoGestao } from "@/lib/gateway/gestao";
import {
  bairroNovo,
  camposDaUnidade,
  doServidor,
  faixaNova,
  linhasParaEnvio,
  mascaraCep,
  problemaNasTaxas,
  type Bairro,
  type EditorTaxas,
  type Faixa,
  type ModoTaxa,
  type VisaoTaxas,
} from "@/lib/gateway/taxas-unidade";
import type { ContextoGateway } from "./Gateway";
import { useGestao } from "./gestao-base";

const MODOS: { id: ModoTaxa; rotulo: string; ajuda: string }[] = [
  { id: "fixa", rotulo: "Valor fixo", ajuda: "A mesma taxa para qualquer endereço." },
  { id: "bairro", rotulo: "Por bairro", ajuda: "Cada bairro com sua taxa, e os que não atende." },
  { id: "cep", rotulo: "Por CEP", ajuda: "Taxa por faixa de CEP. Fora das faixas, não entrega." },
];

function Valor({
  id,
  rotulo,
  valor,
  mudar,
  disabled,
}: {
  id?: string;
  rotulo: string;
  valor: string;
  mudar: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative w-28 shrink-0">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500">R$</span>
      <Input
        id={id}
        aria-label={rotulo}
        inputMode="decimal"
        placeholder="0,00"
        className="pl-8 text-right tabular-nums"
        value={valor}
        disabled={disabled}
        onChange={(e) => mudar(e.target.value)}
      />
    </div>
  );
}

function LinhaBairro({
  b,
  mudar,
  remover,
  disabled,
}: {
  b: Bairro;
  mudar: (parte: Partial<Bairro>) => void;
  remover: () => void;
  disabled: boolean;
}) {
  const nome = b.nome.trim() || "novo bairro";
  return (
    <li className={`rounded-lg border border-base-200 p-2 ${b.ativo ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={`Nome de ${nome}`}
          placeholder="Bairro"
          className="min-w-40 flex-1"
          maxLength={80}
          value={b.nome}
          disabled={disabled}
          onChange={(e) => mudar({ nome: e.target.value })}
        />
        {b.atendido ? (
          <Valor
            rotulo={`Taxa de ${nome}`}
            valor={b.taxa}
            mudar={(taxa) => mudar({ taxa })}
            disabled={disabled}
          />
        ) : (
          <span className="w-28 shrink-0 text-center text-xs font-medium text-amber-800">
            Não atende
          </span>
        )}
        <label className="flex items-center gap-1.5 text-xs text-ink-700">
          <Switch
            checked={b.atendido}
            disabled={disabled}
            aria-label={`${nome}: entrega neste bairro`}
            onCheckedChange={(atendido) => mudar({ atendido })}
          />
          Entrega
        </label>
        {disabled ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-ink-500"
            aria-label={`Remover ${nome}`}
            onClick={remover}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
      <Input
        aria-label={`Outros nomes de ${nome}`}
        placeholder="Outros nomes, separados por vírgula. Ex.: Jd. Morumbi, Morumbi"
        className="mt-1.5 h-8 text-xs"
        value={b.apelidos}
        disabled={disabled}
        onChange={(e) => mudar({ apelidos: e.target.value })}
      />
    </li>
  );
}

function LinhaFaixa({
  f,
  mudar,
  remover,
  disabled,
}: {
  f: Faixa;
  mudar: (parte: Partial<Faixa>) => void;
  remover: () => void;
  disabled: boolean;
}) {
  const nome = f.inicio || "nova faixa";
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-base-200 p-2">
      <Input
        aria-label={`CEP inicial de ${nome}`}
        placeholder="00000-000"
        inputMode="numeric"
        className="w-28 tabular-nums"
        value={f.inicio}
        disabled={disabled}
        onChange={(e) => mudar({ inicio: mascaraCep(e.target.value) })}
      />
      <span className="text-xs text-ink-500">até</span>
      <Input
        aria-label={`CEP final de ${nome}`}
        placeholder="00000-000"
        inputMode="numeric"
        className="w-28 tabular-nums"
        value={f.fim}
        disabled={disabled}
        onChange={(e) => mudar({ fim: mascaraCep(e.target.value) })}
      />
      <Valor
        rotulo={`Taxa da faixa ${nome}`}
        valor={f.taxa}
        mudar={(taxa) => mudar({ taxa })}
        disabled={disabled}
      />
      {disabled ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-8 text-ink-500"
          aria-label={`Remover faixa ${nome}`}
          onClick={remover}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      )}
    </li>
  );
}

export function TaxasUnidade({
  ctx,
  id,
  podeEditar,
}: {
  ctx: ContextoGateway;
  id: string;
  podeEditar: boolean;
}) {
  const g = useGestao(ctx);
  const q = useQuery({
    queryKey: ["gestao", ctx.empresa, id, "taxas"],
    queryFn: () => g.ler<VisaoTaxas>({ acao: "taxas", id } as PedidoGestao),
  });
  const [e, setE] = useState<EditorTaxas | null>(null);
  const [base, setBase] = useState("");
  useEffect(() => {
    if (!q.data || e !== null) return;
    const novo = doServidor(q.data);
    setE(novo);
    setBase(JSON.stringify([linhasParaEnvio(novo), camposDaUnidade(novo)]));
  }, [q.data, e]);

  if (q.isLoading || !e) {
    if (q.isError)
      return (
        <p role="alert" className="text-sm text-destructive">
          {q.error.message}
        </p>
      );
    return <Skeleton className="h-40 rounded-lg" />;
  }
  const bloqueado = !podeEditar || g.busy;
  const problema = problemaNasTaxas(e);
  const sujo = JSON.stringify([linhasParaEnvio(e), camposDaUnidade(e)]) !== base;
  const mudarBairro = (chave: number, parte: Partial<Bairro>) =>
    setE({ ...e, bairros: e.bairros.map((b) => (b.chave === chave ? { ...b, ...parte } : b)) });
  const mudarFaixa = (chave: number, parte: Partial<Faixa>) =>
    setE({ ...e, faixas: e.faixas.map((f) => (f.chave === chave ? { ...f, ...parte } : f)) });

  async function salvar() {
    if (!e) return;
    const linhas = await g.executar({ acao: "salvar_taxas", id, itens: linhasParaEnvio(e) });
    if (!linhas.ok) return;
    const ok = await g.salvar({ acao: "editar", id, dados: camposDaUnidade(e) });
    if (ok) setE(null);
  }

  return (
    <section
      className="space-y-4 rounded-lg border border-base-200 bg-card p-3"
      aria-label="Taxa de entrega"
    >
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-900">Como cobrar a entrega</p>
        <div
          role="radiogroup"
          aria-label="Como cobrar a entrega"
          className="grid gap-2 sm:grid-cols-3"
        >
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={e.modo === m.id}
              disabled={bloqueado}
              onClick={() => setE({ ...e, modo: m.id })}
              className={`rounded-lg border p-2.5 text-left ${e.modo === m.id ? "border-purple-700 bg-purple-50" : "border-base-200"}`}
            >
              <span className="block text-sm font-medium text-ink-900">{m.rotulo}</span>
              <span className="block text-xs text-ink-500">{m.ajuda}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        {e.modo === "fixa" ? (
          <div>
            <Label htmlFor="taxa-fixa">Taxa de entrega</Label>
            <div className="mt-1">
              <Valor
                id="taxa-fixa"
                rotulo="Taxa de entrega"
                valor={e.taxaFixa}
                mudar={(taxaFixa) => setE({ ...e, taxaFixa })}
                disabled={bloqueado}
              />
            </div>
            <p className="mt-1 text-xs text-ink-500">Vazio: a unidade confirma com o cliente.</p>
          </div>
        ) : null}
        <div>
          <Label htmlFor="frete-gratis">Frete grátis a partir de</Label>
          <div className="mt-1">
            <Valor
              id="frete-gratis"
              rotulo="Frete grátis a partir de"
              valor={e.freteGratis}
              mudar={(freteGratis) => setE({ ...e, freteGratis })}
              disabled={bloqueado}
            />
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Opcional. Vale para qualquer forma de cobrança.
          </p>
        </div>
      </div>

      {e.modo === "bairro" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-900">Bairros</p>
          <ul className="space-y-2">
            {e.bairros.map((b) => (
              <LinhaBairro
                key={b.chave}
                b={b}
                disabled={bloqueado}
                mudar={(parte) => mudarBairro(b.chave, parte)}
                remover={() =>
                  setE({ ...e, bairros: e.bairros.filter((x) => x.chave !== b.chave) })
                }
              />
            ))}
          </ul>
          {podeEditar ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={g.busy || e.bairros.length >= 500}
              onClick={() => setE({ ...e, bairros: [...e.bairros, bairroNovo()] })}
            >
              <Plus className="size-3.5" aria-hidden /> Adicionar bairro
            </Button>
          ) : null}
        </div>
      ) : null}

      {e.modo !== "fixa" ? (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-ink-900">Faixas de CEP</p>
            {e.modo === "bairro" ? (
              <p className="text-xs text-ink-500">
                Opcional. Quando o bairro não está na lista, o CEP decide.
              </p>
            ) : null}
          </div>
          <ul className="space-y-2">
            {e.faixas.map((f) => (
              <LinhaFaixa
                key={f.chave}
                f={f}
                disabled={bloqueado}
                mudar={(parte) => mudarFaixa(f.chave, parte)}
                remover={() => setE({ ...e, faixas: e.faixas.filter((x) => x.chave !== f.chave) })}
              />
            ))}
          </ul>
          {podeEditar ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={g.busy || e.faixas.length >= 500}
              onClick={() => setE({ ...e, faixas: [...e.faixas, faixaNova()] })}
            >
              <Plus className="size-3.5" aria-hidden /> Adicionar faixa
            </Button>
          ) : null}
        </div>
      ) : null}

      {podeEditar && sujo && problema ? (
        <p role="alert" className="text-sm text-destructive">
          {problema}
        </p>
      ) : null}
      {g.erro ? (
        <p role="alert" className="text-sm text-destructive">
          {g.erro.mensagem}
        </p>
      ) : null}
      {podeEditar ? (
        <Button
          type="button"
          disabled={g.busy || !sujo || Boolean(problema)}
          onClick={() => void salvar()}
        >
          {g.busy ? "Salvando…" : "Salvar entrega"}
        </Button>
      ) : null}
    </section>
  );
}
