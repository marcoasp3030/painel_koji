import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { gestao } from "@/lib/gateway-gestao.functions";
import {
  dataRecebida,
  fimDeTurnoUtil,
  instanteDaqui,
  type PedidoGestao,
  type Unidade,
} from "@/lib/gateway/gestao";
import type { ContextoGateway } from "./Gateway";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function useGestao(ctx: ContextoGateway) {
  const fn = useServerFn(gestao);
  const qc = useQueryClient();
  const [erro, setErro] = useState<{ campo: string; mensagem: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function ler<T>(d: Omit<PedidoGestao, "empresa">): Promise<T> {
    const r = await fn({ data: { ...d, empresa: ctx.empresa } });
    if (!r.ok) throw new Error(r.erro.mensagem);
    return r.dados as T;
  }
  async function executar(d: Record<string, unknown>) {
    setBusy(true);
    setErro(null);
    try {
      const r = await fn({ data: { ...d, empresa: ctx.empresa } });
      if (!r.ok) setErro(r.erro);
      else await qc.invalidateQueries({ queryKey: ["gestao", ctx.empresa] });
      return r;
    } catch (e) {
      const falha = {
        campo: "corpo",
        mensagem: e instanceof Error ? e.message : "Não foi possível salvar.",
      };
      setErro(falha);
      return { ok: false as const, erro: falha };
    } finally {
      setBusy(false);
    }
  }
  async function salvar(d: Record<string, unknown>) {
    const r = await executar(d);
    if (r.ok) toast.success("Alteração salva.");
    return r.ok;
  }
  return { ler, salvar, executar, erro, setErro, busy };
}

export function EditorFaixas({
  faixas,
  onChange,
  disabled = false,
}: {
  faixas: [string, string][];
  onChange: (v: [string, string][]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {faixas.map(([a, b], i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            className="min-h-11 w-32"
            aria-label={`Início do turno ${i + 1}`}
            type="time"
            value={a}
            disabled={disabled}
            onChange={(e) => onChange(faixas.map((f, j) => (j === i ? [e.target.value, b] : f)))}
          />
          <span>até</span>
          <Input
            className="min-h-11 w-32"
            aria-label={`Fim do turno ${i + 1}`}
            type="time"
            value={b}
            disabled={disabled}
            onChange={(e) => onChange(faixas.map((f, j) => (j === i ? [a, e.target.value] : f)))}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => onChange(faixas.filter((_, j) => j !== i))}
          >
            Remover
          </Button>
          {b < a && <span className="text-sm">Termina no dia seguinte</span>}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={disabled || faixas.length >= 12}
        onClick={() => onChange([...faixas, ["12:00", "15:00"]])}
      >
        Adicionar turno
      </Button>
    </div>
  );
}

export function botoesPausaRapida(
  u: Unidade,
  aplicar: (iso: string) => void,
  avisar: (mensagem: string) => void,
) {
  const fim = u.situacao.fecha_as !== null ? u.situacao.fecha_as : null;
  return [
    { rotulo: "30 min", iso: () => instanteDaqui(30, u.fuso_efetivo) },
    { rotulo: "1 h", iso: () => instanteDaqui(60, u.fuso_efetivo) },
    ...(fim
      ? [
          {
            rotulo: "Até o fim do turno",
            iso: () => {
              const util = fimDeTurnoUtil(fim);
              if (!util) throw new Error("O fim do turno informado já passou ou não tem fuso.");
              return util;
            },
          },
        ]
      : []),
  ].map((b) => ({
    rotulo: b.rotulo,
    onClick: () => {
      try {
        aplicar(b.iso());
      } catch (e) {
        avisar(e instanceof Error ? e.message : "Confira o horário.");
      }
    },
  }));
}

export function textoPrazo(iso: string) {
  return dataRecebida(iso);
}
