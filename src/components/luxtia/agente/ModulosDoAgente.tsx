/**
 * Aba/seção "Módulos" do agente — mostra os módulos permitidos, da empresa e
 * ligados no agente (MULTI1-a §10.3). Admin e plataforma podem mudar os
 * módulos ligados; plataforma pode ligar/desligar na empresa.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ajuda, Etiqueta, type ContextoGateway } from "@/components/luxtia/Gateway";
import { Cartao } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  alterarModuloEmpresa,
  alterarModulosAgente,
  obterModulosAgente,
} from "@/lib/gateway-modulos.functions";
import { peloMenos } from "@/lib/acesso/papeis";
import { rotuloModulo, type ModulosAgente } from "@/lib/gateway/modulos";

export function ModulosDoAgente({ ctx, agenteId }: { ctx: ContextoGateway; agenteId: string }) {
  const obter = useServerFn(obterModulosAgente);
  const plataforma = ctx.papel === "plataforma";
  const admin = peloMenos(ctx.papel, "gestor");

  const dados = useQuery({
    queryKey: ["gateway", "modulos-agente", ctx.empresa, agenteId],
    queryFn: () => obter({ data: { empresa: ctx.empresa, agente: agenteId } }),
  });

  if (dados.isLoading) return <p className="mt-4 text-ink-500">Carregando módulos…</p>;
  if (dados.error) {
    return (
      <Cartao className="p-5">
        <p className="text-sm text-destructive">
          Não foi possível carregar os módulos: {(dados.error as Error).message}
        </p>
      </Cartao>
    );
  }
  if (!dados.data) return null;

  const mod = dados.data;

  return (
    <div className="space-y-4">
      <Cartao className="p-5">
        <h3 className="font-medium text-ink-900">Módulos do agente</h3>
        <p className="mt-1 text-sm text-ink-500">
          Modelo: <strong>{mod.modelo.nome}</strong> v{mod.modelo.versao} · segmento:{" "}
          <strong>{mod.segmento}</strong>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Etiqueta tom="roxo">
            Efetivos: {mod.modulos.length > 0 ? mod.modulos.map(rotuloModulo).join(", ") : "nenhum"}
          </Etiqueta>
        </div>
        <Ajuda>
          Um módulo está ativo no agente quando as três condições valem: está nos permitidos do
          modelo, está ligado na empresa e está ligado no agente.
        </Ajuda>
      </Cartao>

      {/* Módulos ligados no agente */}
      {admin ? (
        <ModulosLigados ctx={ctx} agenteId={agenteId} mod={mod} />
      ) : (
        <Cartao className="p-5">
          <h3 className="font-medium text-ink-900">Módulos ligados no agente</h3>
          <p className="mt-2 text-sm text-ink-500">
            {mod.ligados_no_agente === null
              ? `Usando o padrão do modelo (${mod.padrao_do_modelo.map(rotuloModulo).join(", ") || "nenhum"}).`
              : mod.ligados_no_agente.map(rotuloModulo).join(", ") || "Nenhum."}
          </p>
        </Cartao>
      )}

      {/* Módulos da empresa (só plataforma) */}
      {plataforma ? <ModulosEmpresa ctx={ctx} mod={mod} /> : null}
    </div>
  );
}

function ModulosLigados({
  ctx,
  agenteId,
  mod,
}: {
  ctx: ContextoGateway;
  agenteId: string;
  mod: ModulosAgente;
}) {
  const queryClient = useQueryClient();
  const alterar = useServerFn(alterarModulosAgente);
  const [usaPadrao, setUsaPadrao] = useState(mod.ligados_no_agente === null);
  const [selecionados, setSelecionados] = useState<Set<string>>(
    new Set(mod.ligados_no_agente ?? mod.padrao_do_modelo),
  );

  // Só módulos permitidos pelo modelo que também estão ligados na empresa
  const disponiveis = mod.permitidos.filter((m) => mod.da_empresa[m] === true);

  const mutation = useMutation({
    mutationFn: () => {
      const valor = usaPadrao ? null : [...selecionados];
      return alterar({
        data: { empresa: ctx.empresa, agente: agenteId, modulos_ligados: valor },
      });
    },
    onSuccess: async () => {
      toast.success("Módulos do agente atualizados.");
      await queryClient.invalidateQueries({
        queryKey: ["gateway", "modulos-agente", ctx.empresa, agenteId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["gateway", "agente", ctx.empresa, agenteId],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleModulo(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
    if (usaPadrao) setUsaPadrao(false);
  }

  return (
    <Cartao className="p-5">
      <h3 className="font-medium text-ink-900">Módulos ligados no agente</h3>

      <div className="mt-3 flex items-center gap-3">
        <Switch
          id="usa-padrao"
          checked={usaPadrao}
          onCheckedChange={(v) => {
            setUsaPadrao(v);
            if (v) setSelecionados(new Set(mod.padrao_do_modelo));
          }}
        />
        <Label htmlFor="usa-padrao" className="text-sm">
          Usar o padrão do modelo ({mod.padrao_do_modelo.map(rotuloModulo).join(", ") || "nenhum"})
        </Label>
      </div>
      <Ajuda>
        Quando ligado, o agente usa os módulos padrão do modelo (valor <code>null</code>).
        Desligando, você escolhe quais módulos ficam ativos.
      </Ajuda>

      {disponiveis.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {disponiveis.map((id) => (
            <li key={id} className="flex items-center gap-3">
              <Switch
                id={`mod-${id}`}
                checked={usaPadrao ? mod.padrao_do_modelo.includes(id) : selecionados.has(id)}
                disabled={usaPadrao}
                onCheckedChange={() => toggleModulo(id)}
              />
              <Label htmlFor={`mod-${id}`} className="text-sm">
                {rotuloModulo(id)}
              </Label>
              {!mod.da_empresa[id] ? <Etiqueta tom="alerta">Desligado na empresa</Etiqueta> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-500">
          {mod.permitidos.length === 0
            ? "Este modelo não tem módulos."
            : "Nenhum módulo permitido está ligado na empresa."}
        </p>
      )}

      {disponiveis.length > 0 ? (
        <Button
          className="mt-4"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Salvando…" : "Salvar módulos do agente"}
        </Button>
      ) : null}
    </Cartao>
  );
}

function ModulosEmpresa({ ctx, mod }: { ctx: ContextoGateway; mod: ModulosAgente }) {
  const queryClient = useQueryClient();
  const alterarFn = useServerFn(alterarModuloEmpresa);

  const mutation = useMutation({
    mutationFn: (args: { modulo: string; ativo: boolean }) =>
      alterarFn({ data: { empresa: ctx.empresa, modulo: args.modulo, ativo: args.ativo } }),
    onSuccess: async () => {
      toast.success("Módulo da empresa atualizado.");
      await queryClient.invalidateQueries({
        queryKey: ["gateway", "modulos-agente", ctx.empresa],
      });
      await queryClient.invalidateQueries({
        queryKey: ["gateway", "modulos-empresa", ctx.empresa],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (mod.permitidos.length === 0) return null;

  return (
    <Cartao className="p-5">
      <h3 className="font-medium text-ink-900">Módulos na empresa</h3>
      <p className="mt-1 text-sm text-ink-500">
        Ligar ou desligar um módulo vale para <strong>toda a empresa</strong>, não só para este
        agente.
      </p>
      <ul className="mt-3 space-y-2">
        {mod.permitidos.map((id) => {
          const ligado = mod.da_empresa[id] === true;
          return (
            <li key={id} className="flex items-center gap-3">
              <Switch
                id={`emp-${id}`}
                checked={ligado}
                disabled={mutation.isPending}
                onCheckedChange={(v) => mutation.mutate({ modulo: id, ativo: v })}
              />
              <Label htmlFor={`emp-${id}`} className="text-sm">
                {rotuloModulo(id)}
              </Label>
              <Etiqueta tom={ligado ? "sucesso" : "neutro"}>
                {ligado ? "Ligado" : "Desligado"}
              </Etiqueta>
            </li>
          );
        })}
      </ul>
      <Ajuda>
        Alteração vale para toda a empresa. Se um módulo for desligado, ele deixa de funcionar em
        todos os agentes desta empresa que o usam.
      </Ajuda>
    </Cartao>
  );
}
