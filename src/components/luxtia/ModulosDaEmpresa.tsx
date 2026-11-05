/**
 * TELAS1: o super admin escolhe quais módulos do painel (opções do menu) a empresa usa.
 * Desligado some do menu da empresa e a tela fica fechada; o gateway recusa as rotas exclusivas dela.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { alterarModulosPainelEmpresa, obterModulosEmpresa } from "@/lib/gateway-modulos.functions";
import { MODULOS_PAINEL, gruposModulosPainel, type ModuloPainel } from "@/lib/gateway/modulos";

const GRUPOS = gruposModulosPainel();
const TOTAL = MODULOS_PAINEL.length;

const mesmaLista = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export function ModulosDaEmpresa({ empresa }: { empresa: string }) {
  const ler = useServerFn(obterModulosEmpresa);
  const salvar = useServerFn(alterarModulosPainelEmpresa);
  const qc = useQueryClient();
  const chave = ["gateway", "modulos-painel", empresa];
  const q = useQuery({ queryKey: chave, queryFn: () => ler({ data: { empresa } }) });
  const [rascunho, setRascunho] = useState<ModuloPainel[] | null>(null);
  const salvas = q.data?.bloqueadas ?? [];
  const bloqueadas = rascunho ?? salvas;
  const fora = new Set<string>(bloqueadas);
  const sujo = rascunho !== null && !mesmaLista(rascunho, salvas);

  const m = useMutation({
    mutationFn: (lista: ModuloPainel[]) => salvar({ data: { empresa, bloqueadas: lista } }),
    onSuccess: async (r) => {
      setRascunho(null);
      qc.setQueryData(chave, (antes: typeof q.data) =>
        antes ? { ...antes, bloqueadas: r.bloqueadas } : antes,
      );
      await qc.invalidateQueries({ queryKey: ["gateway", "modulos-menu"] });
      toast.success(
        r.bloqueadas.length === 0
          ? "Todos os módulos liberados."
          : `Módulos salvos: ${TOTAL - r.bloqueadas.length} de ${TOTAL} liberados.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function alternar(id: ModuloPainel, liberado: boolean) {
    const nova = liberado ? bloqueadas.filter((x) => x !== id) : [...bloqueadas, id];
    setRascunho(MODULOS_PAINEL.map((x) => x.id).filter((x) => nova.includes(x)));
  }

  function alternarGrupo(ids: ModuloPainel[], liberar: boolean) {
    const nova = liberar
      ? bloqueadas.filter((x) => !ids.includes(x))
      : [...new Set([...bloqueadas, ...ids])];
    setRascunho(MODULOS_PAINEL.map((x) => x.id).filter((x) => nova.includes(x)));
  }

  return (
    <section
      className="space-y-3 rounded-lg border border-base-200 p-4"
      aria-labelledby="modulos-empresa-titulo"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="modulos-empresa-titulo" className="text-sm font-medium text-ink-900">
            Módulos do painel
          </h3>
          <p className="text-xs text-ink-500">
            O que a empresa vê no menu. Desligado, some para todos os usuários dela.
          </p>
        </div>
        {q.data ? (
          <span className="shrink-0 rounded-full bg-base-100 px-2 py-0.5 text-xs tabular-nums text-ink-700">
            {TOTAL - bloqueadas.length}/{TOTAL}
          </span>
        ) : null}
      </div>

      {q.isPending ? (
        <p className="text-sm text-ink-500">Carregando…</p>
      ) : q.error ? (
        <p role="alert" className="text-sm text-red-700">
          {q.error.message}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {GRUPOS.map((g) => {
              const ids = g.itens.map((i) => i.id);
              const todosLigados = ids.every((id) => !fora.has(id));
              return (
                <fieldset key={g.nome} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <legend className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
                      {g.nome}
                    </legend>
                    <button
                      type="button"
                      className="rounded px-1 text-xs text-purple-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:opacity-50"
                      disabled={m.isPending}
                      onClick={() => alternarGrupo(ids, !todosLigados)}
                    >
                      {todosLigados ? "Desligar grupo" : "Ligar grupo"}
                    </button>
                  </div>
                  <ul className="divide-y divide-base-200 rounded-md border border-base-200">
                    {g.itens.map((i) => {
                      const id = `modulo-${i.id}`;
                      const ligado = !fora.has(i.id);
                      return (
                        <li
                          key={i.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <label
                            htmlFor={id}
                            className={`text-sm ${ligado ? "text-ink-900" : "text-ink-500 line-through decoration-ink-300"}`}
                          >
                            {i.rotulo}
                          </label>
                          <Switch
                            id={id}
                            checked={ligado}
                            disabled={m.isPending}
                            onCheckedChange={(v) => alternar(i.id, v)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={!sujo || m.isPending}
              onClick={() => rascunho && m.mutate(rascunho)}
            >
              {m.isPending ? "Salvando…" : "Salvar módulos"}
            </Button>
            {sujo ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={m.isPending}
                onClick={() => setRascunho(null)}
              >
                Descartar
              </Button>
            ) : bloqueadas.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={m.isPending}
                onClick={() => setRascunho([])}
              >
                Liberar todos
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
