import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Capacidade } from "@/components/luxtia/Capacidade";
import { ModulosDaEmpresa } from "@/components/luxtia/ModulosDaEmpresa";
import { Ajuda, Etiqueta, PaginaGateway, RotuloCampo, dataHora } from "@/components/luxtia/Gateway";
import { ChipFiltro } from "@/components/luxtia/Superficie";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  alterarEmpresaGateway,
  listarEmpresasGateway,
  vincularEmpresaGateway,
} from "@/lib/gateway-empresas.functions";
import {
  casaFiltroEmpresa,
  clienteDaEmpresa,
  filtrarEmpresas,
  type FiltroEmpresa,
} from "@/lib/gateway/empresas";
import { numeroOuNulo } from "@/lib/gateway/formulario";
import type { EmpresaGateway, EmpresaPainel } from "@/lib/gateway/tipos";
import { CAMPO_EMPRESA } from "@/lib/gateway/vocabulario";

export const Route = createFileRoute("/_authenticated/ia/empresas/")({
  head: () => ({ meta: [{ title: "Empresas · Agentes | Luxtia" }] }),
  component: () => (
    <PaginaGateway titulo="Empresas do gateway" papeis={["plataforma"]} semEmpresa telaCheia>
      {() => <Empresas />}
    </PaginaGateway>
  ),
});

const FILTROS: { id: FiltroEmpresa; rotulo: string }[] = [
  { id: "ativas", rotulo: "Ativas" },
  { id: "suspensas", rotulo: "Suspensas" },
  { id: "teste", rotulo: "Teste" },
  { id: "sem_vinculo", rotulo: "Sem vínculo" },
];
const COLUNAS = "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_120px_90px_90px_16px]";

function Empresas() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarEmpresasGateway);
  const [extras, setExtras] = useState<EmpresaGateway[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroEmpresa>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["gateway", "empresas"],
    queryFn: () => listar({ data: {} }),
  });

  const maisPaginas = useMutation({
    mutationFn: (c: string) => listar({ data: { cursor: c } }),
    onSuccess: (pagina) => {
      setExtras((atual) => [...atual, ...pagina.itens]);
      setCursor(pagina.proximo_cursor);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recarregar = () => {
    setExtras([]);
    setCursor(null);
    return queryClient.invalidateQueries({ queryKey: ["gateway", "empresas"] });
  };

  const empresas = [...(data?.itens ?? []), ...extras];
  const proximo = extras.length > 0 ? cursor : (data?.proximo_cursor ?? null);
  const painel: EmpresaPainel[] = data?.empresasPainel ?? [];
  const lista = filtrarEmpresas(empresas, painel, { busca, filtro });
  const aberta = empresas.find((e) => e.id === abertaId) ?? null;

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
            aria-label="Procurar empresa"
            placeholder="Nome, identificador ou cliente"
            className="h-8 pl-7 text-sm"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] max-sm:order-last max-sm:w-full">
          <ChipFiltro
            ativo={!filtro}
            rotulo="Todas"
            total={empresas.length}
            onClick={() => setFiltro("")}
          />
          {FILTROS.map((f) => (
            <ChipFiltro
              key={f.id}
              ativo={filtro === f.id}
              rotulo={f.rotulo}
              total={empresas.filter((e) => casaFiltroEmpresa(e, f.id, painel)).length}
              onClick={() => setFiltro(filtro === f.id ? "" : f.id)}
            />
          ))}
        </div>
        <Button asChild size="sm" className="ml-auto">
          <Link to="/ia/empresas/nova">
            <Plus className="size-4" aria-hidden /> Nova empresa
          </Link>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          aria-hidden
          className={`sticky top-0 z-10 hidden gap-3 border-b border-base-200 bg-card/95 px-4 py-1.5 text-xs font-medium text-ink-500 backdrop-blur lg:grid ${COLUNAS}`}
        >
          <span>Empresa</span>
          <span>Cliente do painel</span>
          <span>Plano</span>
          <span>Limite/mês</span>
          <span>Guarda</span>
          <span>Situação</span>
          <span />
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-ink-500">Carregando…</p>
        ) : error ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {(error as Error).message}
          </p>
        ) : lista.length === 0 ? (
          <p className="p-4 text-sm text-ink-500">
            {empresas.length
              ? "Nenhuma empresa com esses filtros."
              : "Crie a primeira empresa para cadastrar agentes, canais e chaves."}
          </p>
        ) : (
          <ul>
            {lista.map((e) => {
              const cliente = clienteDaEmpresa(e, painel);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setAbertaId(e.id)}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 gap-y-0.5 border-b border-base-200/70 px-4 py-2 text-left transition-colors hover:bg-purple-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${COLUNAS}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {e.nome}
                        {e.tenant_teste ? (
                          <span className="ml-1.5 text-xs font-normal text-gold-700">teste</span>
                        ) : null}
                      </span>
                      <span className="block truncate font-mono text-xs text-ink-500">{e.id}</span>
                    </span>
                    <ChevronRight className="size-4 text-ink-300 lg:order-last" aria-hidden />
                    <span
                      className={`min-w-0 truncate text-xs max-lg:col-span-2 ${cliente ? "text-ink-700" : "text-gold-700"}`}
                    >
                      {cliente?.name ?? "Sem vínculo"}
                    </span>
                    <span className="hidden min-w-0 truncate text-xs text-ink-700 lg:block">
                      {e.plano ?? "—"}
                    </span>
                    <span className="hidden text-xs tabular-nums text-ink-700 lg:block">
                      {e.limite_turnos_mes?.toLocaleString("pt-BR") ?? "Sem limite"}
                    </span>
                    <span className="hidden text-xs tabular-nums text-ink-700 lg:block">
                      {e.retencao_dias ? `${e.retencao_dias} dias` : "—"}
                    </span>
                    <span className="max-lg:col-span-2">
                      <Etiqueta tom={e.status === "ativo" ? "sucesso" : "perigo"}>
                        {e.status === "ativo" ? "Ativa" : "Suspensa"}
                      </Etiqueta>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {proximo ? (
          <div className="flex justify-center p-3">
            <Button
              variant="outline"
              size="sm"
              disabled={maisPaginas.isPending}
              onClick={() => maisPaginas.mutate(proximo)}
            >
              {maisPaginas.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Carregar mais
            </Button>
          </div>
        ) : null}
      </div>

      <Sheet open={Boolean(aberta)} onOpenChange={(a) => !a && setAbertaId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {aberta ? (
            <PainelEmpresa
              key={aberta.id}
              empresa={aberta}
              painel={painel}
              recarregar={recarregar}
              fechar={() => setAbertaId(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PainelEmpresa({
  empresa,
  painel,
  recarregar,
  fechar,
}: {
  empresa: EmpresaGateway;
  painel: EmpresaPainel[];
  recarregar: () => Promise<unknown>;
  fechar: () => void;
}) {
  const alterar = useServerFn(alterarEmpresaGateway);
  const vincular = useServerFn(vincularEmpresaGateway);
  const [nome, setNome] = useState(empresa.nome);
  const [plano, setPlano] = useState(empresa.plano ?? "");
  const [limite, setLimite] = useState(empresa.limite_turnos_mes?.toString() ?? "");
  const [fuso, setFuso] = useState(empresa.timezone);
  const [retencao, setRetencao] = useState(empresa.retencao_dias?.toString() ?? "");
  const [teste, setTeste] = useState(empresa.tenant_teste);
  const [confirmarStatus, setConfirmarStatus] = useState(false);
  const [trocaVinculo, setTrocaVinculo] = useState<string | null>(null);
  const ligada = clienteDaEmpresa(empresa, painel);
  const ativa = empresa.status === "ativo";

  // Envia só o que mudou.
  const dados: Record<string, unknown> = {};
  if (nome !== empresa.nome) dados["nome"] = nome;
  if ((plano.trim() || null) !== empresa.plano) dados["plano"] = plano.trim() || null;
  if (numeroOuNulo(limite) !== empresa.limite_turnos_mes)
    dados["limite_turnos_mes"] = numeroOuNulo(limite);
  if (fuso !== empresa.timezone) dados["timezone"] = fuso;
  if (retencao.trim() && Number(retencao) !== empresa.retencao_dias)
    dados["retencao_dias"] = Number(retencao);
  if (teste !== empresa.tenant_teste) dados["tenant_teste"] = teste;
  const sujo = Object.keys(dados).length > 0;

  const salvar = useMutation({
    mutationFn: () => alterar({ data: { id: empresa.id, dados } }),
    onSuccess: async () => {
      toast.success("Empresa atualizada.");
      await recarregar();
      fechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const status = useMutation({
    mutationFn: () =>
      alterar({ data: { id: empresa.id, dados: { status: ativa ? "suspenso" : "ativo" } } }),
    onSuccess: async (e) => {
      toast.success(e.status === "ativo" ? "Empresa reativada." : "Empresa suspensa.");
      setConfirmarStatus(false);
      await recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const vinculo = useMutation({
    mutationFn: (painelTenantId: string | null) =>
      vincular({ data: { gatewayTenantId: empresa.id, painelTenantId } }),
    onSuccess: async () => {
      toast.success("Vínculo atualizado.");
      setTrocaVinculo(null);
      await recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function escolherCliente(valor: string) {
    // Trocar ou tirar um vínculo corta o acesso de quem já entra por ele.
    if (ligada) setTrocaVinculo(valor);
    else vinculo.mutate(valor || null);
  }

  return (
    <>
      <SheetHeader className="border-b border-base-200 px-4 py-3 text-left">
        <SheetTitle className="truncate pr-6">{empresa.nome}</SheetTitle>
        <SheetDescription>
          <span className="font-mono">{empresa.id}</span> · criada {dataHora(empresa.criado_em)}
        </SheetDescription>
      </SheetHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (sujo) salvar.mutate();
        }}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <RotuloCampo htmlFor="ed-cliente" campo={CAMPO_EMPRESA.vinculo} />
            <select
              id="ed-cliente"
              className="flex h-9 w-full rounded-md border bg-card px-2 text-sm"
              value={ligada?.id ?? ""}
              disabled={vinculo.isPending}
              onChange={(e) => escolherCliente(e.target.value)}
            >
              <option value="">Sem vínculo</option>
              {painel.map((p) => {
                const outra = Boolean(p.gateway_tenant_id && p.gateway_tenant_id !== empresa.id);
                return (
                  <option key={p.id} value={p.id} disabled={outra}>
                    {p.name}
                    {outra ? ` (ligado a ${p.gateway_tenant_id})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-1.5">
            <RotuloCampo htmlFor="ed-nome" campo={CAMPO_EMPRESA.nome} />
            <Input id="ed-nome" value={nome} required onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <RotuloCampo htmlFor="ed-plano" campo={CAMPO_EMPRESA.plano} />
              <Input id="ed-plano" value={plano} onChange={(e) => setPlano(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <RotuloCampo htmlFor="ed-limite" campo={CAMPO_EMPRESA.limite_turnos_mes} />
              <Input
                id="ed-limite"
                type="number"
                min={0}
                value={limite}
                placeholder="Sem limite"
                onChange={(e) => setLimite(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <RotuloCampo htmlFor="ed-fuso" campo={CAMPO_EMPRESA.timezone} />
              <Input id="ed-fuso" value={fuso} required onChange={(e) => setFuso(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <RotuloCampo htmlFor="ed-ret" campo={CAMPO_EMPRESA.retencao_dias} />
              <Input
                id="ed-ret"
                type="number"
                min={1}
                value={retencao}
                onChange={(e) => setRetencao(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="ed-teste" className="text-sm">
                {CAMPO_EMPRESA.tenant_teste.rotulo}
              </Label>
              <Ajuda>{CAMPO_EMPRESA.tenant_teste.ajuda}</Ajuda>
            </div>
            <Switch id="ed-teste" checked={teste} onCheckedChange={setTeste} />
          </div>
          <ModulosDaEmpresa empresa={empresa.id} />
          <details className="border-t border-base-200 pt-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-900">Avançado</summary>
            <div className="mt-3">
              <Capacidade empresa={empresa.id} />
            </div>
          </details>
          <section className="space-y-1.5 border-t border-base-200 pt-3" aria-label="Situação">
            <p className="text-xs text-ink-500">
              {ativa
                ? "Com a empresa suspensa, os agentes param de responder."
                : "Esta empresa está suspensa: os agentes não respondem."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={ativa ? "text-destructive" : ""}
              onClick={() => setConfirmarStatus(true)}
            >
              {ativa ? "Suspender empresa" : "Reativar empresa"}
            </Button>
          </section>
        </div>
        <div className="flex justify-end border-t border-base-200 p-3">
          <Button type="submit" disabled={!sujo || salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </form>

      <AlertDialog
        open={confirmarStatus}
        onOpenChange={(a) => !status.isPending && setConfirmarStatus(a)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ativa ? "Suspender" : "Reativar"} {empresa.nome}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ativa
                ? "Com a empresa suspensa, as mensagens recebidas são ignoradas e os agentes não respondem."
                : "Os agentes ativos voltam a responder às mensagens recebidas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={status.isPending}
              onClick={(e) => {
                e.preventDefault();
                status.mutate();
              }}
            >
              {ativa ? "Suspender" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={trocaVinculo !== null}
        onOpenChange={(a) => !a && !vinculo.isPending && setTrocaVinculo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {trocaVinculo ? "Trocar o cliente do painel?" : "Tirar o vínculo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Quem entra pelo cliente {ligada?.name} deixa de ver {empresa.nome}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={vinculo.isPending}
              onClick={(e) => {
                e.preventDefault();
                vinculo.mutate(trocaVinculo || null);
              }}
            >
              {trocaVinculo ? "Trocar" : "Tirar vínculo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
