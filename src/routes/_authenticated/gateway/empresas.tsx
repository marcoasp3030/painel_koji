import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Etiqueta, PaginaGateway, dataHora } from "@/components/luxtia/Gateway";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  alterarEmpresaGateway,
  criarEmpresaGateway,
  listarEmpresasGateway,
  vincularEmpresaGateway,
} from "@/lib/gateway-empresas.functions";
import type { EmpresaGateway, EmpresaPainel } from "@/lib/gateway/tipos";

export const Route = createFileRoute("/_authenticated/gateway/empresas")({
  head: () => ({ meta: [{ title: "Empresas · Agentes | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Empresas do gateway"
      descricao="Cada empresa tem seus agentes, canais e chaves. Ligue-a ao cliente do painel para que a equipe dele tenha acesso."
      papeis={["plataforma"]}
      semEmpresa
    >
      {() => <Empresas />}
    </PaginaGateway>
  ),
});

const SEM_VINCULO = "__nenhum__";

function paraId(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function numeroOuNulo(valor: string) {
  const texto = valor.trim();
  return texto === "" ? null : Number(texto);
}

function Empresas() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarEmpresasGateway);
  const alterar = useServerFn(alterarEmpresaGateway);
  const vincular = useServerFn(vincularEmpresaGateway);
  const [extras, setExtras] = useState<EmpresaGateway[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<EmpresaGateway | null>(null);

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

  const status = useMutation({
    mutationFn: (e: EmpresaGateway) =>
      alterar({
        data: { id: e.id, dados: { status: e.status === "ativo" ? "suspenso" : "ativo" } },
      }),
    onSuccess: (e) => {
      toast.success(e.status === "ativo" ? "Empresa reativada." : "Empresa suspensa.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vinculo = useMutation({
    mutationFn: (v: { gatewayTenantId: string; painelTenantId: string | null }) =>
      vincular({ data: v }),
    onSuccess: () => {
      toast.success("Vínculo atualizado.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empresas = [...(data?.itens ?? []), ...extras];
  const proximo = extras.length > 0 ? cursor : (data?.proximo_cursor ?? null);
  const painel: EmpresaPainel[] = data?.empresasPainel ?? [];

  return (
    <>
      <div className="mt-6 flex justify-end">
        <Button onClick={() => setCriando(true)}>
          <Plus className="size-4" aria-hidden /> Nova empresa
        </Button>
      </div>

      <Cartao className="mt-4">
        {isLoading ? (
          <p className="px-5 py-8 text-ink-500">Carregando…</p>
        ) : error ? (
          <EstadoVazio titulo="Não foi possível carregar" texto={(error as Error).message} />
        ) : empresas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma empresa" texto="Cadastre a primeira empresa do gateway." />
        ) : (
          <ul>
            {empresas.map((e) => {
              const ligada = painel.find((p) => p.gateway_tenant_id === e.id);
              return (
                <li
                  key={e.id}
                  className="flex flex-col gap-4 border-b border-base-200 px-5 py-4 last:border-0 xl:flex-row xl:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{e.nome}</p>
                      <Etiqueta tom={e.status === "ativo" ? "sucesso" : "perigo"}>
                        {e.status === "ativo" ? "Ativa" : "Suspensa"}
                      </Etiqueta>
                      {e.tenant_teste ? <Etiqueta tom="alerta">Teste</Etiqueta> : null}
                      {e.plano ? <Etiqueta tom="roxo">{e.plano}</Etiqueta> : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      <span className="font-mono">{e.id}</span> · {e.timezone} · limite{" "}
                      {e.limite_turnos_mes ?? "sem limite"} turnos/mês · retenção{" "}
                      {e.retencao_dias ?? "—"} dias · criada {dataHora(e.criado_em)}
                    </p>
                  </div>

                  <div className="w-full space-y-1 xl:w-64">
                    <Label className="text-xs text-ink-500">Cliente do painel</Label>
                    <Select
                      value={ligada?.id ?? SEM_VINCULO}
                      disabled={vinculo.isPending}
                      onValueChange={(valor) =>
                        vinculo.mutate({
                          gatewayTenantId: e.id,
                          painelTenantId: valor === SEM_VINCULO ? null : valor,
                        })
                      }
                    >
                      <SelectTrigger className="bg-base-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VINCULO}>Sem vínculo</SelectItem>
                        {painel.map((p) => (
                          <SelectItem
                            key={p.id}
                            value={p.id}
                            disabled={Boolean(p.gateway_tenant_id && p.gateway_tenant_id !== e.id)}
                          >
                            {p.name}
                            {p.gateway_tenant_id && p.gateway_tenant_id !== e.id
                              ? ` (ligado a ${p.gateway_tenant_id})`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditando(e)}>
                      <Pencil className="size-4" aria-hidden /> Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={status.isPending}>
                          {e.status === "ativo" ? "Suspender" : "Reativar"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {e.status === "ativo" ? "Suspender" : "Reativar"} {e.nome}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {e.status === "ativo"
                              ? "Com a empresa suspensa, as mensagens recebidas são ignoradas e os agentes não respondem."
                              : "Os agentes ativos voltam a responder às mensagens recebidas."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => status.mutate(e)}>
                            {e.status === "ativo" ? "Suspender" : "Reativar"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>

      {proximo ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={maisPaginas.isPending}
            onClick={() => maisPaginas.mutate(proximo)}
          >
            {maisPaginas.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Carregar mais
          </Button>
        </div>
      ) : null}

      <NovaEmpresa aberto={criando} onFechar={() => setCriando(false)} onCriada={recarregar} />
      {editando ? (
        <EditarEmpresa
          empresa={editando}
          onFechar={() => setEditando(null)}
          onSalva={recarregar}
        />
      ) : null}
    </>
  );
}

function NovaEmpresa({
  aberto,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada: () => Promise<unknown>;
}) {
  const criar = useServerFn(criarEmpresaGateway);
  const [nome, setNome] = useState("");
  const [id, setId] = useState("");
  const [idManual, setIdManual] = useState(false);
  const [plano, setPlano] = useState("");
  const [limite, setLimite] = useState("");
  const [fuso, setFuso] = useState("America/Sao_Paulo");

  const mutation = useMutation({
    mutationFn: () =>
      criar({
        data: {
          id,
          nome,
          plano: plano.trim() || null,
          limite_turnos_mes: numeroOuNulo(limite),
          timezone: fuso,
        },
      }),
    onSuccess: async () => {
      toast.success("Empresa criada. Ela começa sem agentes e sem canais.");
      setNome("");
      setId("");
      setIdManual(false);
      setPlano("");
      setLimite("");
      await onCriada();
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
          <DialogDescription>O identificador não pode ser alterado depois.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="emp-nome">Nome</Label>
            <Input
              id="emp-nome"
              value={nome}
              required
              onChange={(e) => {
                setNome(e.target.value);
                if (!idManual) setId(paraId(e.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-id">Identificador</Label>
            <Input
              id="emp-id"
              value={id}
              required
              pattern="[a-z0-9_]{3,40}"
              title="3 a 40 letras minúsculas, números ou _"
              className="font-mono"
              onChange={(e) => {
                setIdManual(true);
                setId(e.target.value);
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emp-plano">Plano</Label>
              <Input id="emp-plano" value={plano} onChange={(e) => setPlano(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-limite">Limite de turnos/mês</Label>
              <Input
                id="emp-limite"
                type="number"
                min={0}
                value={limite}
                placeholder="Sem limite"
                onChange={(e) => setLimite(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-fuso">Fuso horário</Label>
            <Input id="emp-fuso" value={fuso} required onChange={(e) => setFuso(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando…" : "Criar empresa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarEmpresa({
  empresa,
  onFechar,
  onSalva,
}: {
  empresa: EmpresaGateway;
  onFechar: () => void;
  onSalva: () => Promise<unknown>;
}) {
  const alterar = useServerFn(alterarEmpresaGateway);
  const [nome, setNome] = useState(empresa.nome);
  const [plano, setPlano] = useState(empresa.plano ?? "");
  const [limite, setLimite] = useState(empresa.limite_turnos_mes?.toString() ?? "");
  const [fuso, setFuso] = useState(empresa.timezone);
  const [retencao, setRetencao] = useState(empresa.retencao_dias?.toString() ?? "");
  const [teste, setTeste] = useState(empresa.tenant_teste);

  const mutation = useMutation({
    mutationFn: () => {
      // Envia só o que mudou.
      const dados: Record<string, unknown> = {};
      if (nome !== empresa.nome) dados["nome"] = nome;
      if ((plano.trim() || null) !== empresa.plano) dados["plano"] = plano.trim() || null;
      if (numeroOuNulo(limite) !== empresa.limite_turnos_mes) dados["limite_turnos_mes"] = numeroOuNulo(limite);
      if (fuso !== empresa.timezone) dados["timezone"] = fuso;
      if (retencao.trim() && Number(retencao) !== empresa.retencao_dias) dados["retencao_dias"] = Number(retencao);
      if (teste !== empresa.tenant_teste) dados["tenant_teste"] = teste;
      return alterar({ data: { id: empresa.id, dados } });
    },
    onSuccess: async () => {
      toast.success("Empresa atualizada.");
      await onSalva();
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {empresa.nome}</DialogTitle>
          <DialogDescription>
            Identificador <span className="font-mono">{empresa.id}</span> (não muda).
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ed-nome">Nome</Label>
            <Input id="ed-nome" value={nome} required onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ed-plano">Plano</Label>
              <Input id="ed-plano" value={plano} onChange={(e) => setPlano(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-limite">Limite de turnos/mês</Label>
              <Input
                id="ed-limite"
                type="number"
                min={0}
                value={limite}
                placeholder="Sem limite"
                onChange={(e) => setLimite(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-fuso">Fuso horário</Label>
              <Input id="ed-fuso" value={fuso} required onChange={(e) => setFuso(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-ret">Retenção (dias)</Label>
              <Input
                id="ed-ret"
                type="number"
                min={1}
                value={retencao}
                onChange={(e) => setRetencao(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-base-200 bg-base-50 px-4 py-3">
            <div>
              <Label htmlFor="ed-teste" className="text-sm">
                Empresa de teste
              </Label>
              <p className="text-xs text-ink-500">Permite modo live sem credencial (SEG13).</p>
            </div>
            <Switch id="ed-teste" checked={teste} onCheckedChange={setTeste} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
