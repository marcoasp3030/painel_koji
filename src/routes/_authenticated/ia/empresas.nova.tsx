import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConexaoIA } from "@/components/luxtia/agente/ConexaoIA";
import {
  Ajuda,
  Etiqueta,
  PaginaGateway,
  RotuloCampo,
  SegredoUmaVez,
  type ContextoGateway,
} from "@/components/luxtia/Gateway";
import { NovoCanal } from "@/components/luxtia/NovoCanal";
import { Simulador } from "@/components/luxtia/Simulador";
import { Cartao } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  alterarAgente,
  criarAgente,
  listarAgentes,
  listarModelos,
  obterAgente,
} from "@/lib/gateway-agentes.functions";
import { alterarCanal, listarCanais } from "@/lib/gateway-canais.functions";
import {
  criarEmpresaGateway,
  listarEmpresasGateway,
  vincularEmpresaGateway,
} from "@/lib/gateway-empresas.functions";
import { numeroOuNulo, paraIdentificador } from "@/lib/gateway/formulario";
import { conexaoSkyone } from "@/lib/gateway/prontidao";
import { CAMPO_EMPRESA, RESPOSTAS, TIPO_CANAL } from "@/lib/gateway/vocabulario";

type Busca = { empresa?: string; agente?: string; passo?: number };

export const Route = createFileRoute("/_authenticated/ia/empresas/nova")({
  validateSearch: (s: Record<string, unknown>): Busca => {
    const passo = Number(s["passo"]);
    return {
      ...(typeof s["empresa"] === "string" ? { empresa: s["empresa"] } : {}),
      ...(typeof s["agente"] === "string" ? { agente: s["agente"] } : {}),
      ...(Number.isInteger(passo) && passo >= 1 && passo <= 6 ? { passo } : {}),
    };
  },
  head: () => ({ meta: [{ title: "Nova empresa | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      sobretitulo="Empresas"
      titulo="Nova empresa"
      descricao="Seis passos, do cadastro à primeira conversa de teste. Cada passo é salvo na hora; dá para parar e continuar depois."
      papeis={["plataforma"]}
      semEmpresa
    >
      {() => <Assistente />}
    </PaginaGateway>
  ),
});

const PASSOS = [
  "Empresa",
  "Cliente do painel",
  "Agente",
  "IA (Skyone)",
  "Canal",
  "Simular",
] as const;

function Assistente() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const listarEmp = useServerFn(listarEmpresasGateway);
  const listarAg = useServerFn(listarAgentes);
  const obterAg = useServerFn(obterAgente);
  const listarCn = useServerFn(listarCanais);

  const empresas = useQuery({
    queryKey: ["gateway", "empresas"],
    queryFn: () => listarEmp({ data: {} }),
  });
  const empresa = empresas.data?.itens.find((e) => e.id === busca.empresa) ?? null;
  const ctx: ContextoGateway = { papel: "plataforma", empresa: empresa?.id ?? null };

  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
    enabled: Boolean(empresa),
  });
  const agenteId = busca.agente ?? agentes.data?.itens[0]?.id ?? null;
  const agente = useQuery({
    queryKey: ["gateway", "agente", ctx.empresa, agenteId],
    queryFn: () => obterAg({ data: { empresa: ctx.empresa, agente: agenteId! } }),
    enabled: Boolean(empresa && agenteId),
  });
  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    queryFn: () => listarCn({ data: { empresa: ctx.empresa } }),
    enabled: Boolean(empresa),
  });

  const vinculada = empresas.data?.empresasPainel.find((p) => p.gateway_tenant_id === empresa?.id);
  const canaisDoAgente = (canais.data?.itens ?? []).filter((c) => c.agente_id === agenteId);
  const feito = [
    Boolean(empresa),
    Boolean(vinculada),
    Boolean(agente.data),
    agente.data ? conexaoSkyone(agente.data) === "sim" : false,
    canaisDoAgente.length > 0,
    false,
  ];
  // Até onde dá para ir: sem empresa, só o passo 1; sem agente, até o 3.
  const alcance = !empresa ? 1 : !agente.data ? 3 : 6;
  const primeiroPendente = feito.findIndex((f, i) => !f && i + 1 !== 2 && i + 1 !== 4) + 1 || 6;
  const passo = Math.min(busca.passo ?? Math.min(primeiroPendente, alcance), alcance);

  const ir = (patch: Busca) => navigate({ search: (s: Busca) => ({ ...s, ...patch }) });

  if (busca.empresa && empresas.isLoading) return <p className="mt-8 text-ink-500">Carregando…</p>;

  return (
    <div className="mt-6 space-y-6">
      <Link
        to="/ia/empresas"
        className="inline-flex items-center gap-1 text-sm text-purple-700 underline-offset-2 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Empresas
      </Link>

      <nav aria-label="Passos">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PASSOS.map((nome, i) => {
            const n = i + 1;
            const atual = n === passo;
            const liberado = n <= alcance;
            return (
              <li key={nome}>
                <button
                  type="button"
                  disabled={!liberado}
                  aria-current={atual ? "step" : undefined}
                  onClick={() => ir({ passo: n })}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    atual
                      ? "border-purple-700 bg-purple-700 text-base-50"
                      : "border-base-200 bg-card text-ink-700 hover:border-purple-300"
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      feito[i]
                        ? "bg-success text-success-foreground"
                        : atual
                          ? "bg-base-50 text-purple-800"
                          : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {feito[i] ? <Check className="size-3.5" aria-label="feito" /> : n}
                  </span>
                  <span className="truncate">{nome}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {passo === 1 ? (
        <PassoEmpresa
          criada={empresa}
          onCriada={(id) => ir({ empresa: id, passo: 2 })}
          onContinuar={() => ir({ passo: 2 })}
        />
      ) : null}
      {passo === 2 && empresa ? (
        <PassoVinculo
          empresaId={empresa.id}
          painel={empresas.data?.empresasPainel ?? []}
          vinculadaA={vinculada?.name ?? null}
          onContinuar={() => ir({ passo: 3 })}
        />
      ) : null}
      {passo === 3 && empresa ? (
        <PassoAgente
          ctx={ctx}
          existentes={agentes.data?.itens ?? []}
          atual={agenteId}
          onEscolhido={(id) => ir({ agente: id, passo: 4 })}
        />
      ) : null}
      {passo === 4 && agente.data ? (
        <div className="space-y-4">
          <ConexaoIA ctx={ctx} agente={agente.data} />
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => ir({ passo: 5 })}>
              {String(agente.data.configuracao_efetiva?.["agente_mode"] ?? "mock") === "live"
                ? "Continuar"
                : `Continuar em ${RESPOSTAS["mock"]}`}
            </Button>
          </div>
        </div>
      ) : null}
      {passo === 5 && agente.data ? (
        <PassoCanal
          ctx={ctx}
          agente={{ id: agente.data.id, nome: agente.data.nome }}
          canais={canaisDoAgente}
          onContinuar={() => ir({ passo: 6 })}
        />
      ) : null}
      {passo === 6 && agente.data ? (
        <PassoSimular
          ctx={ctx}
          agente={agente.data}
          canais={canaisDoAgente}
          onConcluir={() =>
            navigate({
              to: "/ia/agentes/$agenteId",
              params: { agenteId: agente.data!.id },
              search: { empresa: ctx.empresa! },
            })
          }
        />
      ) : null}
    </div>
  );
}

function Cabeca({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <h2 className="font-display text-2xl text-purple-800">{titulo}</h2>
      <Ajuda>{texto}</Ajuda>
    </>
  );
}

function Pronto({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-center gap-2 text-sm font-medium text-success">
      <CheckCircle2 className="size-4" aria-hidden /> {children}
    </p>
  );
}

function PassoEmpresa({
  criada,
  onCriada,
  onContinuar,
}: {
  criada: { id: string; nome: string } | null;
  onCriada: (id: string) => void;
  onContinuar: () => void;
}) {
  const queryClient = useQueryClient();
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
    onSuccess: async (e) => {
      toast.success("Empresa criada.");
      await queryClient.invalidateQueries({ queryKey: ["gateway", "empresas"] });
      onCriada(e.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (criada) {
    return (
      <Cartao className="p-6">
        <Cabeca titulo="Empresa" texto="A empresa já foi criada." />
        <Pronto>
          {criada.nome} <span className="font-mono text-xs">({criada.id})</span>
        </Pronto>
        <Button className="mt-5" onClick={onContinuar}>
          Continuar
        </Button>
      </Cartao>
    );
  }

  return (
    <Cartao className="p-6">
      <Cabeca titulo="Empresa" texto="Os dados básicos. O identificador não muda depois." />
      <form
        className="mt-5 grid gap-5 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="space-y-1.5">
          <RotuloCampo htmlFor="nv-nome" campo={CAMPO_EMPRESA.nome} />
          <Input
            id="nv-nome"
            value={nome}
            required
            onChange={(e) => {
              setNome(e.target.value);
              if (!idManual) setId(paraIdentificador(e.target.value));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <RotuloCampo htmlFor="nv-id" campo={CAMPO_EMPRESA.id} />
          <Input
            id="nv-id"
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
        <div className="space-y-1.5">
          <RotuloCampo htmlFor="nv-plano" campo={CAMPO_EMPRESA.plano} />
          <Input id="nv-plano" value={plano} onChange={(e) => setPlano(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <RotuloCampo htmlFor="nv-limite" campo={CAMPO_EMPRESA.limite_turnos_mes} />
          <Input
            id="nv-limite"
            type="number"
            min={0}
            value={limite}
            placeholder="Sem limite"
            onChange={(e) => setLimite(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <RotuloCampo htmlFor="nv-fuso" campo={CAMPO_EMPRESA.timezone} />
          <Input id="nv-fuso" value={fuso} required onChange={(e) => setFuso(e.target.value)} />
        </div>
        <div className="flex items-end lg:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando…" : "Criar empresa"}
          </Button>
        </div>
      </form>
    </Cartao>
  );
}

const SEM_ESCOLHA = "__nenhum__";

function PassoVinculo({
  empresaId,
  painel,
  vinculadaA,
  onContinuar,
}: {
  empresaId: string;
  painel: { id: string; name: string; gateway_tenant_id: string | null }[];
  vinculadaA: string | null;
  onContinuar: () => void;
}) {
  const queryClient = useQueryClient();
  const vincular = useServerFn(vincularEmpresaGateway);
  const [escolha, setEscolha] = useState(SEM_ESCOLHA);
  const livres = painel.filter((p) => !p.gateway_tenant_id);

  const mutation = useMutation({
    mutationFn: () => vincular({ data: { gatewayTenantId: empresaId, painelTenantId: escolha } }),
    onSuccess: async () => {
      toast.success("Empresa ligada ao cliente do painel.");
      await queryClient.invalidateQueries({ queryKey: ["gateway", "empresas"] });
      onContinuar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Cartao className="p-6">
      <Cabeca
        titulo={CAMPO_EMPRESA.vinculo.rotulo}
        texto={`${CAMPO_EMPRESA.vinculo.ajuda} Se o cliente ainda não existe, crie-o em Clientes e volte depois.`}
      />
      {vinculadaA ? (
        <>
          <Pronto>Ligada a {vinculadaA}</Pronto>
          <Button className="mt-5" onClick={onContinuar}>
            Continuar
          </Button>
        </>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="nv-cliente">Cliente</Label>
            <Select value={escolha} onValueChange={setEscolha}>
              <SelectTrigger id="nv-cliente">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_ESCOLHA}>Escolha o cliente</SelectItem>
                {livres.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {livres.length === 0 ? (
              <Ajuda>Todos os clientes do painel já estão ligados a uma empresa.</Ajuda>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={escolha === SEM_ESCOLHA || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Ligando…" : "Vincular"}
            </Button>
            <Button variant="outline" onClick={onContinuar}>
              Fazer depois
            </Button>
          </div>
        </div>
      )}
    </Cartao>
  );
}

function PassoAgente({
  ctx,
  existentes,
  atual,
  onEscolhido,
}: {
  ctx: ContextoGateway;
  existentes: { id: string; nome: string }[];
  atual: string | null;
  onEscolhido: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const modelosFn = useServerFn(listarModelos);
  const criar = useServerFn(criarAgente);
  const [modelo, setModelo] = useState("");
  const [nome, setNome] = useState("");

  const modelos = useQuery({
    queryKey: ["gateway", "modelos", ctx.empresa],
    queryFn: () => modelosFn({ data: { empresa: ctx.empresa } }),
  });

  const mutation = useMutation({
    mutationFn: () => criar({ data: { empresa: ctx.empresa, modelo_id: modelo, nome } }),
    onSuccess: async (a) => {
      toast.success("Agente criado.");
      await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
      onEscolhido(a.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Cartao className="p-6">
      <Cabeca
        titulo="Agente"
        texto="Escolha um modelo pronto e dê um nome. O agente começa em rascunho e em simulação."
      />
      {existentes.length > 0 ? (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-ink-900">Agentes já criados nesta empresa</p>
          <ul className="flex flex-wrap gap-2">
            {existentes.map((a) => (
              <li key={a.id}>
                <Button
                  variant={a.id === atual ? "default" : "outline"}
                  size="sm"
                  onClick={() => onEscolhido(a.id)}
                >
                  {a.id === atual ? <Check className="size-4" aria-hidden /> : null}
                  Usar {a.nome}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!modelo) {
            toast.error("Escolha o modelo.");
            return;
          }
          mutation.mutate();
        }}
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink-900">
            {existentes.length ? "Ou crie outro a partir de um modelo" : "Modelo"}
          </legend>
          <Ajuda>Base pronta com o jeito de atender e as mensagens padrão.</Ajuda>
          {modelos.isLoading ? <p className="text-sm text-ink-500">Carregando modelos…</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {(modelos.data ?? []).map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  modelo === m.id
                    ? "border-purple-700 bg-purple-50"
                    : "border-base-200 hover:border-purple-300"
                }`}
              >
                <input
                  type="radio"
                  name="modelo"
                  value={m.id}
                  checked={modelo === m.id}
                  onChange={() => setModelo(m.id)}
                  className="mt-1 accent-[var(--purple-700)]"
                />
                <span>
                  <span className="block font-medium text-ink-900">{m.nome}</span>
                  <span className="text-xs text-ink-500">
                    Versão {m.versao}
                    {m.tenant_id ? " · só desta empresa" : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="max-w-sm space-y-1.5">
          <RotuloCampo
            htmlFor="nv-agente"
            campo={{ rotulo: "Nome do agente", ajuda: "Ex.: Atendimento loja." }}
          />
          <Input id="nv-agente" value={nome} required onChange={(e) => setNome(e.target.value)} />
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          <Plus className="size-4" aria-hidden /> {mutation.isPending ? "Criando…" : "Criar agente"}
        </Button>
      </form>
    </Cartao>
  );
}

function PassoCanal({
  ctx,
  agente,
  canais,
  onContinuar,
}: {
  ctx: ContextoGateway;
  agente: { id: string; nome: string };
  canais: { id: string; nome: string; tipo: string; ativo: boolean }[];
  onContinuar: () => void;
}) {
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  return (
    <Cartao className="p-6">
      <Cabeca
        titulo="Canal"
        texto="Por onde as mensagens chegam. Para testar agora, crie um canal API (para testes); o WhatsApp pode vir depois."
      />
      {canais.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {canais.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              <span className="font-medium text-ink-900">{c.nome}</span>
              <Etiqueta tom="roxo">{TIPO_CANAL[c.tipo] ?? c.tipo}</Etiqueta>
              <Etiqueta tom={c.ativo ? "sucesso" : "neutro"}>
                {c.ativo ? "Ativo" : "Desativado"}
              </Etiqueta>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant={canais.length ? "outline" : "default"} onClick={() => setCriando(true)}>
          <Plus className="size-4" aria-hidden />{" "}
          {canais.length ? "Criar outro canal" : "Criar canal"}
        </Button>
        {canais.length > 0 ? <Button onClick={onContinuar}>Continuar</Button> : null}
      </div>

      <NovoCanal
        ctx={ctx}
        aberto={criando}
        agentes={[agente]}
        agenteFixo={agente.id}
        onFechar={() => setCriando(false)}
        onCriado={(webhookUrl) => {
          setUrl(webhookUrl);
          void queryClient.invalidateQueries({ queryKey: ["gateway", "canais", ctx.empresa] });
        }}
      />
      <SegredoUmaVez
        titulo="URL do webhook do novo canal"
        descricao="Para o canal API, guarde-a para integrar um sistema depois; o Simular não precisa dela. Para o WhatsApp, cadastre-a na Uazapi."
        valor={url}
        onFechar={() => setUrl(null)}
      />
    </Cartao>
  );
}

function PassoSimular({
  ctx,
  agente,
  canais,
  onConcluir,
}: {
  ctx: ContextoGateway;
  agente: { id: string; nome: string; status: string };
  canais: { id: string; nome: string; tipo: string; ativo: boolean }[];
  onConcluir: () => void;
}) {
  const queryClient = useQueryClient();
  const alterarAg = useServerFn(alterarAgente);
  const alterarCn = useServerFn(alterarCanal);
  const api = canais.filter((c) => c.tipo === "api");
  const apiAtivo = api.find((c) => c.ativo);

  const recarregar = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["gateway", "agente", ctx.empresa, agente.id],
    });
    await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
    await queryClient.invalidateQueries({ queryKey: ["gateway", "canais", ctx.empresa] });
  };

  const ativarAgente = useMutation({
    mutationFn: () =>
      alterarAg({ data: { empresa: ctx.empresa, agente: agente.id, dados: { status: "ativo" } } }),
    onSuccess: async () => {
      toast.success("Agente ativado.");
      await recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ativarCanal = useMutation({
    mutationFn: (id: string) =>
      alterarCn({ data: { empresa: ctx.empresa, canal: id, dados: { ativo: true } } }),
    onSuccess: async () => {
      toast.success("Canal ativado.");
      await recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendencias: { texto: string; botao?: React.ReactNode }[] = [];
  if (agente.status !== "ativo") {
    pendencias.push({
      texto: "O agente precisa estar ativo para responder.",
      botao: (
        <Button size="sm" disabled={ativarAgente.isPending} onClick={() => ativarAgente.mutate()}>
          Ativar agente
        </Button>
      ),
    });
  }
  if (api.length === 0) {
    pendencias.push({ texto: "Crie um canal API (para testes) no passo anterior." });
  } else if (!apiAtivo) {
    pendencias.push({
      texto: "O canal API está desativado.",
      botao: (
        <Button
          size="sm"
          disabled={ativarCanal.isPending}
          onClick={() => ativarCanal.mutate(api[0]!.id)}
        >
          Ativar canal
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <Cartao className="p-6">
        <Cabeca
          titulo="Simular"
          texto="Mande uma mensagem como se fosse um cliente e veja a resposta. Nada é enviado aos clientes."
        />
        {pendencias.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {pendencias.map((p) => (
              <li
                key={p.texto}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gold-300/20 px-4 py-2 text-sm text-gold-700"
              >
                {p.texto}
                {p.botao}
              </li>
            ))}
          </ul>
        ) : null}
      </Cartao>
      <Simulador ctx={ctx} agenteInicial={agente.id} agenteFixo />
      <div className="flex justify-end">
        <Button onClick={onConcluir}>Concluir e abrir o agente</Button>
      </div>
    </div>
  );
}
