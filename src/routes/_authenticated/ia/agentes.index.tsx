import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Etiqueta,
  PaginaGateway,
  RotuloCampo,
  type ContextoGateway,
} from "@/components/luxtia/Gateway";
import { ChipFiltro } from "@/components/luxtia/Superficie";
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
import { filtrarAgentes } from "@/lib/gateway/agentes";
import { ehAgenteDeTeste } from "@/lib/gateway/ocultos";
import { itensDaVisao, prontidao, resumoProntidao } from "@/lib/gateway/prontidao";
import type { AgenteGateway, PapelGateway } from "@/lib/gateway/tipos";
import { RESPOSTAS, SITUACAO_AGENTE } from "@/lib/gateway/vocabulario";

export const Route = createFileRoute("/_authenticated/ia/agentes/")({
  head: () => ({ meta: [{ title: "Agentes | Luxtia" }] }),
  component: () => (
    <PaginaGateway titulo="Agentes" papeis={["plataforma", "gestor", "supervisor"]} telaCheia>
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

  const [procura, setProcura] = useState("");
  const [status, setStatus] = useState("");
  const lista = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa } }),
  });
  const agentes = lista.data?.itens ?? [];
  const visiveis = filtrarAgentes(agentes, { busca: procura, status });
  const busca = ctx.empresa ? { empresa: ctx.empresa } : {};
  const contar = (s: string) => agentes.filter((a) => a.status === s).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-200 px-3 py-1.5">
        <div className="relative min-w-40 flex-1 sm:max-w-64">
          <Search
            className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-500"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Procurar agente"
            placeholder="Procurar agente"
            className="h-8 pl-7 text-sm"
            value={procura}
            onChange={(e) => setProcura(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-0.5" role="group" aria-label="Filtrar por situação">
          <ChipFiltro
            ativo={!status}
            rotulo="Todos"
            total={agentes.length}
            onClick={() => setStatus("")}
          />
          {(["ativo", "pausado", "rascunho"] as const).map((s) => (
            <ChipFiltro
              key={s}
              ativo={status === s}
              rotulo={SITUACAO_AGENTE[s]?.rotulo ?? s}
              total={contar(s)}
              onClick={() => setStatus(status === s ? "" : s)}
            />
          ))}
        </div>
        {plataforma ? (
          <Button size="sm" className="ml-auto" onClick={() => setCriando(true)}>
            <Plus className="size-4" aria-hidden /> Novo agente
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          aria-hidden
          className={`sticky top-0 z-10 hidden gap-3 border-b border-base-200 bg-card/95 px-4 py-1.5 text-xs font-medium text-ink-500 backdrop-blur lg:grid ${COLUNAS}`}
        >
          <span>Agente</span>
          <span>Situação</span>
          <span>Respostas</span>
          <span>Prontidão</span>
          <span>Canais</span>
          <span />
        </div>
        {lista.isLoading ? (
          <p className="p-4 text-sm text-ink-500">Carregando…</p>
        ) : lista.error ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {(lista.error as Error).message}
          </p>
        ) : visiveis.length === 0 ? (
          <p className="p-4 text-sm text-ink-500">
            {agentes.length
              ? "Nenhum agente com esses filtros."
              : plataforma
                ? "Nenhum agente ainda. Crie o primeiro a partir de um modelo pronto."
                : "Nenhum agente ainda. Fale com a administração da plataforma."}
          </p>
        ) : (
          <ul>
            {visiveis.map((a) => (
              <li key={a.id}>
                <LinhaAgente agente={a} busca={busca} papel={ctx.papel} />
              </li>
            ))}
          </ul>
        )}
      </div>

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
    </div>
  );
}

const COLUNAS = "lg:grid-cols-[minmax(0,2fr)_110px_110px_150px_70px_16px]";

function LinhaAgente({
  agente,
  busca,
  papel,
}: {
  agente: AgenteGateway;
  busca: { empresa?: string };
  papel: PapelGateway;
}) {
  // A lista do gateway já traz canais e circuito de cada agente.
  const ligados = (agente.canais ?? []).map((c) => ({ ...c, agente_id: agente.id }));
  const circuito = agente.circuito_estado
    ? { estado: agente.circuito_estado, falhas: 0, aberto_ate: null, ultimo_alerta: null }
    : null;
  // Mesma conta da Visão geral: cada papel vê só os itens que são dele.
  const { prontos, total } = resumoProntidao(
    itensDaVisao(prontidao(agente, ligados, circuito), papel),
  );
  const situacao = SITUACAO_AGENTE[agente.status];

  return (
    <Link
      to="/ia/agentes/$agenteId"
      params={{ agenteId: agente.id }}
      search={busca}
      className={`grid grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 gap-y-1 border-b border-base-200/70 px-4 py-2 transition-colors hover:bg-purple-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${COLUNAS}`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink-900">{agente.nome}</span>
        {ehAgenteDeTeste(agente.nome) ||
        (agente.circuito_estado && agente.circuito_estado !== "fechado") ? (
          <span className="block truncate text-xs">
            {ehAgenteDeTeste(agente.nome) ? (
              <span className="text-gold-700">Teste: escondido da empresa </span>
            ) : null}
            {agente.circuito_estado && agente.circuito_estado !== "fechado" ? (
              <span className="text-destructive">Skyone com falhas</span>
            ) : null}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-4 text-ink-300 lg:order-last" aria-hidden />
      <span className="max-lg:col-span-2 lg:contents">
        <span className="inline-block lg:block">
          <Etiqueta tom={situacao?.tom ?? "neutro"}>{situacao?.rotulo ?? agente.status}</Etiqueta>
        </span>
        <span className="ml-2 text-xs text-ink-700 lg:ml-0">
          {RESPOSTAS[agente.agente_mode ?? "mock"] ?? RESPOSTAS["mock"]}
        </span>
        <span className="ml-2 inline-flex items-center gap-2 lg:ml-0 lg:flex">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-base-200 lg:flex-1">
            <span
              className="block h-full rounded-full bg-success"
              style={{ width: `${total ? (prontos / total) * 100 : 0}%` }}
            />
          </span>
          <span className="text-xs tabular-nums text-ink-500">
            {prontos} de {total}
          </span>
        </span>
        <span className="hidden text-xs tabular-nums text-ink-700 lg:block">{ligados.length}</span>
      </span>
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
