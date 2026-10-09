import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import {
  Etiqueta,
  PaginaGateway,
  SegredoUmaVez,
  Vazio,
  dataHora,
  type ContextoGateway,
} from "@/components/luxtia/Gateway";
import { Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { alterarCanal, listarCanais, rotacionarSegredoCanal } from "@/lib/gateway-canais.functions";
import { NovoCanal } from "@/components/luxtia/NovoCanal";
import type { CanalGateway } from "@/lib/gateway/tipos";
import { PUBLICO_CANAL, TIPO_CANAL } from "@/lib/gateway/vocabulario";

export const Route = createFileRoute("/_authenticated/ia/canais")({
  head: () => ({ meta: [{ title: "Canais | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Canais"
      descricao="Por onde as mensagens chegam aos agentes. A URL do webhook leva um segredo e aparece uma única vez."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <Canais key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

function Canais({ ctx }: { ctx: ContextoGateway }) {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarCanais);
  const listarAg = useServerFn(listarAgentes);
  const alterar = useServerFn(alterarCanal);
  const rotacionar = useServerFn(rotacionarSegredoCanal);
  const plataforma = ctx.papel === "plataforma";
  const [criando, setCriando] = useState(false);
  // URL com segredo: só em memória, até o usuário fechar o aviso.
  const [segredo, setSegredo] = useState<{ titulo: string; url: string } | null>(null);

  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa } }),
  });
  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
  });
  const nomeAgente = (id: string | null) =>
    agentes.data?.itens.find((a) => a.id === id)?.nome ?? id ?? "—";

  const recarregar = () =>
    queryClient.invalidateQueries({ queryKey: ["gateway", "canais", ctx.empresa] });

  const ativar = useMutation({
    mutationFn: (c: CanalGateway) =>
      alterar({ data: { empresa: ctx.empresa, canal: c.id, dados: { ativo: !c.ativo } } }),
    onSuccess: (c) => {
      toast.success(c.ativo ? "Canal ativado." : "Canal desativado.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotacao = useMutation({
    mutationFn: (c: CanalGateway) => rotacionar({ data: { empresa: ctx.empresa, canal: c.id } }),
    onSuccess: (r) => {
      setSegredo({ titulo: "Nova URL do webhook", url: r.webhook_url });
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = canais.data?.itens ?? [];

  return (
    <>
      {plataforma ? (
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setCriando(true)}>
            <Plus className="size-4" aria-hidden /> Novo canal
          </Button>
        </div>
      ) : null}

      <Cartao className="mt-4">
        {canais.isLoading ? (
          <p className="px-5 py-8 text-ink-500">Carregando…</p>
        ) : canais.error ? (
          <EstadoVazio titulo="Não foi possível carregar" texto={(canais.error as Error).message} />
        ) : itens.length === 0 ? (
          <Vazio
            titulo="Nenhum canal ainda"
            texto={
              plataforma
                ? "Crie um canal para conectar o WhatsApp ou testar pelo Simular."
                : "Peça à administração da plataforma para conectar o WhatsApp ou um canal de testes."
            }
            {...(plataforma
              ? {
                  acao: (
                    <Button onClick={() => setCriando(true)}>
                      <Plus className="size-4" aria-hidden /> Criar canal
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          <ul>
            {itens.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-4 border-b border-base-200 px-5 py-4 last:border-0 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink-900">{c.nome}</p>
                    <Etiqueta tom="roxo">{TIPO_CANAL[c.tipo] ?? c.tipo}</Etiqueta>
                    <Etiqueta tom={c.ativo ? "sucesso" : "neutro"}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </Etiqueta>
                    {c.publico === "interno" ? (
                      <Etiqueta>{PUBLICO_CANAL["interno"]}</Etiqueta>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    Responde: {nomeAgente(c.agente_id)} · <span className="font-mono">{c.id}</span>
                    {c.ultimo_evento_em ? ` · última mensagem ${dataHora(c.ultimo_evento_em)}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-500">
                    <span>
                      Segredo do webhook{" "}
                      {c.webhook_secret_configurado ? (
                        <span className="text-success">
                          configurado <CheckCircle2 className="inline size-3.5" aria-label="✓" />
                        </span>
                      ) : (
                        "ausente"
                      )}
                    </span>
                    {c.tipo !== "api" ? (
                      <span>
                        Credenciais{" "}
                        {c.credenciais_configurado ? (
                          <span className="text-success">
                            configuradas <CheckCircle2 className="inline size-3.5" aria-label="✓" />
                          </span>
                        ) : (
                          "não configuradas"
                        )}
                      </span>
                    ) : null}
                  </p>
                </div>

                {plataforma ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-ink-700">
                      <Switch
                        checked={c.ativo}
                        disabled={ativar.isPending}
                        onCheckedChange={() => ativar.mutate(c)}
                        aria-label={c.ativo ? "Desativar canal" : "Ativar canal"}
                      />
                      {c.ativo ? "Ativo" : "Inativo"}
                    </label>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={rotacao.isPending}>
                          <RotateCw className="size-4" aria-hidden /> Rotacionar segredo
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rotacionar o segredo de {c.nome}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A URL atual para de funcionar assim que a nova for gerada: chamadas com
                            o segredo antigo recebem 401. Atualize a URL no provedor logo em
                            seguida.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => rotacao.mutate(c)}>
                            Gerar nova URL
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {plataforma ? (
        <NovoCanal
          ctx={ctx}
          aberto={criando}
          agentes={agentes.data?.itens ?? []}
          onFechar={() => setCriando(false)}
          onCriado={(url) => {
            setSegredo({ titulo: "URL do webhook do novo canal", url });
            void recarregar();
          }}
        />
      ) : null}

      <SegredoUmaVez
        titulo={segredo?.titulo ?? ""}
        descricao="Cadastre esta URL no provedor do canal. Ela contém o segredo que autentica as mensagens recebidas."
        valor={segredo?.url ?? null}
        onFechar={() => setSegredo(null)}
      />
    </>
  );
}
