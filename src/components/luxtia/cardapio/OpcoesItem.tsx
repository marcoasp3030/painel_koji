/** Opções do produto: tamanhos, adicionais, molhos e para quantas pessoas serve. Tudo opcional; gravado junto com o produto. */
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ItemCardapio } from "@/lib/gateway/cardapio";
import type { ServicosCat2 } from "@/lib/gateway/cardapio-cat2";
import type { useOpcoes } from "./useOpcoes";
import {
  copiaSemIds,
  deServidor,
  grupoDoModelo,
  MAX_ESCOLHAS,
  MAX_GRUPOS,
  MAX_OPCOES,
  MAX_NOME,
  MODELOS,
  mover,
  opcaoNova,
  regraEmPalavras,
  type GrupoEditor,
  type OpcaoEditor,
} from "@/lib/gateway/opcoes-item";

function BotaoIcone({
  rotulo,
  onClick,
  disabled,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 text-ink-500"
      aria-label={rotulo}
      title={rotulo}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function CartaoGrupo({
  grupo,
  indice,
  total,
  mudar,
  subir,
  descer,
  remover,
}: {
  grupo: GrupoEditor;
  indice: number;
  total: number;
  mudar: (parte: Partial<GrupoEditor>) => void;
  subir: () => void;
  descer: () => void;
  remover: () => void;
}) {
  const rotulo = grupo.nome.trim() || `grupo ${indice + 1}`;
  const mudarOpcao = (chave: number, parte: Partial<OpcaoEditor>) =>
    mudar({ opcoes: grupo.opcoes.map((o) => (o.chave === chave ? { ...o, ...parte } : o)) });
  return (
    <section
      aria-label={`Grupo ${rotulo}`}
      className={`rounded-lg border border-base-200 bg-card p-3 ${grupo.ativo ? "" : "opacity-70"}`}
    >
      <div className="flex items-center gap-1">
        <Input
          aria-label={`Nome do ${rotulo}`}
          placeholder="Nome do grupo, ex.: Escolha o molho"
          maxLength={MAX_NOME}
          className="h-9 min-w-0 flex-1 font-medium"
          value={grupo.nome}
          onChange={(e) => mudar({ nome: e.target.value })}
        />
        <BotaoIcone rotulo={`Subir ${rotulo}`} disabled={indice === 0} onClick={subir}>
          <ArrowUp className="size-3.5" aria-hidden />
        </BotaoIcone>
        <BotaoIcone rotulo={`Descer ${rotulo}`} disabled={indice === total - 1} onClick={descer}>
          <ArrowDown className="size-3.5" aria-hidden />
        </BotaoIcone>
        <BotaoIcone rotulo={`Remover ${rotulo}`} onClick={remover}>
          <Trash2 className="size-3.5" aria-hidden />
        </BotaoIcone>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <Switch
            checked={grupo.obrigatorio}
            onCheckedChange={(obrigatorio) => mudar({ obrigatorio })}
            aria-label={`${rotulo}: obrigatório`}
          />
          Obrigatório
        </label>
        <div
          role="radiogroup"
          aria-label={`${rotulo}: quantas escolhas`}
          className="flex rounded-md border border-base-200 p-0.5"
        >
          {[
            [false, "Uma opção"],
            [true, "Várias"],
          ].map(([valor, nome]) => (
            <button
              key={String(valor)}
              type="button"
              role="radio"
              aria-checked={grupo.multipla === valor}
              onClick={() =>
                mudar({
                  multipla: valor as boolean,
                  ...(valor && grupo.maximo < 2 ? { maximo: 3 } : {}),
                })
              }
              className={`rounded px-2 py-0.5 text-xs ${grupo.multipla === valor ? "bg-purple-100 font-medium text-purple-900" : "text-ink-700"}`}
            >
              {nome as string}
            </button>
          ))}
        </div>
        {grupo.multipla ? (
          <>
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              Até
              <Input
                type="number"
                min={2}
                max={MAX_ESCOLHAS}
                aria-label={`${rotulo}: máximo de escolhas`}
                className="h-7 w-14 px-1.5 text-center text-sm"
                value={grupo.maximo}
                onChange={(e) => mudar({ maximo: Number(e.target.value) })}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              <input
                type="checkbox"
                checked={grupo.repetir}
                onChange={(e) => mudar({ repetir: e.target.checked })}
              />
              Pode repetir a mesma opção
            </label>
          </>
        ) : null}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-700">
          <Switch
            checked={grupo.ativo}
            onCheckedChange={(ativo) => mudar({ ativo })}
            aria-label={`${rotulo}: ativo`}
          />
          Ativo
        </label>
      </div>
      <p className="mt-1 text-xs text-ink-500">{regraEmPalavras(grupo)}</p>

      <ul className="mt-2 space-y-1">
        {grupo.opcoes.map((o, i) => {
          const nomeOpcao = o.nome.trim() || `opção ${i + 1}`;
          return (
            <li key={o.chave} className="flex items-center gap-1">
              <Input
                aria-label={`Nome da ${nomeOpcao}`}
                placeholder="Ex.: Tarê"
                maxLength={MAX_NOME}
                className="h-8 min-w-0 flex-1 text-sm"
                value={o.nome}
                onChange={(e) => mudarOpcao(o.chave, { nome: e.target.value })}
              />
              <div className="relative w-24 shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-500">
                  + R$
                </span>
                <Input
                  aria-label={`Preço extra de ${nomeOpcao}`}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="h-8 pl-9 pr-1 text-right text-sm tabular-nums"
                  value={o.preco}
                  onChange={(e) => mudarOpcao(o.chave, { preco: e.target.value })}
                />
              </div>
              <Switch
                checked={o.ativo}
                onCheckedChange={(ativo) => mudarOpcao(o.chave, { ativo })}
                aria-label={`${nomeOpcao}: disponível`}
                title="Desligue quando a opção acabar"
              />
              <BotaoIcone
                rotulo={`Subir ${nomeOpcao}`}
                disabled={i === 0}
                onClick={() => mudar({ opcoes: mover(grupo.opcoes, i, -1) })}
              >
                <ArrowUp className="size-3.5" aria-hidden />
              </BotaoIcone>
              <BotaoIcone
                rotulo={`Remover ${nomeOpcao}`}
                onClick={() => mudar({ opcoes: grupo.opcoes.filter((x) => x.chave !== o.chave) })}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </BotaoIcone>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 h-7 px-2 text-xs"
        disabled={grupo.opcoes.length >= MAX_OPCOES}
        onClick={() => mudar({ opcoes: [...grupo.opcoes, opcaoNova()] })}
      >
        <Plus className="size-3" aria-hidden /> Adicionar opção
      </Button>
    </section>
  );
}

export function OpcoesItem({
  opcoes,
  itemId,
  itens,
  servicos,
}: {
  opcoes: ReturnType<typeof useOpcoes>;
  itemId: number | null;
  itens: ItemCardapio[];
  servicos: ServicosCat2;
}) {
  const { grupos, setGrupos, erroCarga, conflito, problema } = opcoes;
  const [busy, setBusy] = useState(false);
  const [origem, setOrigem] = useState("");

  const mudarGrupo = (chave: number, parte: Partial<GrupoEditor>) =>
    setGrupos((g) => (g ?? []).map((x) => (x.chave === chave ? { ...x, ...parte } : x)));
  const incluir = (novos: GrupoEditor[]) => setGrupos((g) => [...(g ?? []), ...novos]);

  async function copiar() {
    const id = Number(origem);
    if (!id) return;
    setBusy(true);
    try {
      const c = await servicos.opcoes(id);
      if (!c.grupos.length) {
        toast.info("Esse item ainda não tem opções.");
        return;
      }
      incluir(copiaSemIds(deServidor(c.grupos)));
      setOrigem("");
      toast.success("Opções copiadas. Revise e salve o produto.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (erroCarga)
    return (
      <p role="alert" className="text-sm text-destructive">
        {erroCarga}
      </p>
    );
  if (grupos === null) return <p className="text-sm text-ink-500">Carregando opções…</p>;

  const outros = itens.filter((i) => i.item_id !== itemId);
  return (
    <section aria-label="Opções do produto" className="space-y-3">
      {grupos.length ? null : (
        <p className="text-sm text-ink-700">
          Este produto é vendido direto. Se o cliente precisar escolher algo, como tamanho ou molho,
          comece por um dos modelos abaixo.
        </p>
      )}
      {grupos.map((g, i) => (
        <CartaoGrupo
          key={g.chave}
          grupo={g}
          indice={i}
          total={grupos.length}
          mudar={(parte) => mudarGrupo(g.chave, parte)}
          subir={() => setGrupos(mover(grupos, i, -1))}
          descer={() => setGrupos(mover(grupos, i, 1))}
          remover={() => setGrupos(grupos.filter((x) => x.chave !== g.chave))}
        />
      ))}

      <div>
        <p className="mb-1 text-xs font-medium text-ink-700">Adicionar grupo</p>
        <div className="flex flex-wrap gap-1.5">
          {MODELOS.map((m) => (
            <Button
              key={m.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              title={m.ajuda}
              disabled={grupos.length >= MAX_GRUPOS}
              onClick={() => incluir([grupoDoModelo(m.id)])}
            >
              <Plus className="size-3" aria-hidden /> {m.rotulo}
            </Button>
          ))}
        </div>
      </div>

      {outros.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Copiar opções de outro item"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
          >
            <option value="">Copiar opções de outro item…</option>
            {outros.map((i) => (
              <option key={i.item_id} value={i.item_id}>
                {i.nome}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!origem || busy}
            onClick={() => void copiar()}
          >
            Copiar
          </Button>
        </div>
      ) : null}

      {problema ? (
        <p role="alert" className="text-sm text-destructive">
          {problema}
        </p>
      ) : null}
      {conflito && itemId !== null ? (
        <div role="alert" className="rounded-md border border-base-200 bg-base-50 p-2 text-sm">
          <p>
            Outra pessoa alterou estas opções enquanto você editava. Carregue a versão atual para
            continuar; o que você mudou nelas será descartado.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-8"
            onClick={() => void opcoes.carregarAtual(itemId)}
          >
            Carregar versão atual
          </Button>
        </div>
      ) : null}
    </section>
  );
}
