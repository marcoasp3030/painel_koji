import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { obterCapacidade, salvarCapacidade } from "@/lib/gateway-capacidade.functions";
import { AJUDA_CAPACIDADE, problemaCapacidade } from "@/lib/gateway/capacidade";
export function Capacidade({ empresa, agente }: { empresa: string; agente?: string }) {
  const ler = useServerFn(obterCapacidade);
  const salvar = useServerFn(salvarCapacidade);
  const qc = useQueryClient();
  const [valor, setValor] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const data = { empresa, agente };
  const chave = ["gateway", "capacidade", empresa, agente ?? "empresa"];
  const q = useQuery({ queryKey: chave, queryFn: () => ler({ data }) });
  const atual = q.data?.ok ? q.data : null;
  const texto = valor ?? atual?.valor?.toString() ?? "";
  const invalido =
    texto.trim() === ""
      ? "Informe um valor ou use Voltar ao padrão."
      : problemaCapacidade(Number(texto));
  const m = useMutation({
    mutationFn: (n: number | null) => salvar({ data: { ...data, valor: n } }),
    onSuccess: async (r) => {
      if (!r.ok) {
        setErro(r.erro.mensagem);
        return;
      }
      setErro(null);
      setValor(null);
      qc.setQueryData(chave, r);
      await qc.invalidateQueries({ queryKey: ["gateway", "agente", empresa] });
      await qc.invalidateQueries({ queryKey: ["gateway", "capacidade", empresa] });
      toast.success("Limite atualizado.");
    },
    onError: (e: Error) => setErro(e.message),
  });
  const id = agente ? "capacidade-agente" : "capacidade-empresa";
  return (
    <div className="space-y-3 rounded-lg border border-base-200 p-4">
      <Label htmlFor={id}>Conversas simultâneas {agente ? "deste agente" : "da empresa"}</Label>
      <p id={`${id}-ajuda`} className="text-sm text-ink-500">
        {AJUDA_CAPACIDADE}
      </p>
      {q.isPending ? (
        <p>Carregando…</p>
      ) : q.error ? (
        <p role="alert">{q.error.message}</p>
      ) : (
        <>
          <p className="text-sm">
            Em vigor: <strong>{atual?.efetivo ?? "Não informado"}</strong>. Padrão: 5
            {agente ? "; ao remover o ajuste, herda a configuração da empresa/modelo" : ""}.
          </p>
          <Input
            id={id}
            type="number"
            min={1}
            max={100}
            step={1}
            value={texto}
            placeholder="Padrão herdado"
            disabled={m.isPending}
            aria-invalid={!!erro || (valor !== null && !!invalido)}
            aria-describedby={`${id}-ajuda ${id}-erro`}
            onChange={(e) => {
              setValor(e.target.value);
              setErro(null);
            }}
          />
          <p id={`${id}-erro`} role="alert" className="text-sm text-red-700">
            {erro ?? (valor !== null ? invalido : null)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={m.isPending || !!invalido}
              onClick={() => m.mutate(Number(texto))}
            >
              Salvar limite
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={m.isPending}
              onClick={() => m.mutate(null)}
            >
              Voltar ao padrão
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
