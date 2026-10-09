/** Aba Canais do agente: canais ligados a ele; criar e ativar só para a plataforma. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Etiqueta,
  SegredoUmaVez,
  Vazio,
  dataHora,
  type ContextoGateway,
} from "@/components/luxtia/Gateway";
import { NovoCanal } from "@/components/luxtia/NovoCanal";
import { Cartao } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { alterarCanal } from "@/lib/gateway-canais.functions";
import type { AgenteDetalhe, CanalGateway } from "@/lib/gateway/tipos";
import { PUBLICO_CANAL, TIPO_CANAL } from "@/lib/gateway/vocabulario";

export function CanaisDoAgente({
  ctx,
  agente,
  canais,
  criando,
  onCriando,
}: {
  ctx: ContextoGateway;
  agente: AgenteDetalhe;
  canais: CanalGateway[];
  criando: boolean;
  onCriando: (aberto: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const alterar = useServerFn(alterarCanal);
  const plataforma = ctx.papel === "plataforma";
  // URL com segredo: só em memória, até o usuário fechar o aviso.
  const [url, setUrl] = useState<string | null>(null);
  const doAgente = canais.filter((c) => c.agente_id === agente.id);

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

  const botaoCriar = (
    <Button onClick={() => onCriando(true)}>
      <Plus className="size-4" aria-hidden /> Criar canal para este agente
    </Button>
  );

  return (
    <>
      <Cartao>
        {doAgente.length === 0 ? (
          <Vazio
            titulo="Nenhum canal ainda"
            texto={
              plataforma
                ? "Crie um canal para conectar o WhatsApp ou testar pelo Simular."
                : "Peça à administração da plataforma para conectar o WhatsApp ou um canal de testes."
            }
            {...(plataforma ? { acao: botaoCriar } : {})}
          />
        ) : (
          <>
            <ul>
              {doAgente.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-4 border-b border-base-200 px-5 py-4 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{c.nome}</p>
                      <Etiqueta tom="roxo">{TIPO_CANAL[c.tipo] ?? c.tipo}</Etiqueta>
                      {c.publico === "interno" ? (
                        <Etiqueta>{PUBLICO_CANAL["interno"]}</Etiqueta>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {c.ultimo_evento_em
                        ? `Última mensagem ${dataHora(c.ultimo_evento_em)}`
                        : "Nenhuma mensagem recebida ainda"}
                    </p>
                  </div>
                  {plataforma ? (
                    <label className="flex items-center gap-2 text-sm text-ink-700">
                      <Switch
                        checked={c.ativo}
                        disabled={ativar.isPending}
                        onCheckedChange={() => ativar.mutate(c)}
                        aria-label={c.ativo ? "Desativar canal" : "Ativar canal"}
                      />
                      {c.ativo ? "Ativo" : "Desativado"}
                    </label>
                  ) : (
                    <Etiqueta tom={c.ativo ? "sucesso" : "neutro"}>
                      {c.ativo ? "Ativo" : "Desativado"}
                    </Etiqueta>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-200 px-5 py-4">
              <Link
                to="/ia/canais"
                className="text-sm font-medium text-purple-700 underline-offset-2 hover:underline"
              >
                Ver todos os canais da empresa
              </Link>
              {plataforma ? botaoCriar : null}
            </div>
          </>
        )}
      </Cartao>

      {plataforma ? (
        <NovoCanal
          ctx={ctx}
          aberto={criando}
          agentes={[{ id: agente.id, nome: agente.nome }]}
          agenteFixo={agente.id}
          onFechar={() => onCriando(false)}
          onCriado={(webhookUrl) => {
            setUrl(webhookUrl);
            void recarregar();
          }}
        />
      ) : null}

      <SegredoUmaVez
        titulo="URL do webhook do novo canal"
        descricao="Cadastre esta URL no provedor do canal. Ela contém o segredo que autentica as mensagens recebidas."
        valor={url}
        onFechar={() => setUrl(null)}
      />
    </>
  );
}
