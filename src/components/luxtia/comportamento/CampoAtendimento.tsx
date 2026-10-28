import { useEffect, useState } from "react";
import { Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AJUDA_CAMPO,
  MOTIVO_AVISO,
  MOTIVO_BLOQUEIO,
  MOTIVO_CAMPO,
  ROTULO_ORIGEM,
  campoDisponivel,
  marcarTrechos,
  rotuloCampo,
  rotuloOpcao,
  textoValor,
  type CampoEsquema,
  type Parte,
  type Trecho,
} from "@/lib/gateway/atendimento";
import { CampoHora } from "@/components/luxtia/DataHora";
import { gradeJanela, lerJanela } from "@/lib/gateway/followup";
import type { Json } from "@/lib/gateway/tipos";

export type Situacao = {
  valor: Json;
  origem: string;
  personalizado: boolean;
  editado: boolean;
  noRascunho: boolean;
};

/**
 * Um campo do comportamento do agente, desenhado pelo `esquema` do gateway.
 * `bloqueado`: sem permissão, só leitura (operação) ou indisponível.
 */
export function CampoAtendimento({
  parte,
  campo,
  def,
  situacao,
  podeEditar,
  escopo,
  erros,
  bloqueios,
  avisos,
  mudar,
  voltarAoPadrao,
  restricao,
}: {
  parte: Parte;
  campo: string;
  def: CampoEsquema;
  situacao: Situacao;
  podeEditar: boolean;
  escopo: "empresa" | "agente";
  erros: { motivo: string }[];
  bloqueios: Trecho[];
  avisos: Trecho[];
  mudar: (valor: Json) => void;
  voltarAoPadrao: () => void;
  /** Quando preenchido, o campo fica travado e a frase aparece no lugar da edição. */
  restricao?: string;
}) {
  const disponivel = campoDisponivel(def);
  const desabilitado = !podeEditar || !def.editavel || !disponivel || Boolean(restricao);
  const id = `campo-${parte}-${campo}`;
  const ajuda = AJUDA_CAMPO[campo];
  const temProblema = erros.length > 0 || bloqueios.length > 0;
  return (
    <div
      id={id}
      className={`space-y-2 rounded-lg border p-3 ${temProblema ? "border-destructive/60 bg-destructive/5" : "border-base-200"} ${disponivel ? "" : "opacity-70"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-entrada`} className="text-sm font-medium text-ink-700">
          {rotuloCampo(campo)}
        </label>
        {!disponivel ? (
          <span
            className="rounded-full bg-base-100 px-2 py-0.5 text-[11px] font-medium text-ink-500"
            title="Este recurso ainda não está ativo. A configuração fica guardada e passa a valer quando ele for liberado."
          >
            em breve
          </span>
        ) : null}
        {situacao.personalizado ? (
          <span className="rounded-full bg-gold-300/30 px-2 py-0.5 text-[11px] font-medium text-gold-700">
            Personalizado
          </span>
        ) : (
          <span className="text-[11px] text-ink-500" title="De onde vem o valor em uso">
            {ROTULO_ORIGEM[situacao.origem] ?? situacao.origem}
          </span>
        )}
        {situacao.editado ? (
          <span className="text-[11px] font-medium text-purple-700">· não salvo</span>
        ) : situacao.noRascunho ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700">
            <span className="size-1.5 rounded-full bg-purple-700" aria-hidden /> no rascunho
          </span>
        ) : null}
        {situacao.personalizado && podeEditar && def.editavel && disponivel && !restricao ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-xs text-ink-500"
            onClick={voltarAoPadrao}
            title={
              escopo === "agente"
                ? "Grava no rascunho para voltar a usar o valor da empresa"
                : "Grava no rascunho para voltar a usar o padrão do segmento"
            }
          >
            <RotateCcw className="size-3" aria-hidden />
            Voltar ao padrão
          </Button>
        ) : null}
      </div>
      <Entrada
        id={`${id}-entrada`}
        campo={campo}
        def={def}
        valor={situacao.valor}
        desabilitado={desabilitado}
        mudar={mudar}
        trechos={[...bloqueios, ...avisos].map((t) => t.trecho)}
      />
      {restricao ? <p className="text-xs text-ink-500">{restricao}</p> : null}
      {ajuda ? <p className="text-xs text-ink-500">{ajuda}</p> : null}
      {!disponivel ? (
        <p className="text-xs text-ink-500">
          Este recurso ainda não está ativo. A configuração fica guardada e passa a valer quando ele
          for liberado.
        </p>
      ) : null}
      {erros.map((e, i) => (
        <p key={`e${i}`} role="alert" className="text-xs text-destructive">
          {MOTIVO_CAMPO[e.motivo] ?? e.motivo}
        </p>
      ))}
      {bloqueios.map((b, i) => (
        <p key={`b${i}`} role="alert" className="text-xs text-destructive">
          Trecho não permitido ({MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo}): “{b.trecho}”
        </p>
      ))}
      {avisos.map((a, i) => (
        <p key={`a${i}`} className="text-xs text-gold-700">
          Confira ({MOTIVO_AVISO[a.motivo] ?? a.motivo}): “{a.trecho}”. Publicar vai pedir
          confirmação.
        </p>
      ))}
    </div>
  );
}

function Contador({ atual, max, rotulo }: { atual: number; max: number; rotulo: string }) {
  const tom =
    atual > max ? "text-destructive" : atual >= max * 0.9 ? "text-gold-700" : "text-ink-500";
  return (
    <span className={tom}>
      {atual}/{max} {rotulo}
    </span>
  );
}

function Entrada({
  id,
  campo,
  def,
  valor,
  desabilitado,
  mudar,
  trechos,
}: {
  id: string;
  campo: string;
  def: CampoEsquema;
  valor: Json;
  desabilitado: boolean;
  mudar: (v: Json) => void;
  trechos: string[];
}) {
  switch (def.tipo) {
    case "booleano":
      return (
        <Switch
          id={id}
          checked={valor === true}
          disabled={desabilitado}
          onCheckedChange={(v) => mudar(v)}
        />
      );
    case "escolha": {
      const opcoes = def.opcoes ?? [];
      if (opcoes.length === 2 && opcoes.includes("on") && opcoes.includes("off"))
        return (
          <div className="flex items-center gap-2 text-sm">
            <Switch
              id={id}
              checked={valor === "on"}
              disabled={desabilitado}
              onCheckedChange={(v) => mudar(v ? "on" : "off")}
            />
            <span className="text-ink-500">{valor === "on" ? "Ligado" : "Desligado"}</span>
          </div>
        );
      return (
        <div id={id} role="radiogroup" className="flex flex-wrap gap-1.5">
          {opcoes.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={valor === o}
              disabled={desabilitado}
              onClick={() => mudar(o)}
              className={`min-h-9 rounded-md border px-3 text-sm transition disabled:cursor-not-allowed ${
                valor === o
                  ? "border-purple-700 bg-purple-50 font-medium text-purple-800"
                  : "border-base-200 bg-card text-ink-700 hover:border-purple-300"
              }`}
            >
              {rotuloOpcao(o)}
            </button>
          ))}
        </div>
      );
    }
    case "texto":
    case "telefone":
      return (
        <CampoTexto
          id={id}
          def={def}
          valor={typeof valor === "string" ? valor : ""}
          desabilitado={desabilitado}
          mudar={mudar}
          trechos={trechos}
        />
      );
    case "inteiro":
    case "decimal":
      return (
        <Input
          id={id}
          type="number"
          className="w-36"
          inputMode={def.tipo === "inteiro" ? "numeric" : "decimal"}
          step={def.tipo === "inteiro" ? 1 : 0.5}
          {...(def.min !== undefined ? { min: def.min } : {})}
          {...(def.max !== undefined ? { max: def.max } : {})}
          value={typeof valor === "number" ? valor : ""}
          disabled={desabilitado}
          onChange={(e) => mudar(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "lista_escolhas":
      return (
        <ListaEscolhas
          id={id}
          def={def}
          valor={Array.isArray(valor) ? (valor as string[]) : []}
          desabilitado={desabilitado}
          mudar={mudar}
        />
      );
    case "lista_assuntos":
      return (
        <ListaAssuntos
          id={id}
          def={def}
          valor={Array.isArray(valor) ? (valor as { assunto: string; acao: string }[]) : []}
          desabilitado={desabilitado}
          mudar={mudar}
        />
      );
    case "horarios":
      if (campo === "follow_up_janela") {
        try {
          return <JanelaFollowUp id={id} valor={valor} desabilitado={desabilitado} mudar={mudar} />;
        } catch {
          return (
            <p id={id} className="text-sm text-ink-500">
              A janela de follow-up não pôde ser exibida. O restante da configuração segue
              disponível.
            </p>
          );
        }
      }
      return (
        <p id={id} className="whitespace-pre-wrap break-words text-sm text-ink-700">
          {textoValor(valor)}
        </p>
      );
    default:
      // so_plataforma e tipos que o painel ainda não conhece: só leitura.
      return (
        <p id={id} className="whitespace-pre-wrap break-words text-sm text-ink-700">
          {textoValor(valor)}
        </p>
      );
  }
}

function CampoTexto({
  id,
  def,
  valor,
  desabilitado,
  mudar,
  trechos,
}: {
  id: string;
  def: CampoEsquema;
  valor: string;
  desabilitado: boolean;
  mudar: (v: Json) => void;
  trechos: string[];
}) {
  const longo = (def.max ?? 0) > 120 || def.linhas !== undefined;
  const marcado = trechos.length ? marcarTrechos(valor, trechos) : [];
  return (
    <div className="space-y-1">
      {longo ? (
        <Textarea
          id={id}
          value={valor}
          rows={Math.min(8, Math.max(3, (def.linhas ?? 3) > 5 ? 6 : 3))}
          disabled={desabilitado}
          onChange={(e) => mudar(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={def.tipo === "telefone" ? "tel" : "text"}
          value={valor}
          disabled={desabilitado}
          onChange={(e) => mudar(e.target.value)}
        />
      )}
      {def.max !== undefined ? (
        <p className="flex gap-3 text-[11px]">
          <Contador atual={valor.length} max={def.max} rotulo="caracteres" />
          {def.linhas !== undefined ? (
            <Contador
              atual={(valor.match(/\n/g) ?? []).length}
              max={def.linhas}
              rotulo="quebras de linha"
            />
          ) : null}
        </p>
      ) : null}
      {marcado.some((p) => p.marcado) ? (
        <p
          className="whitespace-pre-wrap break-words rounded-md border border-dashed border-base-200 bg-card p-2 text-xs text-ink-700"
          aria-label="Trechos indicados pelo gateway"
        >
          {marcado.map((p, i) =>
            p.marcado ? (
              <mark key={i} className="rounded bg-destructive/15 px-0.5 text-destructive">
                {p.texto}
              </mark>
            ) : (
              <span key={i}>{p.texto}</span>
            ),
          )}
        </p>
      ) : null}
    </div>
  );
}

function ListaEscolhas({
  id,
  def,
  valor,
  desabilitado,
  mudar,
}: {
  id: string;
  def: CampoEsquema;
  valor: string[];
  desabilitado: boolean;
  mudar: (v: Json) => void;
}) {
  const fixos = def.fixos ?? [];
  const opcoes = def.opcoes ?? [];
  const marcadas = new Set([...valor, ...fixos]);
  const alternar = (o: string, ligado: boolean) =>
    mudar(opcoes.filter((x) => (x === o ? ligado : marcadas.has(x))));
  return (
    <ul id={id} className="grid gap-1.5 sm:grid-cols-2">
      {opcoes.map((o) => {
        const fixo = fixos.includes(o);
        return (
          <li key={o} className="flex items-center gap-2 text-sm">
            <Switch
              checked={marcadas.has(o)}
              disabled={desabilitado || fixo}
              onCheckedChange={(v) => alternar(o, v)}
              aria-label={rotuloOpcao(o)}
            />
            <span className={fixo ? "text-ink-700" : ""}>{rotuloOpcao(o)}</span>
            {fixo ? (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-ink-500"
                title="Sempre ativo: o cliente que pede uma pessoa ou faz uma reclamação é sempre encaminhado à equipe. Não pode ser desligado."
              >
                <Lock className="size-3" aria-hidden /> sempre ligado
              </span>
            ) : null}
          </li>
        );
      })}
      {fixos.length ? (
        <li className="text-xs text-ink-500 sm:col-span-2">
          Os itens com cadeado ficam sempre ligados: quem pede uma pessoa ou reclama sempre chega à
          equipe.
        </li>
      ) : null}
      {def.max !== undefined && opcoes.length > def.max ? (
        <li className="text-xs text-ink-500 sm:col-span-2">
          Até {def.max} ({valor.length} escolhidos).
        </li>
      ) : null}
    </ul>
  );
}

function ListaAssuntos({
  id,
  def,
  valor,
  desabilitado,
  mudar,
}: {
  id: string;
  def: CampoEsquema;
  valor: { assunto: string; acao: string }[];
  desabilitado: boolean;
  mudar: (v: Json) => void;
}) {
  const acoes = def.acoes ?? [];
  const [novo, setNovo] = useState("");
  const max = def.max_itens ?? Infinity;
  const trocar = (i: number, item: { assunto: string; acao: string }) =>
    mudar(valor.map((x, n) => (n === i ? item : x)));
  return (
    <div id={id} className="space-y-2">
      {valor.length ? (
        <ul className="space-y-1.5">
          {valor.map((item, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-0 flex-1"
                value={item.assunto}
                disabled={desabilitado}
                aria-label={`Assunto ${i + 1}`}
                onChange={(e) => trocar(i, { ...item, assunto: e.target.value })}
              />
              <select
                className="h-9 rounded-md border bg-card px-2 text-sm"
                value={item.acao}
                disabled={desabilitado}
                aria-label={`Ação do assunto ${i + 1}`}
                onChange={(e) => trocar(i, { ...item, acao: e.target.value })}
              >
                {acoes.map((a) => (
                  <option key={a} value={a}>
                    {rotuloOpcao(a)}
                  </option>
                ))}
              </select>
              {!desabilitado ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remover assunto ${i + 1}`}
                  onClick={() => mudar(valor.filter((_, n) => n !== i))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">Nenhum assunto.</p>
      )}
      {!desabilitado ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!novo.trim() || valor.length >= max) return;
            mudar([...valor, { assunto: novo.trim(), acao: acoes[0] ?? "recusar" }]);
            setNovo("");
          }}
        >
          <Input
            className="min-w-0 flex-1"
            value={novo}
            placeholder="Novo assunto"
            aria-label="Novo assunto"
            onChange={(e) => setNovo(e.target.value)}
          />
          <Button type="submit" variant="outline" size="sm" disabled={valor.length >= max}>
            <Plus className="size-4" aria-hidden /> Adicionar
          </Button>
        </form>
      ) : null}
      {Number.isFinite(max) ? (
        <p className="text-[11px] text-ink-500">
          {valor.length} de {max}
        </p>
      ) : null}
    </div>
  );
}

/** Das / até, o mesmo horário em todos os dias — o formato da janela de follow-up. */
function JanelaFollowUp({
  id,
  valor,
  desabilitado,
  mudar,
}: {
  id: string;
  valor: Json;
  desabilitado: boolean;
  mudar: (v: Json) => void;
}) {
  const atual = lerJanela(valor);
  const [inicio, setInicio] = useState(atual.inicio);
  const [fim, setFim] = useState(atual.fim);
  const chave = JSON.stringify(valor);
  useEffect(() => {
    const lido = lerJanela(valor);
    setInicio(lido.inicio);
    setFim(lido.fim);
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const aplicar = (proxInicio: string, proxFim: string) => {
    setInicio(proxInicio);
    setFim(proxFim);
    const grade = gradeJanela(proxInicio, proxFim);
    if (grade) mudar(grade);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-500" htmlFor={`${id}-inicio`}>
          Das
          <CampoHora
            id={`${id}-inicio`}
            className="mt-1"
            valor={inicio}
            disabled={desabilitado}
            onChange={(hora) => aplicar(hora, fim)}
          />
        </label>
        <label className="text-xs text-ink-500" htmlFor={`${id}-fim`}>
          Até
          <CampoHora
            id={`${id}-fim`}
            className="mt-1"
            valor={fim}
            disabled={desabilitado}
            onChange={(hora) => aplicar(inicio, hora)}
          />
        </label>
      </div>
      {inicio === fim ? (
        <p role="alert" className="text-xs text-destructive">
          O horário de início e o de fim precisam ser diferentes.
        </p>
      ) : null}
      {!atual.uniforme ? (
        <p className="text-xs text-ink-500">
          Os dias estão com horários diferentes. Ao escolher das e até, o mesmo horário passa a
          valer todos os dias.
        </p>
      ) : null}
    </div>
  );
}
