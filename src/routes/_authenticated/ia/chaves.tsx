import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Etiqueta,
  PaginaGateway,
  RotuloCampo,
  SegredoUmaVez,
  Vazio,
  dataHora,
  type ContextoGateway,
} from "@/components/luxtia/Gateway";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import { ESCOPOS, criarChave, listarChaves, revogarChave } from "@/lib/gateway-chaves.functions";
import type { ChaveGateway } from "@/lib/gateway/tipos";
import { CAMPO_CHAVE, ESCOPO } from "@/lib/gateway/vocabulario";

export const Route = createFileRoute("/_authenticated/ia/chaves")({
  head: () => ({ meta: [{ title: "Chaves de API | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Chaves de API"
      descricao="Chaves para sistemas da empresa conversarem com os agentes. O valor aparece uma única vez."
      papeis={["plataforma"]}
    >
      {(ctx) => <Chaves key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

const SEM_AGENTE = "__todos__";

function situacao(c: ChaveGateway) {
  if (c.revogada_em) return { rotulo: "Revogada", tom: "perigo" as const };
  if (c.expira_em && new Date(c.expira_em) < new Date())
    return { rotulo: "Expirada", tom: "alerta" as const };
  return { rotulo: "Ativa", tom: "sucesso" as const };
}

function Chaves({ ctx }: { ctx: ContextoGateway }) {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarChaves);
  const listarAg = useServerFn(listarAgentes);
  const revogar = useServerFn(revogarChave);
  const [criando, setCriando] = useState(false);
  // Chave em texto: só em memória, até o usuário fechar o aviso.
  const [chave, setChave] = useState<string | null>(null);

  const chaves = useQuery({
    queryKey: ["gateway", "chaves", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa } }),
  });
  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
  });
  const nomeAgente = (id: string | null) =>
    id ? (agentes.data?.itens.find((a) => a.id === id)?.nome ?? id) : "todos os agentes";

  const recarregar = () =>
    queryClient.invalidateQueries({ queryKey: ["gateway", "chaves", ctx.empresa] });

  const revogacao = useMutation({
    mutationFn: (c: ChaveGateway) => revogar({ data: { empresa: ctx.empresa, chave: c.id } }),
    onSuccess: () => {
      toast.success("Chave revogada.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = chaves.data?.itens ?? [];

  return (
    <>
      <div className="mt-6 flex justify-end">
        <Button onClick={() => setCriando(true)}>
          <Plus className="size-4" aria-hidden /> Nova chave
        </Button>
      </div>

      <Cartao className="mt-4">
        {chaves.isLoading ? (
          <p className="px-5 py-8 text-ink-500">Carregando…</p>
        ) : chaves.error ? (
          <EstadoVazio titulo="Não foi possível carregar" texto={(chaves.error as Error).message} />
        ) : itens.length === 0 ? (
          <Vazio
            titulo="Nenhuma chave ainda"
            texto="Crie uma chave quando um sistema da empresa precisar conversar com os agentes."
            acao={
              <Button onClick={() => setCriando(true)}>
                <Plus className="size-4" aria-hidden /> Criar chave
              </Button>
            }
          />
        ) : (
          <ul>
            {itens.map((c) => {
              const s = situacao(c);
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 border-b border-base-200 px-5 py-4 last:border-0 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{c.nome}</p>
                      <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                      {c.escopos.map((e) => (
                        <Etiqueta key={e} tom="roxo">
                          {ESCOPO[e]?.rotulo ?? e}
                        </Etiqueta>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      <span className="font-mono">{c.id}</span> · {nomeAgente(c.agente_id)} · criada{" "}
                      {dataHora(c.criado_em)} · expira {dataHora(c.expira_em)} · último uso{" "}
                      {dataHora(c.ultimo_uso_em)}
                      {c.ips_permitidos?.length ? ` · IPs ${c.ips_permitidos.join(", ")}` : ""}
                    </p>
                  </div>
                  {!c.revogada_em ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={revogacao.isPending}>
                          Revogar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revogar a chave {c.nome}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Os sistemas que usam esta chave deixam de ser aceitos imediatamente. Não
                            é possível desfazer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => revogacao.mutate(c)}>
                            Revogar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>

      <NovaChave
        ctx={ctx}
        aberto={criando}
        agentes={agentes.data?.itens ?? []}
        onFechar={() => setCriando(false)}
        onCriada={(valor) => {
          setChave(valor);
          void recarregar();
        }}
      />

      <SegredoUmaVez
        titulo="Nova chave de API"
        descricao="Envie no cabeçalho X-API-Key. O painel guarda apenas um resumo e não consegue mostrá-la de novo."
        valor={chave}
        onFechar={() => setChave(null)}
      />
    </>
  );
}

function NovaChave({
  ctx,
  aberto,
  agentes,
  onFechar,
  onCriada,
}: {
  ctx: ContextoGateway;
  aberto: boolean;
  agentes: { id: string; nome: string }[];
  onFechar: () => void;
  onCriada: (chave: string) => void;
}) {
  const criar = useServerFn(criarChave);
  const [nome, setNome] = useState("");
  const [escopos, setEscopos] = useState<(typeof ESCOPOS)[number][]>(["conversar"]);
  const [agente, setAgente] = useState(SEM_AGENTE);
  const [expira, setExpira] = useState("");
  const [ips, setIps] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      criar({
        data: {
          empresa: ctx.empresa,
          nome,
          escopos,
          agente_id: agente === SEM_AGENTE ? null : agente,
          // Fim do dia escolhido, no fuso do navegador.
          expira_em: expira ? new Date(`${expira}T23:59:59`).toISOString() : null,
          ips_permitidos: ips
            .split(/[\s,;]+/)
            .map((ip) => ip.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (resultado) => {
      setNome("");
      setExpira("");
      setIps("");
      onFechar();
      onCriada(resultado.chave);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova chave de API</DialogTitle>
          <DialogDescription>
            O valor da chave aparece uma única vez, logo depois de criar.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (escopos.length === 0) {
              toast.error("Escolha ao menos uma permissão.");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <RotuloCampo htmlFor="ch-nome" campo={CAMPO_CHAVE.nome} />
            <Input
              id="ch-nome"
              value={nome}
              required
              placeholder="ex.: integracao_pedidos"
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">O que a chave pode fazer</legend>
            {ESCOPOS.map((e) => (
              <label key={e} className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={escopos.includes(e)}
                  onCheckedChange={(marcado) =>
                    setEscopos((atual) => (marcado ? [...atual, e] : atual.filter((x) => x !== e)))
                  }
                />
                <span>
                  <span>{ESCOPO[e]?.rotulo ?? e}</span>
                  <span className="block text-xs text-ink-500">{ESCOPO[e]?.ajuda}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <RotuloCampo htmlFor="ch-agente" campo={CAMPO_CHAVE.agente} />
            <Select value={agente} onValueChange={setAgente}>
              <SelectTrigger id="ch-agente">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_AGENTE}>Todos os agentes da empresa</SelectItem>
                {agentes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RotuloCampo htmlFor="ch-expira" campo={CAMPO_CHAVE.validade} />
              <Input
                id="ch-expira"
                type="date"
                value={expira}
                onChange={(e) => setExpira(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <RotuloCampo htmlFor="ch-ips" campo={CAMPO_CHAVE.ips} />
              <Textarea
                id="ch-ips"
                rows={2}
                value={ips}
                placeholder="200.10.20.0/24"
                onChange={(e) => setIps(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando…" : "Criar chave"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
