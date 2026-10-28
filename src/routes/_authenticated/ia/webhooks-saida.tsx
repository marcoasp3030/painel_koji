import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { peloMenos } from "@/lib/acesso/papeis";
import { PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
import { WebhooksSaidaTela } from "@/components/luxtia/WebhooksSaida";
import {
  criarWebhook,
  desativarWebhook,
  editarWebhook,
  entregasWebhook,
  listarWebhooks,
  rotacionarSegredoWebhook,
  testarWebhook,
} from "@/lib/gateway-webhooks.functions";
import type { EntregaWebhook, WebhookSaida } from "@/lib/gateway/webhooks";

export const Route = createFileRoute("/_authenticated/ia/webhooks-saida")({
  head: () => ({ meta: [{ title: "Webhooks de saída | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Webhooks de saída"
      descricao="Avisos para um sistema da empresa. Documentos, respostas do agente e follow-up entram na lista de eventos."
      papeis={["plataforma", "gestor"]}
    >
      {(ctx) => <Tela key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

function Tela({ ctx }: { ctx: ContextoGateway }) {
  const listar = useServerFn(listarWebhooks);
  const criarFn = useServerFn(criarWebhook);
  const editarFn = useServerFn(editarWebhook);
  const desativarFn = useServerFn(desativarWebhook);
  const testarFn = useServerFn(testarWebhook);
  const rotacionarFn = useServerFn(rotacionarSegredoWebhook);
  const entregasFn = useServerFn(entregasWebhook);
  const cache = useQueryClient();
  const [segredo, setSegredo] = useState<string | null>(null);
  const [entregas, setEntregas] = useState<EntregaWebhook[] | null>(null);
  const lista = useQuery({
    queryKey: ["webhooks-saida", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa, acao: "listar" } }),
  });
  const recarregar = () => cache.invalidateQueries({ queryKey: ["webhooks-saida", ctx.empresa] });
  const criar = useMutation({
    mutationFn: (dados: { url: string; eventos: string[]; ativo: boolean }) =>
      criarFn({ data: { empresa: ctx.empresa, acao: "criar", ...dados } }),
    onSuccess: (r) => {
      if (r.segredo) setSegredo(r.segredo);
      toast.success("Webhook criado. Copie o segredo.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const salvar = useMutation({
    mutationFn: (w: { id: string; url: string; eventos: string[]; ativo: boolean }) =>
      editarFn({ data: { empresa: ctx.empresa, acao: "editar", ...w } }),
    onSuccess: () => {
      toast.success("Webhook salvo.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const desativar = useMutation({
    mutationFn: (id: string) =>
      desativarFn({ data: { empresa: ctx.empresa, acao: "desativar", id } }),
    onSuccess: () => {
      toast.success("Webhook desativado.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const testar = useMutation({
    mutationFn: (id: string) => testarFn({ data: { empresa: ctx.empresa, acao: "testar", id } }),
    onSuccess: () => toast.success("Teste enviado. A entrega entra na fila."),
    onError: (e: Error) => toast.error(e.message),
  });
  const rotacionar = useMutation({
    mutationFn: (id: string) =>
      rotacionarFn({ data: { empresa: ctx.empresa, acao: "rotacionar", id } }),
    onSuccess: (r) => {
      if (r.segredo) setSegredo(r.segredo);
      else toast.error("O gateway não devolveu o segredo novo.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const verEntregas = useMutation({
    mutationFn: (id: string) =>
      entregasFn({ data: { empresa: ctx.empresa, acao: "entregas", id } }),
    onSuccess: (r) => setEntregas(r.itens),
    onError: (e: Error) => toast.error(e.message),
  });
  const ocupado =
    criar.isPending ||
    salvar.isPending ||
    desativar.isPending ||
    testar.isPending ||
    rotacionar.isPending;
  return (
    <WebhooksSaidaTela
      itens={lista.data?.itens ?? []}
      carregando={lista.isLoading}
      erro={lista.error instanceof Error ? lista.error.message : undefined}
      salvando={ocupado}
      entregas={entregas}
      onCriar={(dados) => criar.mutate(dados)}
      onSalvar={(w: WebhookSaida, dados) => salvar.mutate({ id: w.id, ...dados })}
      onDesativar={(w) => desativar.mutate(w.id)}
      onTestar={(w) => testar.mutate(w.id)}
      onEntregas={(w) => verEntregas.mutate(w.id)}
      podeGerarSegredo={peloMenos(ctx.papel, "gestor")}
      onGerarSegredo={(w) => rotacionar.mutate(w.id)}
      segredo={segredo}
      onFecharSegredo={() => setSegredo(null)}
    />
  );
}
