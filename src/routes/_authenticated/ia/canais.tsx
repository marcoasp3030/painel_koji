import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import {
  Etiqueta,
  PaginaGateway,
  SegredoUmaVez,
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
import { Switch } from "@/components/ui/switch";
import { listarAgentes } from "@/lib/gateway-agentes.functions";
import {
  alterarCanal,
  criarCanal,
  listarCanais,
  rotacionarSegredoCanal,
} from "@/lib/gateway-canais.functions";
import type { CanalGateway } from "@/lib/gateway/tipos";

export const Route = createFileRoute("/_authenticated/ia/canais")({
  head: () => ({ meta: [{ title: "Canais | Luxtia" }] }),
  component: () => (
    <PaginaGateway
      titulo="Canais"
      descricao="Por onde as mensagens chegam aos agentes. A URL do webhook leva um segredo e aparece uma única vez."
      papeis={["plataforma", "admin", "membro"]}
    >
      {(ctx) => <Canais key={ctx.empresa ?? "empresa"} ctx={ctx} />}
    </PaginaGateway>
  ),
});

function Canais({ ctx }: { ctx: ContextoGateway }) {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarCanais);
  const listarAg = useServerFn(listarAgentes);
  const alterar = useServerFn(alterarCanal);
  const rotacionar = useServerFn(rotacionarSegredoCanal);
  const plataforma = ctx.papel === "plataforma";
  const [criando, setCriando] = useState(false);
  // URL com segredo: só em memória, até o usuário fechar o aviso.
  const [segredo, setSegredo] = useState<{ titulo: string; url: string } | null>(null);

  const canais = useQuery({
    queryKey: ["gateway", "canais", ctx.empresa],
    queryFn: () => listar({ data: { empresa: ctx.empresa } }),
  });
  const agentes = useQuery({
    queryKey: ["gateway", "agentes", ctx.empresa],
    queryFn: () => listarAg({ data: { empresa: ctx.empresa } }),
  });
  const nomeAgente = (id: string | null) =>
    agentes.data?.itens.find((a) => a.id === id)?.nome ?? id ?? "—";

  const recarregar = () =>
    queryClient.invalidateQueries({ queryKey: ["gateway", "canais", ctx.empresa] });

  const ativar = useMutation({
    mutationFn: (c: CanalGateway) =>
      alterar({ data: { empresa: ctx.empresa, canal: c.id, dados: { ativo: !c.ativo } } }),
    onSuccess: (c) => {
      toast.success(c.ativo ? "Canal ativado." : "Canal desativado.");
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotacao = useMutation({
    mutationFn: (c: CanalGateway) => rotacionar({ data: { empresa: ctx.empresa, canal: c.id } }),
    onSuccess: (r) => {
      setSegredo({ titulo: "Nova URL do webhook", url: r.webhook_url });
      void recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = canais.data?.itens ?? [];

  return (
    <>
      {plataforma ? (
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setCriando(true)}>
            <Plus className="size-4" aria-hidden /> Novo canal
          </Button>
        </div>
      ) : null}

      <Cartao className="mt-4">
        {canais.isLoading ? (
          <p className="px-5 py-8 text-ink-500">Carregando…</p>
        ) : canais.error ? (
          <EstadoVazio titulo="Não foi possível carregar" texto={(canais.error as Error).message} />
        ) : itens.length === 0 ? (
          <EstadoVazio titulo="Nenhum canal" texto="Esta empresa ainda não tem canais." />
        ) : (
          <ul>
            {itens.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-4 border-b border-base-200 px-5 py-4 last:border-0 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink-900">{c.nome}</p>
                    <Etiqueta tom="roxo">{c.tipo}</Etiqueta>
                    <Etiqueta tom={c.ativo ? "sucesso" : "neutro"}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </Etiqueta>
                    {c.publico === "interno" ? <Etiqueta>interno</Etiqueta> : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    <span className="font-mono">{c.id}</span> · agente {nomeAgente(c.agente_id)}
                    {c.ultimo_evento_em ? ` · último evento ${dataHora(c.ultimo_evento_em)}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-500">
                    <span>
                      Segredo do webhook{" "}
                      {c.webhook_secret_configurado ? (
                        <span className="text-success">
                          configurado <CheckCircle2 className="inline size-3.5" aria-label="✓" />
                        </span>
                      ) : (
                        "ausente"
                      )}
                    </span>
                    {c.tipo !== "api" ? (
                      <span>
                        Credenciais{" "}
                        {c.credenciais_configurado ? (
                          <span className="text-success">
                            configuradas <CheckCircle2 className="inline size-3.5" aria-label="✓" />
                          </span>
                        ) : (
                          "não configuradas"
                        )}
                      </span>
                    ) : null}
                  </p>
                </div>

                {plataforma ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-ink-700">
                      <Switch
                        checked={c.ativo}
                        disabled={ativar.isPending}
                        onCheckedChange={() => ativar.mutate(c)}
                        aria-label={c.ativo ? "Desativar canal" : "Ativar canal"}
                      />
                      {c.ativo ? "Ativo" : "Inativo"}
                    </label>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={rotacao.isPending}>
                          <RotateCw className="size-4" aria-hidden /> Rotacionar segredo
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rotacionar o segredo de {c.nome}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A URL atual para de funcionar assim que a nova for gerada: chamadas com
                            o segredo antigo recebem 401. Atualize a URL no provedor logo em
                            seguida.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => rotacao.mutate(c)}>
                            Gerar nova URL
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {plataforma ? (
        <NovoCanal
          ctx={ctx}
          aberto={criando}
          agentes={agentes.data?.itens ?? []}
          onFechar={() => setCriando(false)}
          onCriado={(url) => {
            setSegredo({ titulo: "URL do webhook do novo canal", url });
            void recarregar();
          }}
        />
      ) : null}

      <SegredoUmaVez
        titulo={segredo?.titulo ?? ""}
        descricao="Cadastre esta URL no provedor do canal. Ela contém o segredo que autentica as mensagens recebidas."
        valor={segredo?.url ?? null}
        onFechar={() => setSegredo(null)}
      />
    </>
  );
}

function NovoCanal({
  ctx,
  aberto,
  agentes,
  onFechar,
  onCriado,
}: {
  ctx: ContextoGateway;
  aberto: boolean;
  agentes: { id: string; nome: string }[];
  onFechar: () => void;
  onCriado: (webhookUrl: string) => void;
}) {
  const criar = useServerFn(criarCanal);
  const [tipo, setTipo] = useState<"api" | "uazapi">("api");
  const [nome, setNome] = useState("");
  const [agente, setAgente] = useState("");
  const [publico, setPublico] = useState<"clientes" | "interno">("clientes");
  const [ativo, setAtivo] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");

  const limpar = () => {
    setNome("");
    setBaseUrl("");
    setToken("");
    setAtivo(false);
  };

  const mutation = useMutation({
    mutationFn: () =>
      criar({
        data: {
          empresa: ctx.empresa,
          tipo,
          nome,
          agente_id: agente,
          publico,
          ativo,
          credenciais: tipo === "uazapi" && baseUrl ? { base_url: baseUrl, token } : null,
        },
      }),
    onSuccess: (canal) => {
      limpar();
      onFechar();
      onCriado(canal.webhook_url);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={(a) => {
        if (!a) {
          setToken("");
          onFechar();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo canal</DialogTitle>
          <DialogDescription>
            A URL do webhook aparece uma única vez, logo depois de criar.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (!agente) {
              toast.error("Escolha o agente.");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cn-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "api" | "uazapi")}>
                <SelectTrigger id="cn-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="uazapi">Uazapi (WhatsApp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cn-publico">Público</Label>
              <Select
                value={publico}
                onValueChange={(v) => setPublico(v as "clientes" | "interno")}
              >
                <SelectTrigger id="cn-publico">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clientes">Clientes</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cn-nome">Nome</Label>
            <Input id="cn-nome" value={nome} required onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cn-agente">Agente</Label>
            <Select value={agente} onValueChange={setAgente}>
              <SelectTrigger id="cn-agente">
                <SelectValue placeholder="Escolha o agente" />
              </SelectTrigger>
              <SelectContent>
                {agentes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tipo === "uazapi" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cn-base">URL da instância</Label>
                <Input
                  id="cn-base"
                  type="url"
                  value={baseUrl}
                  placeholder="https://instancia.uazapi.com"
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cn-token">Token</Label>
                <Input
                  id="cn-token"
                  type="password"
                  value={token}
                  autoComplete="new-password"
                  required={Boolean(baseUrl)}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
              <p className="text-xs text-ink-500 sm:col-span-2">
                As credenciais são só de escrita. A recepção Uazapi ainda depende das fixtures reais
                (Fase 1).
              </p>
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-lg border border-base-200 bg-base-50 px-4 py-3">
            <div>
              <Label htmlFor="cn-ativo" className="text-sm">
                Ativar agora
              </Label>
              <p className="text-xs text-ink-500">Canal inativo ignora as mensagens recebidas.</p>
            </div>
            <Switch id="cn-ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando…" : "Criar canal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
