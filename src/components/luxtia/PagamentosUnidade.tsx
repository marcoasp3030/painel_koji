import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { PedidoGestao } from "@/lib/gateway/gestao";
import type { ContextoGateway } from "./Gateway";
import { useGestao } from "./gestao-base";

type Forma = {
  codigo: string;
  rotulo: string;
  ativo: boolean;
  aceita_troco: boolean;
  instrucoes: string;
};

type Resposta = {
  itens: {
    codigo: string;
    rotulo: string;
    ativo: boolean;
    aceita_troco: boolean;
    instrucoes: string | null;
  }[];
  sugestoes: { codigo: string; rotulo: string }[];
};

function doServidor(item: Resposta["itens"][number]): Forma {
  return {
    codigo: item.codigo,
    rotulo: item.rotulo,
    ativo: item.ativo,
    aceita_troco: item.codigo === "dinheiro" && item.aceita_troco,
    instrucoes: item.instrucoes ?? "",
  };
}

/** Lista estruturada no lugar do texto livre. A ordem enviada é a ordem do cliente. */
export function PagamentosUnidade({
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
    queryKey: ["gestao", ctx.empresa, id, "pagamentos"],
    queryFn: () => g.ler<Resposta>({ acao: "pagamentos", id } as PedidoGestao),
  });
  const [itens, setItens] = useState<Forma[] | null>(null);
  const [base, setBase] = useState("");
  useEffect(() => {
    if (!q.data || itens !== null) return;
    const lista = q.data.itens.map(doServidor);
    setItens(lista);
    setBase(JSON.stringify(lista));
  }, [q.data, itens]);
  const lista = itens ?? [];
  const sujo = itens !== null && JSON.stringify(itens) !== base;
  const sugestoes = (q.data?.sugestoes ?? []).filter(
    (s) => !lista.some((i) => i.codigo === s.codigo),
  );
  function alterar(i: number, parcial: Partial<Forma>) {
    setItens(
      lista.map((item, j) => {
        if (j !== i) return item;
        const proximo = { ...item, ...parcial };
        if (proximo.codigo !== "dinheiro") proximo.aceita_troco = false;
        return proximo;
      }),
    );
  }
  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const copia = [...lista];
    const [item] = copia.splice(i, 1);
    copia.splice(j, 0, item!);
    setItens(copia);
  }
  return (
    <section
      className="space-y-3 rounded-xl border border-base-200 bg-card p-4"
      aria-labelledby="pag-titulo"
    >
      <div>
        <h3 id="pag-titulo" className="font-display text-lg text-purple-800">
          Pagamentos
        </h3>
        <p className="text-sm text-ink-500">
          Cada forma tem código, rótulo e se está ativa. Aceitar troco só vale para dinheiro. A
          ordem desta lista é a ordem mostrada ao cliente.
        </p>
      </div>
      {q.isLoading ? <Skeleton className="h-24 rounded-lg" /> : null}
      {q.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {q.error.message}
        </p>
      ) : null}
      {q.isSuccess && lista.length === 0 ? (
        <p className="text-sm text-ink-500">
          Nenhuma forma cadastrada. O pedido segue com a unidade confirmando o pagamento.
        </p>
      ) : null}
      <ul className="space-y-3">
        {lista.map((item, i) => (
          <li
            key={`${item.codigo}-${i}`}
            className="space-y-2 rounded-lg border border-base-200 p-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor={`pag-codigo-${i}`}>Código</Label>
                <Input
                  id={`pag-codigo-${i}`}
                  value={item.codigo}
                  disabled={!podeEditar || g.busy}
                  maxLength={30}
                  onChange={(e) => alterar(i, { codigo: e.target.value.trim().toLowerCase() })}
                />
              </div>
              <div>
                <Label htmlFor={`pag-rotulo-${i}`}>Rótulo</Label>
                <Input
                  id={`pag-rotulo-${i}`}
                  value={item.rotulo}
                  disabled={!podeEditar || g.busy}
                  maxLength={40}
                  onChange={(e) => alterar(i, { rotulo: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.ativo}
                  disabled={!podeEditar || g.busy}
                  onChange={(e) => alterar(i, { ativo: e.target.checked })}
                />
                Ativo
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.aceita_troco}
                  disabled={!podeEditar || g.busy || item.codigo !== "dinheiro"}
                  onChange={(e) => alterar(i, { aceita_troco: e.target.checked })}
                />
                Aceita troco
              </label>
            </div>
            <div>
              <Label htmlFor={`pag-instrucoes-${i}`}>Instruções</Label>
              <Input
                id={`pag-instrucoes-${i}`}
                value={item.instrucoes}
                disabled={!podeEditar || g.busy}
                maxLength={300}
                placeholder="Opcional"
                onChange={(e) => alterar(i, { instrucoes: e.target.value })}
              />
            </div>
            {podeEditar ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={g.busy || i === 0}
                  onClick={() => mover(i, -1)}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={g.busy || i === lista.length - 1}
                  onClick={() => mover(i, 1)}
                >
                  Descer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={g.busy}
                  onClick={() => setItens(lista.filter((_, j) => j !== i))}
                >
                  Remover
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          {sugestoes.map((s) => (
            <Button
              key={s.codigo}
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={g.busy || lista.length >= 12}
              onClick={() =>
                setItens([
                  ...lista,
                  {
                    codigo: s.codigo,
                    rotulo: s.rotulo,
                    ativo: true,
                    aceita_troco: false,
                    instrucoes: "",
                  },
                ])
              }
            >
              Adicionar {s.rotulo}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={g.busy || lista.length >= 12}
            onClick={() =>
              setItens([
                ...lista,
                { codigo: "", rotulo: "", ativo: true, aceita_troco: false, instrucoes: "" },
              ])
            }
          >
            Outra forma
          </Button>
        </div>
      ) : null}
      {g.erro ? (
        <p role="alert" className="text-sm text-destructive">
          {g.erro.mensagem}
        </p>
      ) : null}
      {podeEditar ? (
        <Button
          type="button"
          className="min-h-11"
          disabled={g.busy || !sujo}
          onClick={async () => {
            const ok = await g.salvar({
              acao: "salvar_pagamentos",
              id,
              itens: lista.map((item) => ({
                codigo: item.codigo,
                rotulo: item.rotulo.trim(),
                ativo: item.ativo,
                aceita_troco: item.codigo === "dinheiro" && item.aceita_troco,
                instrucoes: item.instrucoes.trim() || null,
              })),
            });
            if (ok) setItens(null);
          }}
        >
          {g.busy ? "Salvando…" : "Salvar pagamentos"}
        </Button>
      ) : null}
    </section>
  );
}
