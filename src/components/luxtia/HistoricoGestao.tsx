import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGestao } from "./GestaoUnidades";
import type { ContextoGateway } from "./Gateway";
import { Cartao } from "./Superficie";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dataRecebida, type Alteracao, type PedidoGestao } from "@/lib/gateway/gestao";
function valor(v: unknown) {
  return v === undefined
    ? "Não existia"
    : v === null
      ? "Não informado"
      : typeof v === "boolean"
        ? v
          ? "Sim"
          : "Não"
        : typeof v === "object"
          ? JSON.stringify(v, null, 2)
          : String(v);
}
export function HistoricoGestao({ ctx }: { ctx: ContextoGateway }) {
  const [entidade, setEntidade] = useState("");
  const [alvo, setAlvo] = useState("");
  return (
    <div className="mt-6 space-y-4">
      <p>
        Alterações da empresa. Telefones já mascarados pelo gateway. Datas preservam o fuso
        recebido.
      </p>
      <div className="flex flex-wrap gap-3">
        <label>
          Entidade
          <select
            className="block min-h-11 rounded border bg-white px-3"
            value={entidade}
            onChange={(e) => setEntidade(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="unidade">Unidade</option>
            <option value="excecao">Exceção</option>
          </select>
        </label>
        <label>
          Identificador exato da entidade
          <Input
            value={alvo}
            onChange={(e) => setAlvo(e.target.value)}
            placeholder="ID da unidade ou ID:data"
          />
        </label>
      </div>
      <p className="text-sm text-ink-500">Filtros disponíveis: entidade e identificador exato.</p>
      <Paginas key={`${entidade}:${alvo}`} ctx={ctx} entidade={entidade} alvo={alvo} />
    </div>
  );
}
function Paginas({
  ctx,
  entidade,
  alvo,
}: {
  ctx: ContextoGateway;
  entidade: string;
  alvo: string;
}) {
  const g = useGestao(ctx);
  const [cursores, setCursores] = useState<(number | undefined)[]>([undefined]);
  return (
    <>
      {cursores.map((cursor, i) => (
        <Pagina
          key={cursor ?? "primeira"}
          ctx={ctx}
          g={g}
          entidade={entidade}
          alvo={alvo}
          cursor={cursor}
          ultima={i === cursores.length - 1}
          mais={(c) => setCursores((p) => (p.includes(c) ? p : [...p, c]))}
        />
      ))}
    </>
  );
}
function Pagina({
  ctx,
  g,
  entidade,
  alvo,
  cursor,
  ultima,
  mais,
}: {
  ctx: ContextoGateway;
  g: ReturnType<typeof useGestao>;
  entidade: string;
  alvo: string;
  cursor: number | undefined;
  ultima: boolean;
  mais: (c: number) => void;
}) {
  const q = useQuery({
    queryKey: ["gestao", ctx.empresa, "historico", entidade, alvo, cursor],
    queryFn: () =>
      g.ler<{ itens: Alteracao[]; proximo_cursor: number | null }>({
        acao: "historico",
        ...(entidade ? { entidade } : {}),
        ...(alvo ? { entidade_id: alvo } : {}),
        ...(cursor ? { cursor } : {}),
      } as PedidoGestao),
  });
  return (
    <div className="space-y-3">
      {q.isPending && <p>Carregando alterações…</p>}
      {q.error && (
        <p role="alert">
          {q.error.message}
          <Button onClick={() => q.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {q.data?.itens.length === 0 && <p>Nenhuma alteração registrada neste recorte.</p>}
      {q.data?.itens.map((a) => (
        <Cartao key={a.id}>
          <details>
            <summary className="cursor-pointer break-words">
              <strong>
                {a.acao} · {a.entidade}
              </strong>
              <p>
                {dataRecebida(a.criado_em)} · {a.actor}
              </p>
              <p>{a.entidade_id}</p>
            </summary>
            <div className="mt-3 space-y-3">
              {[...new Set([...Object.keys(a.antes ?? {}), ...Object.keys(a.depois ?? {})])].map(
                (k) => (
                  <div key={k} className="rounded border p-3">
                    <strong>{k}</strong>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-ink-500">Antes</p>
                        <pre className="whitespace-pre-wrap break-words text-sm">
                          {valor(a.antes?.[k])}
                        </pre>
                      </div>
                      <div>
                        <p className="text-sm text-ink-500">Depois</p>
                        <pre className="whitespace-pre-wrap break-words text-sm">
                          {valor(a.depois?.[k])}
                        </pre>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </details>
        </Cartao>
      ))}
      {ultima && q.data?.proximo_cursor && (
        <Button variant="outline" onClick={() => mais(q.data!.proximo_cursor!)}>
          Carregar mais
        </Button>
      )}
    </div>
  );
}
