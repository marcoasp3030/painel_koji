import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Etiqueta,
  PaginaGateway,
  RotuloCampo,
  Vazio,
  type ContextoGateway,
} from "@/components/luxtia/Gateway";
import { Cartao, EstadoVazio } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarAgente, listarAgentes, listarModelos } from "@/lib/gateway-agentes.functions";
import { ehAgenteDeTeste } from "@/lib/gateway/ocultos";
import { prontidao, resumoProntidao } from "@/lib/gateway/prontidao";
import type { AgenteGateway } from "@/lib/gateway/tipos";
import { RESPOSTAS, SITUACAO_AGENTE } from "@/lib/gateway/vocabulario";

export const Route = createFileRoute("/_authenticated/ia/agentes/")({
  head: () => ({ meta: [{ title: "Agentes | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Agentes"
      descricao="Escolha um agente para ver se está pronto, ajustar o comportamento e testar."
      papeis={["plataforma", "gestor", "supervisor"]}
    >
      {(ctx) => <Agentes key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

const CAMPO_MODELO = {
  rotulo: "Modelo",
  ajuda: "Base pronta com o jeito de atender e as mensagens padrão.",
};
const CAMPO_NOME = {
  rotulo: "Nome",
  ajuda: "Como o agente aparece no painel. Ex.: Atendimento loja.",
};

function Agentes({ ctx }: { ctx: ContextoGateway }) {
  const navigate = useNavigate();
  const listar = useServerFn(listarAgentes);
  const [criando, setCriando] = useState(false);
  const plataforma = ctx.papel === "plataforma";

  const lista = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa } }),
  });
  const agentes = lista.data?.itens ?? [];
  const busca = ctx.empresa ? { empresa: ctx.empresa } : {};

  const botaoCriar = (
    <Button onClick={() => setCriando(true)}>
      <Plus className="size-4" aria-hidden /> {agentes.length ? "Novo agente" : "Criar agente"}
    </Button>
  );

  return (
    <>
      {plataforma && agentes.length > 0 ? (
        <div className="mt-6 flex justify-end">{botaoCriar}</div>
      ) : null}

      {lista.isLoading ? (
        <p className="mt-8 text-ink-500">Carregando…</p>
      ) : lista.error ? (
        <Cartao className="mt-6">
          <EstadoVazio titulo="Não foi possível carregar" texto={(lista.error as Error).message} />
        </Cartao>
      ) : agentes.length === 0 ? (
        <Cartao className="mt-6">
          <Vazio
            titulo="Nenhum agente ainda"
            texto={
              plataforma
                ? "Crie o primeiro a partir de um modelo pronto."
                : "Fale com a administração da plataforma."
            }
            {...(plataforma ? { acao: botaoCriar } : {})}
          />
        </Cartao>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agentes.map((a) => (
            <li key={a.id}>
              <CartaoAgente agente={a} busca={busca} />
            </li>
          ))}
        </ul>
      )}

      {plataforma ? (
        <NovoAgente
          ctx={ctx}
          aberto={criando}
          onFechar={() => setCriando(false)}
          onCriado={(id) =>
            navigate({ to: "/ia/agentes/$agenteId", params: { agenteId: id }, search: busca })
          }
        />
      ) : null}
    </>
  );
}

function CartaoAgente({ agente, busca }: { agente: AgenteGateway; busca: { empresa?: string } }) {
  // A lista do gateway já traz canais e circuito de cada agente.
  const ligados = (agente.canais ?? []).map((c) => ({ ...c, agente_id: agente.id }));
  const circuito = agente.circuito_estado
    ? { estado: agente.circuito_estado, falhas: 0, aberto_ate: null, ultimo_alerta: null }
    : null;
  const { prontos, total } = resumoProntidao(prontidao(agente, ligados, circuito));
  const situacao = SITUACAO_AGENTE[agente.status];

  return (
    <Link
      to="/ia/agentes/$agenteId"
      params={{ agenteId: agente.id }}
      search={busca}
      className="group block h-full rounded-xl border border-base-200 bg-card p-5 shadow-[0_1px_2px_rgba(26,21,32,0.04)] transition-colors hover:border-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-lg text-purple-800">{agente.nome}</p>
        <ChevronRight
          className="mt-1 size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Etiqueta tom={situacao?.tom ?? "neutro"}>{situacao?.rotulo ?? agente.status}</Etiqueta>
        {ehAgenteDeTeste(agente.nome) ? (
          <Etiqueta tom="alerta">Teste: escondido da empresa</Etiqueta>
        ) : null}
        <Etiqueta tom={agente.agente_mode === "live" ? "roxo" : "neutro"}>
          Respostas: {RESPOSTAS[agente.agente_mode ?? "mock"] ?? RESPOSTAS["mock"]}
        </Etiqueta>
        {agente.circuito_estado && agente.circuito_estado !== "fechado" ? (
          <Etiqueta tom="perigo">Skyone com falhas</Etiqueta>
        ) : null}
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-ink-500">
          <span>Prontidão</span>
          <span>
            {prontos} de {total}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-base-200">
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${total ? (prontos / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        {ligados.length === 0
          ? "Nenhum canal ligado"
          : ligados.length === 1
            ? "1 canal ligado"
            : `${ligados.length} canais ligados`}
      </p>
    </Link>
  );
}

function NovoAgente({
  ctx,
  aberto,
  onFechar,
  onCriado,
}: {
  ctx: ContextoGateway;
  aberto: boolean;
  onFechar: () => void;
  onCriado: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const buscarModelos = useServerFn(listarModelos);
  const criar = useServerFn(criarAgente);
  const [modelo, setModelo] = useState("");
  const [nome, setNome] = useState("");

  const modelos = useQuery({
    queryKey: ["gateway", "modelos", ctx.empresa],
    queryFn: () => buscarModelos({ data: { empresa: ctx.empresa } }),
    enabled: aberto,
  });

  const mutation = useMutation({
    mutationFn: () => criar({ data: { empresa: ctx.empresa, modelo_id: modelo, nome } }),
    onSuccess: async (agente) => {
      toast.success("Agente criado em rascunho, com respostas em simulação.");
      setNome("");
      await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
      onCriado(agente.id);
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo agente</DialogTitle>
          <DialogDescription>
            O agente nasce em rascunho e em simulação. Depois você confere a prontidão, liga um
            canal e conecta a IA.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!modelo) {
              toast.error("Escolha o modelo.");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <RotuloCampo htmlFor="ag-modelo" campo={CAMPO_MODELO} />
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger id="ag-modelo">
                <SelectValue placeholder={modelos.isLoading ? "Carregando…" : "Escolha o modelo"} />
              </SelectTrigger>
              <SelectContent>
                {(modelos.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} · v{m.versao}
                    {m.tenant_id ? " (só desta empresa)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {modelos.error ? (
              <p className="text-xs text-destructive">{(modelos.error as Error).message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <RotuloCampo htmlFor="ag-nome" campo={CAMPO_NOME} />
            <Input id="ag-nome" value={nome} required onChange={(e) => setNome(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando…" : "Criar agente"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
