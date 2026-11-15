/** CARD-LINK2: atalho na Aparência — 3 modos + link próprio por agente. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { alterarAgente, listarAgentes, obterAgente } from "@/lib/gateway-agentes.functions";
import {
  AJUDA_ENVIAR_LINK_CARDAPIO,
  AJUDA_LINK_CARDAPIO_PROPRIO,
  ERRO_LINK_CARDAPIO,
  MODOS_ENVIAR_LINK_CARDAPIO,
  ROTULO_ENVIAR_LINK_CARDAPIO,
  ROTULO_LINK_CARDAPIO_PROPRIO,
  ROTULO_MODO_LINK_CARDAPIO,
  linkCardapioValido,
  mensagemErroLinkCardapio,
  modoEnviarLinkCardapio,
  normalizarLinkCardapio,
  podeVerEnviarLinkCardapio,
  type ModoEnviarLinkCardapio,
} from "@/lib/card-link";
import type { AgenteDetalhe, AgenteGateway, Pagina } from "@/lib/gateway/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContextoGateway } from "./Gateway";
import { useState } from "react";

type ItemLink = {
  id: string;
  nome: string;
  modo: ModoEnviarLinkCardapio;
  link: string;
};

export function EnviarLinkCardapioAtalho({ ctx }: { ctx: ContextoGateway }) {
  if (!podeVerEnviarLinkCardapio(ctx.papel)) return null;

  const cache = useQueryClient();
  const listar = useServerFn(listarAgentes);
  const obter = useServerFn(obterAgente);
  const alterar = useServerFn(alterarAgente);
  const chave = ["card-link", ctx.empresa ?? "vinculada"];
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: chave,
    queryFn: async (): Promise<ItemLink[]> => {
      const pagina = (await listar({ data: { empresa: ctx.empresa } })) as Pagina<AgenteGateway>;
      const itens = await Promise.all(
        (pagina.itens ?? []).map(async (a) => {
          const det = (await obter({
            data: { empresa: ctx.empresa, agente: a.id },
          })) as AgenteDetalhe;
          const cfg = det.configuracao_efetiva ?? {};
          const brutoModo = cfg["enviar_link_cardapio"];
          const brutoLink = cfg["link_cardapio_proprio"];
          return {
            id: a.id,
            nome: a.nome,
            modo: modoEnviarLinkCardapio(typeof brutoModo === "string" ? brutoModo : null),
            link: typeof brutoLink === "string" ? brutoLink : "",
          };
        }),
      );
      return itens;
    },
  });

  const mut = useMutation({
    mutationFn: async (args: {
      id: string;
      modo?: ModoEnviarLinkCardapio;
      link?: string | null;
    }) => {
      const dados: Record<string, unknown> = {};
      if (args.modo !== undefined) dados.enviar_link_cardapio = args.modo;
      if (args.link !== undefined) dados.link_cardapio_proprio = args.link;
      await alterar({
        data: { empresa: ctx.empresa, agente: args.id, dados },
      });
      return args;
    },
    onSuccess: (args) => {
      cache.setQueryData<ItemLink[]>(chave, (atual) =>
        (atual ?? []).map((i) => {
          if (i.id !== args.id) return i;
          return {
            ...i,
            ...(args.modo !== undefined ? { modo: args.modo } : {}),
            ...(args.link !== undefined ? { link: args.link ?? "" } : {}),
          };
        }),
      );
      if (args.modo !== undefined) {
        toast.success(`Link do cardápio: ${ROTULO_MODO_LINK_CARDAPIO[args.modo]}.`);
      } else {
        toast.success(args.link ? "Link próprio salvo." : "Link próprio removido.");
      }
    },
    onError: (e: Error) => toast.error(e.message || ERRO_LINK_CARDAPIO),
  });

  const itens = q.data ?? [];

  function linkDo(a: ItemLink) {
    return rascunhos[a.id] ?? a.link;
  }

  function salvarLink(a: ItemLink) {
    const bruto = linkDo(a);
    const erro = mensagemErroLinkCardapio(bruto);
    if (erro) {
      toast.error(erro);
      return;
    }
    const normalizado = normalizarLinkCardapio(bruto);
    mut.mutate({ id: a.id, link: normalizado });
    setRascunhos((r) => {
      const n = { ...r };
      delete n[a.id];
      return n;
    });
  }

  return (
    <section aria-label={ROTULO_ENVIAR_LINK_CARDAPIO}>
      <h2 className="sticky top-0 z-10 border-b border-base-200 bg-card/95 px-4 py-1.5 text-sm font-medium text-ink-900 backdrop-blur">
        Link na conversa
      </h2>
      <div className="space-y-3 px-4 py-3">
        <p className="text-sm text-ink-500">{AJUDA_ENVIAR_LINK_CARDAPIO}</p>
        {q.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {q.error.message}
          </p>
        ) : q.isLoading ? (
          <p className="text-sm text-ink-500">Carregando agentes…</p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhum agente nesta empresa.</p>
        ) : (
          <ul className="space-y-3">
            {itens.map((a) => {
              const link = linkDo(a);
              const aberto =
                linkCardapioValido(link) && link.trim().startsWith("https://")
                  ? link.trim()
                  : null;
              return (
                <li
                  key={a.id}
                  className="space-y-2 rounded-md border border-base-200 px-3 py-2.5"
                >
                  {itens.length > 1 ? (
                    <p className="truncate text-sm font-medium text-ink-900">{a.nome}</p>
                  ) : null}
                  <div
                    role="radiogroup"
                    aria-label={ROTULO_ENVIAR_LINK_CARDAPIO}
                    className="flex flex-wrap gap-1.5"
                  >
                    {MODOS_ENVIAR_LINK_CARDAPIO.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={a.modo === m}
                        disabled={mut.isPending}
                        onClick={() => mut.mutate({ id: a.id, modo: m })}
                        className={`min-h-9 rounded-md border px-3 text-sm transition disabled:cursor-not-allowed ${
                          a.modo === m
                            ? "border-purple-700 bg-purple-50 font-medium text-purple-800"
                            : "border-base-200 bg-card text-ink-700 hover:border-purple-300"
                        }`}
                      >
                        {ROTULO_MODO_LINK_CARDAPIO[m]}
                      </button>
                    ))}
                  </div>
                  {a.modo === "proprio" ? (
                    <div className="space-y-1.5 border-t border-base-200 pt-2">
                      <label className="block text-xs font-medium text-ink-700">
                        {ROTULO_LINK_CARDAPIO_PROPRIO}
                      </label>
                      <p className="text-xs text-ink-500">{AJUDA_LINK_CARDAPIO_PROPRIO}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="url"
                          inputMode="url"
                          autoComplete="url"
                          spellCheck={false}
                          placeholder="https://"
                          maxLength={500}
                          className="min-w-0 flex-1"
                          value={link}
                          disabled={mut.isPending}
                          onChange={(e) =>
                            setRascunhos((r) => ({ ...r, [a.id]: e.target.value }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={mut.isPending || link === a.link}
                          onClick={() => salvarLink(a)}
                        >
                          Salvar
                        </Button>
                        {aberto ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <a href={aberto} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-3.5" aria-hidden /> Abrir
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
