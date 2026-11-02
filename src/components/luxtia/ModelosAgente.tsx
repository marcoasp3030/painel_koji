/** Tela "Modelos de agente": lista e detalhe lado a lado. Só plataforma (MULTI1-a §10.2). */
import { useEffect, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Etiqueta } from "@/components/luxtia/Gateway";
import { ChipFiltro } from "@/components/luxtia/Superficie";
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
import { Switch } from "@/components/ui/switch";
import {
  criarModeloAgente,
  editarModeloAgente,
  listarModelosAgente,
} from "@/lib/gateway-modelos.functions";
import {
  agruparVersoes,
  camposAlterados,
  filtrarModelos,
  formDoModelo,
  idDeRotulo,
  problemaDoModelo,
  type FormModelo,
  type GrupoModelo,
} from "@/lib/gateway/modelos";
import { ROTULO_MODULO, rotuloModulo } from "@/lib/gateway/modulos";
import type { ItemRotulado } from "@/lib/gateway/tipos";

const DESCARTAR = "Descartar as alterações não salvas?";
const CLASSE_SELECT = "h-8 rounded-md border bg-card px-2 text-sm";

export function ModelosAgente() {
  const listar = useServerFn(listarModelosAgente);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<"" | "ativos" | "inativos">("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [sujo, setSujo] = useState(false);

  // A lista vem inteira: filtrar no gateway olharia cada versão, não o modelo.
  const lista = useQuery({
    queryKey: ["gateway", "modelos-agente"],
    queryFn: () => listar({ data: {} }),
  });
  const grupos = agruparVersoes(lista.data ?? []);
  const visiveis = filtrarModelos(grupos, { busca, situacao });
  const grupo = grupos.find((g) => g.id === aberto) ?? null;
  const contar = (ativo: boolean) => grupos.filter((g) => g.atual.ativo === ativo).length;

  useBlocker({
    shouldBlockFn: () => sujo && !window.confirm(DESCARTAR),
    enableBeforeUnload: () => sujo,
  });

  function abrir(id: string | null) {
    if (id === aberto) return;
    if (sujo && !window.confirm(DESCARTAR)) return;
    setSujo(false);
    setAberto(id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card lg:flex-row">
      <aside
        className={`min-h-0 flex-1 flex-col border-base-200 lg:flex lg:w-72 lg:flex-none lg:border-r ${grupo ? "hidden" : "flex"}`}
      >
        <div className="space-y-1.5 border-b border-base-200 p-2">
          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search
                className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-500"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Procurar modelo"
                placeholder="Procurar modelo"
                className="h-8 pl-7 text-sm"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              aria-label="Novo modelo"
              title="Novo modelo"
              onClick={() => setCriando(true)}
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="flex gap-0.5">
            <ChipFiltro
              ativo={!situacao}
              rotulo="Todos"
              total={grupos.length}
              onClick={() => setSituacao("")}
            />
            <ChipFiltro
              ativo={situacao === "ativos"}
              rotulo="Ativos"
              total={contar(true)}
              onClick={() => setSituacao(situacao === "ativos" ? "" : "ativos")}
            />
            <ChipFiltro
              ativo={situacao === "inativos"}
              rotulo="Inativos"
              total={contar(false)}
              onClick={() => setSituacao(situacao === "inativos" ? "" : "inativos")}
            />
          </div>
        </div>
        <nav aria-label="Modelos" className="min-h-0 flex-1 overflow-y-auto">
          {lista.isLoading ? (
            <p className="p-3 text-sm text-ink-500">Carregando…</p>
          ) : lista.error ? (
            <p role="alert" className="p-3 text-sm text-destructive">
              {(lista.error as Error).message}
            </p>
          ) : visiveis.length === 0 ? (
            <p className="p-3 text-sm text-ink-500">
              {grupos.length ? "Nenhum modelo com esses filtros." : "Crie o primeiro modelo."}
            </p>
          ) : (
            visiveis.map(({ id, atual }) => (
              <button
                key={id}
                type="button"
                aria-current={aberto === id ? "true" : undefined}
                onClick={() => abrir(id)}
                className={`block w-full border-b border-base-200/70 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  aberto === id
                    ? "bg-purple-100/60 shadow-[inset_3px_0_0_0_var(--purple-700)]"
                    : "hover:bg-purple-50/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                    {atual.nome}
                  </span>
                  <span className="text-xs tabular-nums text-ink-500">v{atual.versao}</span>
                </span>
                <span className="block truncate text-xs text-ink-500">
                  {atual.ativo ? null : <span className="text-destructive">Inativo · </span>}
                  {atual.segmento} · {atual.tipo === "interno" ? "Interno" : "Atendimento"}
                </span>
              </button>
            ))
          )}
        </nav>
      </aside>

      <div className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${grupo ? "flex" : "hidden"}`}>
        {grupo ? (
          <DetalheModelo
            key={grupo.id}
            grupo={grupo}
            segmentos={[...new Set(grupos.map((g) => g.atual.segmento).filter(Boolean))]}
            mudouSujo={setSujo}
            voltar={() => abrir(null)}
          />
        ) : (
          <p className="p-4 text-sm text-ink-500">Escolha um modelo para ver e editar.</p>
        )}
      </div>

      {criando ? (
        <NovoModelo
          segmentos={[...new Set(grupos.map((g) => g.atual.segmento).filter(Boolean))]}
          fechar={() => setCriando(false)}
          criado={(id) => {
            setCriando(false);
            abrir(id);
          }}
        />
      ) : null}
    </div>
  );
}

function DetalheModelo({
  grupo,
  segmentos,
  mudouSujo,
  voltar,
}: {
  grupo: GrupoModelo;
  segmentos: string[];
  mudouSujo: (sujo: boolean) => void;
  voltar: () => void;
}) {
  const [versaoVista, setVersaoVista] = useState(grupo.atual.versao);
  const vista = grupo.versoes.find((v) => v.versao === versaoVista) ?? grupo.atual;
  const antiga = vista.versao !== grupo.atual.versao;
  return (
    <FormularioModelo
      key={vista.versao}
      grupo={grupo}
      versao={vista.versao}
      base={formDoModelo(vista)}
      antiga={antiga}
      segmentos={segmentos}
      mudouSujo={mudouSujo}
      voltar={voltar}
      verVersao={setVersaoVista}
    />
  );
}

function FormularioModelo({
  grupo,
  versao,
  base,
  antiga,
  segmentos,
  mudouSujo,
  voltar,
  verVersao,
}: {
  grupo: GrupoModelo;
  versao: number;
  base: FormModelo;
  antiga: boolean;
  segmentos: string[];
  mudouSujo: (sujo: boolean) => void;
  voltar: () => void;
  verVersao: (versao: number) => void;
}) {
  const queryClient = useQueryClient();
  const editar = useServerFn(editarModeloAgente);
  const [form, setForm] = useState(base);
  const alteracoes = camposAlterados(base, form);
  const sujo = Object.keys(alteracoes).length > 0;
  const problema = sujo ? problemaDoModelo(form) : null;
  const proxima = grupo.atual.versao + 1;
  const mudar = (parte: Partial<FormModelo>) => setForm((f) => ({ ...f, ...parte }));

  useEffect(() => {
    mudouSujo(sujo);
    return () => mudouSujo(false);
  }, [sujo, mudouSujo]);

  const salvar = useMutation({
    mutationFn: () => editar({ data: { id: grupo.id, ...alteracoes } }),
    onSuccess: async (novo) => {
      toast.success(`Versão ${novo.versao} criada. Os agentes atuais seguem na versão deles.`);
      await queryClient.invalidateQueries({ queryKey: ["gateway", "modelos-agente"] });
      verVersao(novo.versao);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-base-200 px-3 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-1 px-1.5 lg:hidden"
          aria-label="Voltar para a lista"
          onClick={voltar}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="truncate text-sm font-medium text-ink-900">{grupo.atual.nome}</h2>
          <p className="truncate font-mono text-xs text-ink-500">{grupo.id}</p>
        </div>
        <select
          aria-label="Versão"
          className={CLASSE_SELECT}
          value={versao}
          disabled={sujo}
          title={sujo ? "Salve ou desfaça antes de trocar de versão" : undefined}
          onChange={(e) => verVersao(Number(e.target.value))}
        >
          {grupo.versoes.map((v, i) => (
            <option key={v.versao} value={v.versao}>
              v{v.versao}
              {i === 0 ? " (atual)" : ""}
            </option>
          ))}
        </select>
        {sujo ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={salvar.isPending}
            onClick={() => setForm(base)}
          >
            Desfazer
          </Button>
        ) : null}
        {antiga ? null : (
          <Button
            size="sm"
            disabled={!sujo || Boolean(problema) || salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending ? "Salvando…" : `Salvar como v${proxima}`}
          </Button>
        )}
      </div>

      {antiga ? (
        <p className="flex shrink-0 items-center gap-2 border-b border-base-200 bg-base-100 px-3 py-1 text-xs text-ink-700">
          <Lock className="size-3 shrink-0" aria-hidden />
          Versão antiga, só para consulta. Agentes nesta versão continuam nela.
        </p>
      ) : (
        <p
          role={problema ? "alert" : undefined}
          className={`shrink-0 border-b border-base-200 px-3 py-1 text-xs ${problema ? "bg-destructive/5 text-destructive" : sujo ? "bg-gold-300/20 text-gold-700" : "text-ink-500"}`}
        >
          {problema ??
            (sujo
              ? `Salvar cria a versão ${proxima}. Agentes atuais não mudam; ela vale para agentes novos ou atualizados.`
              : "Editar cria uma versão nova. Agentes atuais ficam na versão em que estão.")}
        </p>
      )}

      <fieldset disabled={antiga} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Linha titulo="Nome" htmlFor="md-nome">
          <Input
            id="md-nome"
            className="h-8"
            value={form.nome}
            onChange={(e) => mudar({ nome: e.target.value })}
          />
        </Linha>
        <Linha
          titulo="Segmento"
          ajuda="Agrupa os modelos. Letras minúsculas, números ou _."
          htmlFor="md-segmento"
        >
          <Input
            id="md-segmento"
            className="h-8"
            list="md-segmentos"
            value={form.segmento}
            onChange={(e) => mudar({ segmento: e.target.value })}
          />
          <datalist id="md-segmentos">
            {segmentos.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Linha>
        <Linha titulo="Tipo" htmlFor="md-tipo">
          <select
            id="md-tipo"
            className={CLASSE_SELECT}
            value={form.tipo}
            onChange={(e) => mudar({ tipo: e.target.value as FormModelo["tipo"] })}
          >
            <option value="atendimento">Atendimento</option>
            <option value="interno">Interno</option>
          </select>
        </Linha>
        <Linha
          titulo="Disponível para novos agentes"
          ajuda="Desligado, o modelo some da criação. Agentes existentes continuam."
          htmlFor="md-ativo"
        >
          <span className="flex items-center gap-2 text-sm text-ink-700">
            <Switch
              id="md-ativo"
              checked={form.ativo}
              onCheckedChange={(ativo) => mudar({ ativo })}
            />
            {form.ativo ? "Ativo" : "Inativo"}
          </span>
        </Linha>
        <Linha
          titulo="Referência Skyone"
          ajuda="Só informativo: nome ou id do fluxo."
          htmlFor="md-skyone"
        >
          <Input
            id="md-skyone"
            className="h-8"
            maxLength={200}
            value={form.skyone_ref ?? ""}
            onChange={(e) => mudar({ skyone_ref: e.target.value })}
          />
        </Linha>
        <Linha titulo="Módulos" ajuda="Permitido: a empresa pode usar. Nasce ligado: já vem ativo.">
          <TabelaModulos form={form} mudar={mudar} />
        </Linha>
        <Linha
          titulo="Motivos de transferência"
          ajuda="Quando o agente passa para a equipe. Marque os que viram solicitação."
        >
          <ListaItens
            nome="motivo"
            itens={form.motivos_transferencia}
            mudar={(motivos_transferencia) => mudar({ motivos_transferencia })}
            comConversao
          />
        </Linha>
        <Linha titulo="Tipos de solicitação">
          <ListaItens
            nome="tipo"
            itens={form.tipos_solicitacao}
            mudar={(tipos_solicitacao) => mudar({ tipos_solicitacao })}
          />
        </Linha>
      </fieldset>
    </>
  );
}

function Linha({
  titulo,
  ajuda,
  htmlFor,
  children,
}: {
  titulo: string;
  ajuda?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-x-6 gap-y-1.5 border-b border-base-200/70 px-4 py-2.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink-900">
          {titulo}
        </label>
        {ajuda ? <p className="mt-0.5 text-xs text-ink-500">{ajuda}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function TabelaModulos({
  form,
  mudar,
}: {
  form: FormModelo;
  mudar: (parte: Partial<FormModelo>) => void;
}) {
  // Módulo que o painel ainda não conhece continua na tabela, para não sumir ao salvar.
  const todos = [...new Set([...Object.keys(ROTULO_MODULO), ...form.modulos_permitidos])];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-ink-500">
          <th className="pb-1 font-medium">Módulo</th>
          <th className="w-24 pb-1 font-medium">Permitido</th>
          <th className="w-24 pb-1 font-medium">Nasce ligado</th>
        </tr>
      </thead>
      <tbody>
        {todos.map((m) => {
          const permitido = form.modulos_permitidos.includes(m);
          return (
            <tr key={m}>
              <td className="py-1 text-ink-900">{rotuloModulo(m)}</td>
              <td className="py-1">
                <Switch
                  aria-label={`${rotuloModulo(m)}: permitido`}
                  checked={permitido}
                  onCheckedChange={(ligado) =>
                    mudar(
                      ligado
                        ? { modulos_permitidos: [...form.modulos_permitidos, m] }
                        : {
                            modulos_permitidos: form.modulos_permitidos.filter((x) => x !== m),
                            modulos_padrao: form.modulos_padrao.filter((x) => x !== m),
                          },
                    )
                  }
                />
              </td>
              <td className="py-1">
                <Switch
                  aria-label={`${rotuloModulo(m)}: nasce ligado`}
                  checked={form.modulos_padrao.includes(m)}
                  disabled={!permitido}
                  onCheckedChange={(ligado) =>
                    mudar({
                      modulos_padrao: ligado
                        ? [...form.modulos_padrao, m]
                        : form.modulos_padrao.filter((x) => x !== m),
                    })
                  }
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ListaItens({
  nome,
  itens,
  mudar,
  comConversao = false,
}: {
  nome: string;
  itens: ItemRotulado[];
  mudar: (itens: ItemRotulado[]) => void;
  comConversao?: boolean;
}) {
  const [novo, setNovo] = useState("");
  const trocar = (i: number, parte: Partial<ItemRotulado>) =>
    mudar(itens.map((item, n) => (n === i ? { ...item, ...parte } : item)));
  function adicionar() {
    const rotulo = novo.trim();
    if (rotulo.length < 2 || itens.length >= 30) return;
    mudar([
      ...itens,
      {
        id: idDeRotulo(
          rotulo,
          itens.map((i) => i.id),
        ),
        rotulo,
      },
    ]);
    setNovo("");
  }
  return (
    <div className="space-y-1">
      {itens.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <Input
            className="h-8 min-w-0 flex-1"
            maxLength={60}
            aria-label={`Rótulo de ${item.id}`}
            title={`Identificador: ${item.id}`}
            value={item.rotulo}
            onChange={(e) => trocar(i, { rotulo: e.target.value })}
          />
          {comConversao ? (
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-700">
              <Switch
                aria-label={`${item.rotulo}: vira solicitação`}
                checked={item.converte_em_solicitacao === true}
                onCheckedChange={(ligado) => {
                  const { converte_em_solicitacao: _, ...resto } = item;
                  mudar(
                    itens.map((x, n) =>
                      n === i ? (ligado ? { ...resto, converte_em_solicitacao: true } : resto) : x,
                    ),
                  );
                }}
              />
              <span className="max-sm:hidden">Vira solicitação</span>
            </label>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 shrink-0 p-0 text-ink-500"
            aria-label={`Remover ${item.rotulo}`}
            onClick={() => mudar(itens.filter((_, n) => n !== i))}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          className="h-8 min-w-0 flex-1"
          maxLength={60}
          placeholder={`Novo ${nome}`}
          aria-label={`Novo ${nome}`}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={novo.trim().length < 2 || itens.length >= 30}
          onClick={adicionar}
        >
          <Plus className="size-4" aria-hidden /> Adicionar
        </Button>
      </div>
    </div>
  );
}

function NovoModelo({
  segmentos,
  fechar,
  criado,
}: {
  segmentos: string[];
  fechar: () => void;
  criado: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const criar = useServerFn(criarModeloAgente);
  const [nome, setNome] = useState("");
  const [idManual, setIdManual] = useState<string | null>(null);
  const [segmento, setSegmento] = useState("");
  const [tipo, setTipo] = useState<"atendimento" | "interno">("atendimento");
  const id = idManual ?? (nome.trim() ? idDeRotulo(nome, []) : "");

  const mutation = useMutation({
    mutationFn: () => criar({ data: { id, nome, segmento, tipo, ativo: true } }),
    onSuccess: async () => {
      toast.success("Modelo criado (versão 1).");
      await queryClient.invalidateQueries({ queryKey: ["gateway", "modelos-agente"] });
      criado(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(a) => !a && fechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo modelo de agente</DialogTitle>
          <DialogDescription>
            Cria a versão 1. Módulos e motivos você define em seguida.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label className="block text-sm font-medium text-ink-900">
            Nome
            <Input
              className="mt-1 font-normal"
              required
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-ink-900">
            Identificador
            <Input
              className="mt-1 font-mono font-normal"
              required
              pattern="[a-z0-9_]{3,80}"
              title="De 3 a 80 letras minúsculas, números ou _"
              value={id}
              onChange={(e) => setIdManual(e.target.value)}
            />
            <span className="mt-0.5 block text-xs font-normal text-ink-500">Não muda depois.</span>
          </label>
          <label className="block text-sm font-medium text-ink-900">
            Segmento
            <Input
              className="mt-1 font-normal"
              required
              pattern="[a-z0-9_]{2,40}"
              title="De 2 a 40 letras minúsculas, números ou _"
              list="nm-segmentos"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            />
            <datalist id="nm-segmentos">
              {segmentos.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm font-medium text-ink-900">
            Tipo
            <select
              className="mt-1 flex h-9 w-full rounded-md border bg-card px-2 text-sm font-normal"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "atendimento" | "interno")}
            >
              <option value="atendimento">Atendimento</option>
              <option value="interno">Interno</option>
            </select>
          </label>
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
