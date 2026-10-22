/** Diálogo de criação de canal (admin da plataforma). A URL do webhook volta por onCriado. */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ajuda, RotuloCampo, type ContextoGateway } from "@/components/luxtia/Gateway";
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
import { criarCanal } from "@/lib/gateway-canais.functions";
import { CAMPO_CANAL, PUBLICO_CANAL, TIPO_CANAL } from "@/lib/gateway/vocabulario";

export function NovoCanal({
  ctx,
  aberto,
  agentes,
  onFechar,
  onCriado,
  agenteFixo = null,
}: {
  ctx: ContextoGateway;
  aberto: boolean;
  agentes: { id: string; nome: string }[];
  /** Cria o canal já ligado a este agente (página do agente). */
  agenteFixo?: string | null;
  onFechar: () => void;
  onCriado: (
    webhookUrl: string,
    webhookUazapi?: import("@/lib/gateway/tipos").WebhookUazapi,
  ) => void;
}) {
  const criar = useServerFn(criarCanal);
  const [tipo, setTipo] = useState<"api" | "uazapi">("api");
  const [nome, setNome] = useState("");
  const [agente, setAgente] = useState(agenteFixo ?? "");
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
      onCriado(canal.webhook_url, canal.webhook_uazapi);
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
              <RotuloCampo htmlFor="cn-tipo" campo={CAMPO_CANAL.tipo} />
              <Select value={tipo} onValueChange={(v) => setTipo(v as "api" | "uazapi")}>
                <SelectTrigger id="cn-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">{TIPO_CANAL["api"]}</SelectItem>
                  <SelectItem value="uazapi">{TIPO_CANAL["uazapi"]}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <RotuloCampo htmlFor="cn-publico" campo={CAMPO_CANAL.publico} />
              <Select
                value={publico}
                onValueChange={(v) => setPublico(v as "clientes" | "interno")}
              >
                <SelectTrigger id="cn-publico">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clientes">{PUBLICO_CANAL["clientes"]}</SelectItem>
                  <SelectItem value="interno">{PUBLICO_CANAL["interno"]}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <RotuloCampo htmlFor="cn-nome" campo={CAMPO_CANAL.nome} />
            <Input id="cn-nome" value={nome} required onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <RotuloCampo htmlFor="cn-agente" campo={CAMPO_CANAL.agente} />
            <Select value={agente} onValueChange={setAgente} disabled={Boolean(agenteFixo)}>
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
                <RotuloCampo htmlFor="cn-base" campo={CAMPO_CANAL.base_url} />
                <Input
                  id="cn-base"
                  type="url"
                  value={baseUrl}
                  placeholder="https://instancia.uazapi.com"
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <RotuloCampo htmlFor="cn-token" campo={CAMPO_CANAL.token} />
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
                {CAMPO_CANAL.ativo.rotulo}
              </Label>
              <Ajuda>{CAMPO_CANAL.ativo.ajuda}</Ajuda>
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
