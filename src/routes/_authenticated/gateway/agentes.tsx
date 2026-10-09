import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Etiqueta, PaginaGateway, type ContextoGateway } from "@/components/luxtia/Gateway";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  alterarAgente,
  criarAgente,
  listarAgentes,
  listarModelos,
  obterAgente,
  testarAgente,
} from "@/lib/gateway-agentes.functions";
import type { AgenteDetalhe, AgenteGateway, ResultadoTeste } from "@/lib/gateway/tipos";

export const Route = createFileRoute("/_authenticated/gateway/agentes")({
  head: () => ({ meta: [{ title: "Agentes | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Agentes"
      descricao="Comportamento, conexão com o Skyone e teste de cada agente."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <Agentes key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

const STATUS: Record<
  AgenteGateway["status"],
  { rotulo: string; tom: "sucesso" | "alerta" | "neutro" }
> = {
  ativo: { rotulo: "Ativo", tom: "sucesso" },
  pausado: { rotulo: "Pausado", tom: "alerta" },
  rascunho: { rotulo: "Rascunho", tom: "neutro" },
};

function Agentes({ ctx }: { ctx: ContextoGateway }) {
  const listar = useServerFn(listarAgentes);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const plataforma = ctx.papel === "plataforma";

  const lista = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa } }),
  });
  const agentes = lista.data?.itens ?? [];

  useEffect(() => {
    const primeiro = lista.data?.itens[0];
    if (!selecionado && primeiro) setSelecionado(primeiro.id);
  }, [lista.data, selecionado]);

  return (
    <>
      {plataforma ? (
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setCriando(true)}>
            <Plus className="size-4" aria-hidden /> Novo agente
          </Button>
        </div>
      ) : null}

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Cartao>
          {lista.isLoading ? (
            <p className="px-5 py-8 text-ink-500">Carregando…</p>
          ) : lista.error ? (
            <EstadoVazio
              titulo="Não foi possível carregar"
              texto={(lista.error as Error).message}
            />
          ) : agentes.length === 0 ? (
            <EstadoVazio titulo="Nenhum agente" texto="Esta empresa ainda não tem agentes." />
          ) : (
            <ul>
              {agentes.map((a) => (
                <li key={a.id} className="border-b border-base-200 last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelecionado(a.id)}
                    aria-current={selecionado === a.id ? "true" : undefined}
                    className={`w-full px-5 py-4 text-left transition-colors hover:bg-purple-50 ${selecionado === a.id ? "bg-purple-50 shadow-[inset_3px_0_0_0_var(--gold-500)]" : ""}`}
                  >
                    <p className="font-medium text-ink-900">{a.nome}</p>
                    <p className="truncate font-mono text-xs text-ink-500">{a.id}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Etiqueta tom={STATUS[a.status].tom}>{STATUS[a.status].rotulo}</Etiqueta>
                      <Etiqueta tom={a.provedor === "skyone" ? "roxo" : "neutro"}>
                        {a.provedor}
                      </Etiqueta>
                      {a.circuito_estado && a.circuito_estado !== "fechado" ? (
                        <Etiqueta tom="perigo">
                          circuito {a.circuito_estado.replace("_", " ")}
                        </Etiqueta>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {selecionado ? <DetalheAgente key={selecionado} ctx={ctx} agenteId={selecionado} /> : null}
      </div>

      {plataforma ? (
        <NovoAgente
          ctx={ctx}
          aberto={criando}
          onFechar={() => setCriando(false)}
          onCriado={(id) => setSelecionado(id)}
        />
      ) : null}
    </>
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
      toast.success("Agente criado como rascunho, com provedor mock.");
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
            O agente nasce em rascunho, com o comportamento do modelo e provedor mock.
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
            <Label htmlFor="ag-modelo">Modelo</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger id="ag-modelo">
                <SelectValue placeholder={modelos.isLoading ? "Carregando…" : "Escolha o modelo"} />
              </SelectTrigger>
              <SelectContent>
                {(modelos.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} · v{m.versao}
                    {m.tenant_id ? " (privado)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {modelos.error ? (
              <p className="text-xs text-destructive">{(modelos.error as Error).message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ag-nome">Nome</Label>
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

/** Valores do formulário como texto; vazio significa herdar (null). */
type Formulario = Record<string, string>;

const NUMERICOS = [
  "debounce_s",
  "max_wait_s",
  "pause_minutes",
  "slow_notice_s",
  "timeout_s",
] as const;

function paraTexto(valor: unknown) {
  if (valor === null || valor === undefined) return "";
  if (Array.isArray(valor)) return valor.join("\n");
  return String(valor);
}

function paraValor(campo: string, texto: string): unknown {
  const t = texto.trim();
  if (t === "") return null;
  if ((NUMERICOS as readonly string[]).includes(campo)) return Number(t);
  if (campo === "modo_piloto") return t === "true";
  if (campo === "contatos_permitidos") {
    return t
      .split(/[\s,;]+/)
      .map((c) => c.replace(/\D/g, ""))
      .filter(Boolean);
  }
  if (campo === "alerta_telefone") return t.replace(/\D/g, "");
  return texto;
}

/** Só os campos alterados, para não enviar o que o papel não pode mudar. */
function diferencas(campos: string[], form: Formulario, original: Record<string, unknown>) {
  const dados: Record<string, unknown> = {};
  for (const campo of campos) {
    const texto = form[campo] ?? "";
    if (texto !== paraTexto(original[campo])) dados[campo] = paraValor(campo, texto);
  }
  return dados;
}

const CAMPOS_COMPORTAMENTO = [
  "status",
  "debounce_s",
  "max_wait_s",
  "pause_minutes",
  "slow_notice_s",
  "aviso_demora",
  "fallback",
  "modo_piloto",
  "contatos_permitidos",
  "alerta_telefone",
];

const ORIGEM: Record<string, string> = {
  plataforma: "padrão da plataforma",
  modelo: "modelo",
  tenant: "empresa",
  agente: "agente",
};

function DetalheAgente({ ctx, agenteId }: { ctx: ContextoGateway; agenteId: string }) {
  const queryClient = useQueryClient();
  const obter = useServerFn(obterAgente);
  const alterar = useServerFn(alterarAgente);
  const plataforma = ctx.papel === "plataforma";
  const podeEditar = plataforma || ctx.papel === "admin";

  const detalhe = useQuery({
    queryKey: ["gateway", "agente", ctx.empresa, agenteId],
    queryFn: () => obter({ data: { empresa: ctx.empresa, agente: agenteId } }),
  });
  const agente = detalhe.data;

  const camposComportamento = plataforma ? ["nome", ...CAMPOS_COMPORTAMENTO] : CAMPOS_COMPORTAMENTO;
  const [form, setForm] = useState<Formulario>({});
  useEffect(() => {
    if (!agente) return;
    const valores: Formulario = {};
    for (const campo of camposComportamento) {
      valores[campo] = paraTexto((agente as Record<string, unknown>)[campo]);
    }
    setForm(valores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agente]);

  const salvar = useMutation({
    mutationFn: (dados: Record<string, unknown>) =>
      alterar({ data: { empresa: ctx.empresa, agente: agenteId, dados } }),
    onSuccess: async () => {
      toast.success("Agente atualizado.");
      await queryClient.invalidateQueries({
        queryKey: ["gateway", "agente", ctx.empresa, agenteId],
      });
      await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detalhe.isLoading) return <Cartao className="p-6 text-ink-500">Carregando…</Cartao>;
  if (detalhe.error || !agente) {
    return (
      <Cartao>
        <EstadoVazio
          titulo="Não foi possível abrir o agente"
          texto={(detalhe.error as Error | null)?.message ?? "Tente de novo."}
        />
      </Cartao>
    );
  }

  const efetiva = agente.configuracao_efetiva ?? {};
  const origem = (efetiva["origem_config"] ?? {}) as Record<string, string>;
  const herdado = (campo: string) => {
    const valor = efetiva[campo];
    if (valor === undefined || valor === null || (Array.isArray(valor) && valor.length === 0))
      return "vazio";
    return `${paraTexto(valor).replace(/\n/g, ", ")} (${ORIGEM[origem[campo] ?? ""] ?? "herdado"})`;
  };
  const campo = (nome: string) => ({
    id: `ag-${nome}`,
    value: form[nome] ?? "",
    disabled: !podeEditar,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [nome]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      <Cartao className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-purple-800">{agente.nome}</h2>
            <p className="font-mono text-xs text-ink-500">
              {agente.id} · modelo {agente.modelo_id} v{agente.modelo_versao}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Etiqueta tom={STATUS[agente.status].tom}>{STATUS[agente.status].rotulo}</Etiqueta>
            <Etiqueta tom="roxo">
              {String(efetiva["agente_mode"] ?? agente.agente_mode ?? "mock")} /{" "}
              {String(efetiva["send_mode"] ?? agente.send_mode ?? "dry")}
            </Etiqueta>
          </div>
        </div>

        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const dados = diferencas(camposComportamento, form, agente as Record<string, unknown>);
            if (Object.keys(dados).length === 0) {
              toast.info("Nada foi alterado.");
              return;
            }
            salvar.mutate(dados);
          }}
        >
          <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-ink-500">
            Comportamento
          </h3>
          <p className="-mt-3 text-xs text-ink-500">
            Campo vazio herda o valor do modelo, da empresa ou da plataforma.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {plataforma ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ag-nome">Nome</Label>
                <Input {...campo("nome")} required />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="ag-status">Situação</Label>
              <Select
                value={form["status"] ?? ""}
                disabled={!podeEditar}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger id="ag-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  {plataforma || agente.status === "rascunho" ? (
                    <SelectItem value="rascunho" disabled={!plataforma}>
                      Rascunho
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-modo_piloto">Modo piloto</Label>
              <Select
                value={form["modo_piloto"] || "herdar"}
                disabled={!podeEditar}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, modo_piloto: v === "herdar" ? "" : v }))
                }
              >
                <SelectTrigger id="ag-modo_piloto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="herdar">Herdar ({herdado("modo_piloto")})</SelectItem>
                  <SelectItem value="true">Ligado: só contatos permitidos</SelectItem>
                  <SelectItem value="false">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(
              [
                ["debounce_s", "Espera para juntar mensagens (s)", 1, 15],
                ["max_wait_s", "Espera máxima (s)", 1, 30],
                ["pause_minutes", "Pausa após atendimento humano (min)", 0, undefined],
                ["slow_notice_s", "Aviso de demora após (s)", 0, undefined],
              ] as const
            ).map(([nome, rotulo, min, max]) => (
              <div key={nome} className="space-y-2">
                <Label htmlFor={`ag-${nome}`}>{rotulo}</Label>
                <Input
                  {...campo(nome)}
                  type="number"
                  min={min}
                  {...(max !== undefined ? { max } : {})}
                  placeholder={herdado(nome)}
                />
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ag-aviso_demora">Mensagem de demora</Label>
              <Textarea {...campo("aviso_demora")} rows={2} placeholder={herdado("aviso_demora")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ag-fallback">Mensagem de falha (fallback)</Label>
              <Textarea {...campo("fallback")} rows={2} placeholder={herdado("fallback")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-contatos_permitidos">Contatos permitidos no piloto</Label>
              <Textarea
                {...campo("contatos_permitidos")}
                rows={3}
                placeholder="Um telefone por linha, só números (8 a 16 dígitos)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-alerta_telefone">Telefone para alertas</Label>
              <Input
                {...campo("alerta_telefone")}
                inputMode="numeric"
                placeholder={herdado("alerta_telefone")}
              />
            </div>
          </div>

          {podeEditar ? (
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar comportamento"}
            </Button>
          ) : (
            <p className="text-xs text-ink-500">Seu acesso permite apenas consultar este agente.</p>
          )}
        </form>
      </Cartao>

      {plataforma ? <Skyone ctx={ctx} agente={agente} /> : null}
      {podeEditar ? <Testar ctx={ctx} agente={agente} /> : null}
    </div>
  );
}

const CAMPOS_SKYONE = [
  "provedor",
  "agente_mode",
  "skyone_webhook_url",
  "skyone_auth_tipo",
  "timeout_s",
  "instrucoes_agente",
];

function Skyone({ ctx, agente }: { ctx: ContextoGateway; agente: AgenteDetalhe }) {
  const queryClient = useQueryClient();
  const alterar = useServerFn(alterarAgente);
  const [form, setForm] = useState<Formulario>({});
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  useEffect(() => {
    const valores: Formulario = {};
    for (const campo of CAMPOS_SKYONE) {
      valores[campo] = paraTexto((agente as Record<string, unknown>)[campo]);
    }
    setForm(valores);
  }, [agente]);

  const salvar = useMutation({
    mutationFn: (dados: Record<string, unknown>) =>
      alterar({ data: { empresa: ctx.empresa, agente: agente.id, dados } }),
    onSuccess: async () => {
      toast.success("Configuração do Skyone salva.");
      setUsuario("");
      setSenha("");
      await queryClient.invalidateQueries({
        queryKey: ["gateway", "agente", ctx.empresa, agente.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (nome: string) => (v: string) => setForm((f) => ({ ...f, [nome]: v }));
  const basic = form["skyone_auth_tipo"] === "basic";
  const tiposOutros = ["bearer", "cabecalho"].includes(agente.skyone_auth_tipo);

  return (
    <Cartao className="p-6">
      <form
        className="space-y-5"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          const dados = diferencas(CAMPOS_SKYONE, form, agente as Record<string, unknown>);
          // Credenciais são só de escrita: vão apenas quando preenchidas.
          if (usuario.trim()) dados["skyone_auth_usuario"] = usuario.trim();
          if (senha) dados["skyone_auth"] = senha;
          if (Object.keys(dados).length === 0) {
            toast.info("Nada foi alterado.");
            return;
          }
          salvar.mutate(dados);
        }}
      >
        <div>
          <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-ink-500">Skyone</h3>
          <p className="mt-1 text-xs text-ink-500">
            O fluxo do Skyone é criado do zero no Skyone. O envio aos clientes continua em modo
            simulado (send_mode {String(agente.configuracao_efetiva?.["send_mode"] ?? "dry")}).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sk-provedor">Provedor</Label>
            <Select value={form["provedor"] ?? ""} onValueChange={set("provedor")}>
              <SelectTrigger id="sk-provedor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">mock (simulado)</SelectItem>
                <SelectItem value="skyone">skyone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sk-modo">Modo do agente</Label>
            <Select
              value={form["agente_mode"] || "herdar"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, agente_mode: v === "herdar" ? "" : v }))
              }
            >
              <SelectTrigger id="sk-modo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="herdar">
                  Herdar ({String(agente.configuracao_efetiva?.["agente_mode"] ?? "mock")})
                </SelectItem>
                <SelectItem value="mock">mock: responde sem chamar o Skyone</SelectItem>
                <SelectItem value="live">live: chama o Skyone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sk-url">URL do webhook do fluxo</Label>
            <Input
              id="sk-url"
              type="url"
              value={form["skyone_webhook_url"] ?? ""}
              placeholder="https://luxtia.api.integrasky.cloud/…"
              onChange={(e) => set("skyone_webhook_url")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sk-auth">Autenticação</Label>
            <Select value={form["skyone_auth_tipo"] ?? ""} onValueChange={set("skyone_auth_tipo")}>
              <SelectTrigger id="sk-auth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                <SelectItem value="basic">Basic (usuário e senha)</SelectItem>
                {tiposOutros ? (
                  <SelectItem value={agente.skyone_auth_tipo}>
                    {agente.skyone_auth_tipo} (atual)
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sk-timeout">Tempo limite (s)</Label>
            <Input
              id="sk-timeout"
              type="number"
              min={1}
              max={600}
              value={form["timeout_s"] ?? ""}
              placeholder="90"
              onChange={(e) => set("timeout_s")(e.target.value)}
            />
          </div>
          {basic ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="sk-usuario" className="flex items-center gap-2">
                  Usuário
                  {agente.skyone_auth_usuario_configurado ? <Configurado /> : null}
                </Label>
                <Input
                  id="sk-usuario"
                  value={usuario}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    agente.skyone_auth_usuario_configurado
                      ? "Deixe em branco para manter"
                      : "flow-<id-do-fluxo>@luxtia"
                  }
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sk-senha" className="flex items-center gap-2">
                  Senha
                  {agente.skyone_auth_configurado ? <Configurado /> : null}
                </Label>
                <Input
                  id="sk-senha"
                  type="password"
                  value={senha}
                  autoComplete="new-password"
                  placeholder={agente.skyone_auth_configurado ? "Deixe em branco para manter" : ""}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <p className="text-xs text-ink-500 sm:col-span-2">
                Usuário e senha são só de escrita: o painel nunca mostra os valores salvos.
              </p>
            </>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sk-instrucoes">Instruções complementares ao agente</Label>
            <Textarea
              id="sk-instrucoes"
              rows={3}
              value={form["instrucoes_agente"] ?? ""}
              onChange={(e) => set("instrucoes_agente")(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar Skyone"}
        </Button>
      </form>
    </Cartao>
  );
}

function Configurado() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-normal text-success">
      configurado <CheckCircle2 className="size-3.5" aria-label="✓" />
    </span>
  );
}

function Testar({ ctx, agente }: { ctx: ContextoGateway; agente: AgenteDetalhe }) {
  const testar = useServerFn(testarAgente);
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const modo = String(agente.configuracao_efetiva?.["agente_mode"] ?? agente.agente_mode ?? "mock");

  const mutation = useMutation({
    mutationFn: () => testar({ data: { empresa: ctx.empresa, agente: agente.id } }),
    onMutate: () => {
      setResultado(null);
      setErro(null);
    },
    onSuccess: setResultado,
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <Cartao className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-ink-500">Testar</h3>
          <p className="mt-1 text-xs text-ink-500">
            {modo === "live"
              ? "Envia “teste do painel” ao Skyone com a URL e a credencial do agente. Nada vai ao cliente."
              : "Em modo mock o teste responde sem chamar o Skyone."}
          </p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          Testar agente
        </Button>
      </div>
      {resultado ? (
        <div className="mt-4 rounded-lg border border-base-200 bg-base-50 p-4" aria-live="polite">
          <p className="text-xs font-medium text-success">
            Respondeu em {resultado.latencia_ms.toLocaleString("pt-BR")} ms
          </p>
          <ul className="mt-2 space-y-2">
            {resultado.resposta.map((linha, i) => (
              <li
                key={i}
                className="whitespace-pre-wrap rounded-md bg-card px-3 py-2 text-sm text-ink-900"
              >
                {linha}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {erro ? (
        <p
          className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
          aria-live="polite"
        >
          {erro}
        </p>
      ) : null}
    </Cartao>
  );
}
