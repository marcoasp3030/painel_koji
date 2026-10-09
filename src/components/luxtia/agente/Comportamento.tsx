/** Aba Comportamento: mensagens, tempos, piloto e alertas, em linguagem simples. */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ajuda, RotuloCampo, type ContextoGateway } from "@/components/luxtia/Gateway";
import { Cartao } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { alterarAgente } from "@/lib/gateway-agentes.functions";
import { diferencas, paraTexto, valoresIniciais, type Formulario } from "@/lib/gateway/formulario";
import type { AgenteDetalhe } from "@/lib/gateway/tipos";
import { CAMPO_AGENTE, ORIGEM_VALOR } from "@/lib/gateway/vocabulario";

const CAMPOS_EMPRESA = [
  "aviso_demora",
  "slow_notice_s",
  "fallback",
  "debounce_s",
  "max_wait_s",
  "pause_minutes",
  "modo_piloto",
  "contatos_permitidos",
  "alerta_telefone",
];

type CampoAgente = keyof typeof CAMPO_AGENTE;

export function Comportamento({ ctx, agente }: { ctx: ContextoGateway; agente: AgenteDetalhe }) {
  const queryClient = useQueryClient();
  const alterar = useServerFn(alterarAgente);
  const plataforma = ctx.papel === "plataforma";
  const podeEditar = plataforma || ctx.papel === "admin";
  const campos = useMemo(
    () => (plataforma ? ["nome", ...CAMPOS_EMPRESA] : CAMPOS_EMPRESA),
    [plataforma],
  );
  const original = agente as unknown as Record<string, unknown>;

  const [form, setForm] = useState<Formulario>(() => valoresIniciais(campos, original));
  useEffect(() => setForm(valoresIniciais(campos, original)), [agente, campos]); // eslint-disable-line react-hooks/exhaustive-deps

  const alterados = diferencas(campos, form, original);
  const sujo = Object.keys(alterados).length > 0;

  const salvar = useMutation({
    mutationFn: () =>
      alterar({ data: { empresa: ctx.empresa, agente: agente.id, dados: alterados } }),
    onSuccess: async () => {
      toast.success("Comportamento salvo.");
      await queryClient.invalidateQueries({
        queryKey: ["gateway", "agente", ctx.empresa, agente.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const efetiva = agente.configuracao_efetiva ?? {};
  const origem = (efetiva["origem_config"] ?? {}) as Record<string, string>;
  const definir = (campo: string, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  // Funções que devolvem JSX (não componentes), para os campos não perderem o foco.
  /** Linha "Padrão" com o link para voltar ao padrão quando o agente tem valor próprio. */
  function padrao(campo: string) {
    const proprio = (form[campo] ?? "") !== "";
    if (proprio) {
      return (
        <p className="text-xs text-ink-500">
          Valor próprio deste agente.{" "}
          {podeEditar ? (
            <button
              type="button"
              className="font-medium text-purple-700 underline-offset-2 hover:underline"
              onClick={() => definir(campo, "")}
            >
              Usar padrão
            </button>
          ) : null}
        </p>
      );
    }
    const valor = efetiva[campo];
    const texto =
      valor === undefined || valor === null || (Array.isArray(valor) && valor.length === 0)
        ? "vazio"
        : typeof valor === "boolean"
          ? valor
            ? "Sim"
            : "Não"
          : paraTexto(valor).replace(/\n/g, ", ");
    const de = ORIGEM_VALOR[origem[campo] ?? ""];
    return (
      <p className="text-xs text-ink-500">
        Padrão: {texto}
        {de ? ` (vem ${de})` : ""}
      </p>
    );
  }

  function campoTexto({
    campo,
    tipo = "texto",
    min,
    max,
  }: {
    campo: CampoAgente;
    tipo?: "texto" | "numero" | "longo" | "telefone";
    min?: number;
    max?: number;
  }) {
    const id = `cmp-${campo}`;
    const comum = {
      id,
      value: form[campo] ?? "",
      disabled: !podeEditar,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        definir(campo, e.target.value),
    };
    const efetivo = efetiva[campo];
    const dica = efetivo === undefined || efetivo === null ? "" : paraTexto(efetivo);
    return (
      <div className="space-y-1.5">
        <RotuloCampo htmlFor={id} campo={CAMPO_AGENTE[campo]} />
        {tipo === "longo" ? (
          <Textarea {...comum} rows={2} placeholder={dica} />
        ) : (
          <Input
            {...comum}
            type={tipo === "numero" ? "number" : "text"}
            inputMode={tipo === "telefone" ? "numeric" : undefined}
            {...(min !== undefined ? { min } : {})}
            {...(max !== undefined ? { max } : {})}
            placeholder={dica}
            className="max-w-xs"
          />
        )}
        {campo !== "nome" ? padrao(campo) : null}
      </div>
    );
  }

  const pilotoLigado =
    form["modo_piloto"] !== "" ? form["modo_piloto"] === "true" : efetiva["modo_piloto"] === true;

  return (
    <form
      className="space-y-6 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        if (sujo) salvar.mutate();
      }}
    >
      {!podeEditar ? (
        <p className="rounded-lg bg-purple-50 px-4 py-3 text-sm text-purple-800">
          Seu acesso permite apenas consultar este agente.
        </p>
      ) : null}

      {plataforma ? <Secao titulo="Identificação">{campoTexto({ campo: "nome" })}</Secao> : null}

      <Secao titulo="Mensagens" descricao="O que o cliente recebe quando algo foge do normal.">
        {campoTexto({ campo: "aviso_demora", tipo: "longo" })}
        {campoTexto({ campo: "slow_notice_s", tipo: "numero", min: 0 })}
        {campoTexto({ campo: "fallback", tipo: "longo" })}
      </Secao>

      <Secao titulo="Tempos" descricao="Quanto o agente espera antes de responder.">
        {campoTexto({ campo: "debounce_s", tipo: "numero", min: 1, max: 15 })}
        {campoTexto({ campo: "max_wait_s", tipo: "numero", min: 1, max: 30 })}
        {campoTexto({ campo: "pause_minutes", tipo: "numero", min: 0 })}
      </Secao>

      <Secao titulo="Piloto" descricao="Libere o agente aos poucos.">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-base-200 bg-base-50 px-4 py-3">
            <div>
              <Label htmlFor="cmp-modo_piloto">{CAMPO_AGENTE.modo_piloto.rotulo}</Label>
              <Ajuda>{CAMPO_AGENTE.modo_piloto.ajuda}</Ajuda>
            </div>
            <Switch
              id="cmp-modo_piloto"
              checked={pilotoLigado}
              disabled={!podeEditar}
              onCheckedChange={(v) => definir("modo_piloto", v ? "true" : "false")}
            />
          </div>
          {padrao("modo_piloto")}
        </div>
        {pilotoLigado ? campoTexto({ campo: "contatos_permitidos", tipo: "longo" }) : null}
      </Secao>

      <Secao titulo="Alertas">{campoTexto({ campo: "alerta_telefone", tipo: "telefone" })}</Secao>

      {podeEditar && sujo ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-200 bg-card px-5 py-3 shadow-[0_10px_28px_rgba(46,35,64,0.12)]">
          <p className="text-sm text-ink-700">Há alterações não salvas.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setForm(valoresIniciais(campos, original))}
              disabled={salvar.isPending}
            >
              Descartar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <Cartao className="p-6">
      <h2 className="font-display text-xl text-purple-800">{titulo}</h2>
      {descricao ? <Ajuda>{descricao}</Ajuda> : null}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">{children}</div>
    </Cartao>
  );
}
