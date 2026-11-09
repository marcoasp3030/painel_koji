/** CARD-LINK: atalho na Aparência do cardápio — um interruptor por agente. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { alterarAgente, listarAgentes, obterAgente } from "@/lib/gateway-agentes.functions";
import {
  AJUDA_ENVIAR_LINK_CARDAPIO,
  ROTULO_ENVIAR_LINK_CARDAPIO,
  enviarLinkLigado,
  podeVerEnviarLinkCardapio,
  valorEnviarLink,
} from "@/lib/card-link";
import type { AgenteDetalhe, AgenteGateway, Pagina } from "@/lib/gateway/tipos";
import { Switch } from "@/components/ui/switch";
import type { ContextoGateway } from "./Gateway";

type ItemLink = { id: string; nome: string; ligado: boolean };

export function EnviarLinkCardapioAtalho({ ctx }: { ctx: ContextoGateway }) {
  if (!podeVerEnviarLinkCardapio(ctx.papel)) return null;

  const cache = useQueryClient();
  const listar = useServerFn(listarAgentes);
  const obter = useServerFn(obterAgente);
  const alterar = useServerFn(alterarAgente);
  const chave = ["card-link", ctx.empresa ?? "vinculada"];

  const q = useQuery({
    queryKey: chave,
    queryFn: async (): Promise<ItemLink[]> => {
      const pagina = (await listar({ data: { empresa: ctx.empresa } })) as Pagina<AgenteGateway>;
      const itens = await Promise.all(
        (pagina.itens ?? []).map(async (a) => {
          const det = (await obter({
            data: { empresa: ctx.empresa, agente: a.id },
          })) as AgenteDetalhe;
          const bruto = det.configuracao_efetiva?.["enviar_link_cardapio"];
          const valor = typeof bruto === "string" ? bruto : null;
          return { id: a.id, nome: a.nome, ligado: enviarLinkLigado(valor) };
        }),
      );
      return itens;
    },
  });

  const mut = useMutation({
    mutationFn: async ({ id, ligado }: { id: string; ligado: boolean }) => {
      await alterar({
        data: {
          empresa: ctx.empresa,
          agente: id,
          dados: { enviar_link_cardapio: valorEnviarLink(ligado) },
        },
      });
      return { id, ligado };
    },
    onSuccess: ({ id, ligado }) => {
      cache.setQueryData<ItemLink[]>(chave, (atual) =>
        (atual ?? []).map((i) => (i.id === id ? { ...i, ligado } : i)),
      );
      toast.success(ligado ? "Link do cardápio ligado na conversa." : "Link do cardápio desligado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = q.data ?? [];

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
          <ul className="divide-y divide-base-200 rounded-md border border-base-200">
            {itens.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {itens.length > 1 ? a.nome : ROTULO_ENVIAR_LINK_CARDAPIO}
                  </p>
                  {itens.length > 1 ? (
                    <p className="truncate text-xs text-ink-500">{ROTULO_ENVIAR_LINK_CARDAPIO}</p>
                  ) : null}
                </div>
                <Switch
                  checked={a.ligado}
                  disabled={mut.isPending}
                  aria-label={`${ROTULO_ENVIAR_LINK_CARDAPIO}: ${a.nome}`}
                  onCheckedChange={(v) => mut.mutate({ id: a.id, ligado: v })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
