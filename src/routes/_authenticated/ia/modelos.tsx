/** Tela "Modelos de agente" — só plataforma (MULTI1-a §10.2). */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Edit, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Ajuda,
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
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import {
  criarModeloAgente,
  editarModeloAgente,
  listarModelosAgente,
  obterModeloAgente,
} from "@/lib/gateway-modelos.functions";
import { rotuloModulo } from "@/lib/gateway/modulos";
import type { ItemRotulado, ModeloAgenteCompleto } from "@/lib/gateway/tipos";

export const Route = createFileRoute("/_authenticated/ia/modelos")({
  head: () => ({ meta: [{ title: "Modelos de agente | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Modelos de agente"
      descricao="Base de cada agente: segmento, módulos, motivos e tipos. Editar cria uma versão nova; agentes existentes ficam na versão em que estão."
      papeis={["plataforma"]}
      semEmpresa
    >
      {(ctx) => <Modelos ctx={ctx} />}
    </PaginaGateway>
  ),
});

// --- Lista ---

function Modelos({ ctx }: { ctx: ContextoGateway }) {
  const listar = useServerFn(listarModelosAgente);
  const [filtroAtivo, setFiltroAtivo] = useState<string>("todos");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const query: { ativo?: boolean } = {};
  if (filtroAtivo === "sim") query.ativo = true;
  if (filtroAtivo === "nao") query.ativo = false;

  const lista = useQuery({
    queryKey: ["gateway", "modelos-agente", filtroAtivo],
    queryFn: () => listar({ data: query }),
  });

  // Agrupa por id, mostra só a versão mais recente
  const ultimas = new Map<string, ModeloAgenteCompleto>();
  for (const m of lista.data ?? []) {
    const atual = ultimas.get(m.id);
    if (!atual || m.versao > atual.versao) ultimas.set(m.id, m);
  }
  const modelos = [...ultimas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (detalheId) {
    return <DetalheModelo id={detalheId} onVoltar={() => setDetalheId(null)} />;
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="w-48 space-y-1">
          <Label htmlFor="filtro-ativo">Situação</Label>
          <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
            <SelectTrigger id="filtro-ativo" className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sim">Ativos</SelectItem>
              <SelectItem value="nao">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCriando(true)}>
          <Plus className="size-4" aria-hidden /> Novo modelo
        </Button>
      </div>

      {lista.isLoading ? (
        <p className="mt-8 text-ink-500">Carregando…</p>
      ) : lista.error ? (
        <Cartao className="mt-6">
          <EstadoVazio titulo="Erro ao carregar" texto={(lista.error as Error).message} />
        </Cartao>
      ) : modelos.length === 0 ? (
        <Cartao className="mt-6">
          <Vazio
            titulo="Nenhum modelo"
            texto="Crie o primeiro modelo de agente."
            acao={
              <Button onClick={() => setCriando(true)}>
                <Plus className="size-4" aria-hidden /> Novo modelo
              </Button>
            }
          />
        </Cartao>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modelos.map((m) => (
            <li key={m.id}>
              <CartaoModelo modelo={m} onAbrir={() => setDetalheId(m.id)} />
            </li>
          ))}
        </ul>
      )}

      <NovoModelo aberto={criando} onFechar={() => setCriando(false)} />
    </>
  );
}

function CartaoModelo({ modelo, onAbrir }: { modelo: ModeloAgenteCompleto; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group block w-full rounded-xl border border-base-200 bg-card p-5 text-left shadow-[0_1px_2px_rgba(26,21,32,0.04)] transition-colors hover:border-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-lg text-purple-800">{modelo.nome}</p>
        <Edit
          className="mt-1 size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
      <p className="mt-1 text-xs text-ink-500">
        <span className="font-mono">{modelo.id}</span> · v{modelo.versao}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Etiqueta tom={modelo.ativo ? "sucesso" : "neutro"}>
          {modelo.ativo ? "Ativo" : "Inativo"}
        </Etiqueta>
        <Etiqueta tom="roxo">{modelo.segmento}</Etiqueta>
        <Etiqueta tom="neutro">{modelo.tipo}</Etiqueta>
      </div>
      {modelo.modulos_permitidos.length > 0 ? (
        <p className="mt-3 text-xs text-ink-500">
          Módulos: {modelo.modulos_permitidos.map(rotuloModulo).join(", ")}
        </p>
      ) : (
        <p className="mt-3 text-xs text-ink-500">Sem módulos</p>
      )}
    </button>
  );
}

// --- Detalhe ---

function DetalheModelo({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const obter = useServerFn(obterModeloAgente);
  const [editando, setEditando] = useState(false);

  const detalhe = useQuery({
    queryKey: ["gateway", "modelos-agente", id],
    queryFn: () => obter({ data: { id } }),
  });

  const modelo = detalhe.data;

  return (
    <div className="mt-6 space-y-6">
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center gap-1 text-sm text-purple-700 underline-offset-2 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Modelos
      </button>

      {detalhe.isLoading ? (
        <p className="text-ink-500">Carregando…</p>
      ) : detalhe.error || !modelo ? (
        <Cartao>
          <EstadoVazio
            titulo="Não foi possível abrir o modelo"
            texto={(detalhe.error as Error | null)?.message ?? "Tente de novo."}
          />
        </Cartao>
      ) : (
        <>
          <Cartao className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-purple-800">{modelo.nome}</h2>
                <p className="mt-1 text-sm text-ink-500">
                  <span className="font-mono">{modelo.id}</span> · versão {modelo.versao} ·{" "}
                  {modelo.tipo}
                </p>
              </div>
              <Button variant="outline" onClick={() => setEditando(true)}>
                <Edit className="size-4" aria-hidden /> Editar
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Etiqueta tom={modelo.ativo ? "sucesso" : "neutro"}>
                {modelo.ativo ? "Ativo" : "Inativo"}
              </Etiqueta>
              <Etiqueta tom="roxo">{modelo.segmento}</Etiqueta>
            </div>
          </Cartao>

          <div className="grid gap-4 md:grid-cols-2">
            <Cartao className="p-5">
              <h3 className="font-medium text-ink-900">Módulos permitidos</h3>
              {modelo.modulos_permitidos.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-ink-700">
                  {modelo.modulos_permitidos.map((m) => (
                    <li key={m} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-purple-400" />
                      {rotuloModulo(m)}
                      {modelo.modulos_padrao.includes(m) ? (
                        <span className="text-xs text-ink-500">(padrão)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-500">Nenhum módulo.</p>
              )}
            </Cartao>

            <Cartao className="p-5">
              <h3 className="font-medium text-ink-900">Referência Skyone</h3>
              <p className="mt-2 text-sm text-ink-700">
                {modelo.skyone_ref || <span className="text-ink-400">Não informada</span>}
              </p>
              <Ajuda>Só informativo: nome ou id do fluxo do Skyone que este modelo usa.</Ajuda>
            </Cartao>

            <SecaoListaRotulada
              titulo="Motivos de transferência"
              itens={modelo.motivos_transferencia}
            />
            <SecaoListaRotulada titulo="Tipos de solicitação" itens={modelo.tipos_solicitacao} />
          </div>

          <EditarModelo modelo={modelo} aberto={editando} onFechar={() => setEditando(false)} />
        </>
      )}
    </div>
  );
}

function SecaoListaRotulada({ titulo, itens }: { titulo: string; itens: ItemRotulado[] }) {
  return (
    <Cartao className="p-5">
      <h3 className="font-medium text-ink-900">{titulo}</h3>
      {itens.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-ink-700">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-purple-400" />
              {item.rotulo}
              <span className="font-mono text-xs text-ink-400">({item.id})</span>
              {item.converte_em_solicitacao ? (
                <Etiqueta tom="alerta">converte em solicitação</Etiqueta>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-500">Nenhum.</p>
      )}
    </Cartao>
  );
}

// --- Criar ---

const CAMPO_ID = {
  rotulo: "Identificador",
  ajuda: "De 3 a 80 letras minúsculas, números ou _. Não muda depois.",
};
const CAMPO_NOME = { rotulo: "Nome", ajuda: "Como o modelo aparece no painel." };
const CAMPO_SEGMENTO = {
  rotulo: "Segmento",
  ajuda: "Texto livre: delivery, servicos, financeiro, comercial, juridico, geral…",
};

function NovoModelo({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const criar = useServerFn(criarModeloAgente);
  const [id, setId] = useState("");
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState("");
  const [tipo, setTipo] = useState<"atendimento" | "interno">("atendimento");

  const mutation = useMutation({
    mutationFn: () => criar({ data: { id, nome, segmento, tipo, ativo: true } }),
    onSuccess: async () => {
      toast.success("Modelo criado (versão 1).");
      setId("");
      setNome("");
      setSegmento("");
      setTipo("atendimento");
      await queryClient.invalidateQueries({ queryKey: ["gateway", "modelos-agente"] });
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo modelo de agente</DialogTitle>
          <DialogDescription>
            Cria a versão 1 do modelo. Depois você pode editar — cada edição cria uma versão nova.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <RotuloCampo htmlFor="nm-id" campo={CAMPO_ID} />
            <Input
              id="nm-id"
              value={id}
              required
              pattern="[a-z0-9_]{3,80}"
              className="font-mono"
              onChange={(e) => setId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <RotuloCampo htmlFor="nm-nome" campo={CAMPO_NOME} />
            <Input id="nm-nome" value={nome} required onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <RotuloCampo htmlFor="nm-segmento" campo={CAMPO_SEGMENTO} />
            <Input
              id="nm-segmento"
              value={segmento}
              required
              pattern="[a-z0-9_]{2,40}"
              onChange={(e) => setSegmento(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nm-tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "atendimento" | "interno")}>
              <SelectTrigger id="nm-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atendimento">Atendimento</SelectItem>
                <SelectItem value="interno">Interno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Criando…" : "Criar modelo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Editar ---

function EditarModelo({
  modelo,
  aberto,
  onFechar,
}: {
  modelo: ModeloAgenteCompleto;
  aberto: boolean;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const editar = useServerFn(editarModeloAgente);

  const [nome, setNome] = useState(modelo.nome);
  const [segmento, setSegmento] = useState(modelo.segmento);
  const [tipo, setTipo] = useState(modelo.tipo);
  const [ativo, setAtivo] = useState(modelo.ativo);
  const [skyoneRef, setSkyoneRef] = useState(modelo.skyone_ref ?? "");
  const [modulosPermitidos, setModulosPermitidos] = useState(modelo.modulos_permitidos.join(", "));
  const [modulosPadrao, setModulosPadrao] = useState(modelo.modulos_padrao.join(", "));
  const [motivos, setMotivos] = useState(
    modelo.motivos_transferencia
      .map((m) => `${m.id}:${m.rotulo}${m.converte_em_solicitacao ? ":converte" : ""}`)
      .join("\n"),
  );
  const [tipos, setTipos] = useState(
    modelo.tipos_solicitacao.map((t) => `${t.id}:${t.rotulo}`).join("\n"),
  );

  function parsearItens(texto: string): ItemRotulado[] {
    return texto
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [id = "", rotulo = "", converte] = l.split(":");
        return {
          id: id.trim(),
          rotulo: rotulo.trim(),
          ...(converte?.trim() === "converte" ? { converte_em_solicitacao: true } : {}),
        };
      });
  }

  function parsearLista(texto: string): string[] {
    return texto
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const mutation = useMutation({
    mutationFn: () =>
      editar({
        data: {
          id: modelo.id,
          nome,
          segmento,
          tipo,
          ativo,
          skyone_ref: skyoneRef.trim() || null,
          modulos_permitidos: parsearLista(modulosPermitidos),
          modulos_padrao: parsearLista(modulosPadrao),
          motivos_transferencia: parsearItens(motivos),
          tipos_solicitacao: parsearItens(tipos),
        },
      }),
    onSuccess: async () => {
      toast.success(
        `Nova versão do modelo "${modelo.id}" criada. Agentes existentes ficam na versão anterior.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["gateway", "modelos-agente"] });
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar modelo: {modelo.id}</DialogTitle>
          <DialogDescription>
            <strong>Atenção:</strong> salvar cria uma <strong>nova versão</strong> do modelo.
            Agentes existentes continuam na versão em que estão — a mudança só vale para agentes
            novos ou que forem atualizados manualmente.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="rounded-lg border border-gold-500/60 bg-gold-300/20 px-4 py-3 text-sm text-gold-700">
            <strong>Nova versão:</strong> ao salvar, o gateway cria a versão{" "}
            <strong>{modelo.versao + 1}</strong>. Agentes na versão {modelo.versao} não mudam
            automaticamente.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <RotuloCampo htmlFor="ed-nome" campo={CAMPO_NOME} />
              <Input id="ed-nome" value={nome} required onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <RotuloCampo htmlFor="ed-segmento" campo={CAMPO_SEGMENTO} />
              <Input
                id="ed-segmento"
                value={segmento}
                required
                pattern="[a-z0-9_]{2,40}"
                onChange={(e) => setSegmento(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "atendimento" | "interno")}>
                <SelectTrigger id="ed-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendimento">Atendimento</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch id="ed-ativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="ed-ativo">
                {ativo ? "Ativo" : "Inativo"}{" "}
                <span className="text-xs text-ink-500">
                  (inativo some da criação; agentes existentes continuam)
                </span>
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ed-skyone-ref">Referência Skyone</Label>
            <Ajuda>Texto informativo: nome ou id do fluxo do Skyone.</Ajuda>
            <Input
              id="ed-skyone-ref"
              value={skyoneRef}
              maxLength={200}
              onChange={(e) => setSkyoneRef(e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-permitidos">Módulos permitidos</Label>
              <Ajuda>Separados por vírgula. Ex.: catalogo, pedidos</Ajuda>
              <Input
                id="ed-permitidos"
                value={modulosPermitidos}
                className="font-mono text-sm"
                onChange={(e) => setModulosPermitidos(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-padrao">Módulos padrão</Label>
              <Ajuda>Subconjunto dos permitidos que nasce ligado. Ex.: catalogo, pedidos</Ajuda>
              <Input
                id="ed-padrao"
                value={modulosPadrao}
                className="font-mono text-sm"
                onChange={(e) => setModulosPadrao(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ed-motivos">Motivos de transferência</Label>
            <Ajuda>
              Um por linha: id:rótulo ou id:rótulo:converte (para motivos que viram solicitação).
            </Ajuda>
            <Textarea
              id="ed-motivos"
              value={motivos}
              rows={4}
              className="font-mono text-sm"
              onChange={(e) => setMotivos(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ed-tipos">Tipos de solicitação</Label>
            <Ajuda>Um por linha: id:rótulo</Ajuda>
            <Textarea
              id="ed-tipos"
              value={tipos}
              rows={3}
              className="font-mono text-sm"
              onChange={(e) => setTipos(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar nova versão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
