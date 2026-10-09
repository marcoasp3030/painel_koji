/**
 * Aba Conexão com IA (só admin da plataforma). Formulário provisório: o passo
 * guiado (dados → testar conexão → ativar IA real) entra no próximo item.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { RotuloCampo, type ContextoGateway } from "@/components/luxtia/Gateway";
import { Cartao } from "@/components/luxtia/Superficie";
import { Button } from "@/components/ui/button";
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
import { alterarAgente } from "@/lib/gateway-agentes.functions";
import { diferencas, paraTexto, type Formulario } from "@/lib/gateway/formulario";
import type { AgenteDetalhe } from "@/lib/gateway/tipos";
import { CAMPO_AGENTE, RESPOSTAS } from "@/lib/gateway/vocabulario";

const CAMPOS_SKYONE = [
  "provedor",
  "agente_mode",
  "skyone_webhook_url",
  "skyone_auth_tipo",
  "timeout_s",
  "instrucoes_agente",
];

export function ConexaoIA({ ctx, agente }: { ctx: ContextoGateway; agente: AgenteDetalhe }) {
  const queryClient = useQueryClient();
  const alterar = useServerFn(alterarAgente);
  const [form, setForm] = useState<Formulario>({});
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  useEffect(() => {
    const valores: Formulario = {};
    for (const campo of CAMPOS_SKYONE) {
      valores[campo] = paraTexto((agente as Record<string, unknown>)[campo]);
    }
    setForm(valores);
  }, [agente]);

  const salvar = useMutation({
    mutationFn: (dados: Record<string, unknown>) =>
      alterar({ data: { empresa: ctx.empresa, agente: agente.id, dados } }),
    onSuccess: async () => {
      toast.success("Configuração do Skyone salva.");
      setUsuario("");
      setSenha("");
      await queryClient.invalidateQueries({
        queryKey: ["gateway", "agente", ctx.empresa, agente.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (nome: string) => (v: string) => setForm((f) => ({ ...f, [nome]: v }));
  const basic = form["skyone_auth_tipo"] === "basic";
  const tiposOutros = ["bearer", "cabecalho"].includes(agente.skyone_auth_tipo);

  return (
    <Cartao className="p-6">
      <form
        className="space-y-5"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          const dados = diferencas(CAMPOS_SKYONE, form, agente as Record<string, unknown>);
          // Credenciais são só de escrita: vão apenas quando preenchidas.
          if (usuario.trim()) dados["skyone_auth_usuario"] = usuario.trim();
          if (senha) dados["skyone_auth"] = senha;
          if (Object.keys(dados).length === 0) {
            toast.info("Nada foi alterado.");
            return;
          }
          salvar.mutate(dados);
        }}
      >
        <div>
          <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-ink-500">Skyone</h3>
          <p className="mt-1 text-xs text-ink-500">
            O fluxo do Skyone é criado do zero no Skyone. O envio aos clientes continua em modo
            simulado (send_mode {String(agente.configuracao_efetiva?.["send_mode"] ?? "dry")}).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sk-provedor">Serviço de IA</Label>
            <Select value={form["provedor"] ?? ""} onValueChange={set("provedor")}>
              <SelectTrigger id="sk-provedor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">Nenhum (simulação)</SelectItem>
                <SelectItem value="skyone">Skyone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <RotuloCampo htmlFor="sk-modo" campo={CAMPO_AGENTE.agente_mode} />
            <Select
              value={form["agente_mode"] || "herdar"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, agente_mode: v === "herdar" ? "" : v }))
              }
            >
              <SelectTrigger id="sk-modo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="herdar">
                  Usar padrão (
                  {RESPOSTAS[String(agente.configuracao_efetiva?.["agente_mode"] ?? "mock")]})
                </SelectItem>
                <SelectItem value="mock">{RESPOSTAS["mock"]}</SelectItem>
                <SelectItem value="live">{RESPOSTAS["live"]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <RotuloCampo htmlFor="sk-url" campo={CAMPO_AGENTE.skyone_webhook_url} />
            <Input
              id="sk-url"
              type="url"
              value={form["skyone_webhook_url"] ?? ""}
              placeholder="https://luxtia.api.integrasky.cloud/…"
              onChange={(e) => set("skyone_webhook_url")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sk-auth">Acesso ao fluxo</Label>
            <Select value={form["skyone_auth_tipo"] ?? ""} onValueChange={set("skyone_auth_tipo")}>
              <SelectTrigger id="sk-auth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem senha</SelectItem>
                <SelectItem value="basic">Usuário e senha</SelectItem>
                {tiposOutros ? (
                  <SelectItem value={agente.skyone_auth_tipo}>
                    {agente.skyone_auth_tipo} (atual)
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <RotuloCampo htmlFor="sk-timeout" campo={CAMPO_AGENTE.timeout_s} />
            <Input
              id="sk-timeout"
              type="number"
              min={1}
              max={600}
              value={form["timeout_s"] ?? ""}
              placeholder="90"
              onChange={(e) => set("timeout_s")(e.target.value)}
            />
          </div>
          {basic ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="sk-usuario" className="flex items-center gap-2">
                  Usuário
                  {agente.skyone_auth_usuario_configurado ? <Configurado /> : null}
                </Label>
                <Input
                  id="sk-usuario"
                  value={usuario}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    agente.skyone_auth_usuario_configurado
                      ? "Deixe em branco para manter"
                      : "flow-<id-do-fluxo>@luxtia"
                  }
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sk-senha" className="flex items-center gap-2">
                  Senha
                  {agente.skyone_auth_configurado ? <Configurado /> : null}
                </Label>
                <Input
                  id="sk-senha"
                  type="password"
                  value={senha}
                  autoComplete="new-password"
                  placeholder={agente.skyone_auth_configurado ? "Deixe em branco para manter" : ""}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <p className="text-xs text-ink-500 sm:col-span-2">
                Usuário e senha são só de escrita: o painel nunca mostra os valores salvos.
              </p>
            </>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <RotuloCampo htmlFor="sk-instrucoes" campo={CAMPO_AGENTE.instrucoes_agente} />
            <Textarea
              id="sk-instrucoes"
              rows={3}
              value={form["instrucoes_agente"] ?? ""}
              onChange={(e) => set("instrucoes_agente")(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar Skyone"}
        </Button>
      </form>
    </Cartao>
  );
}

function Configurado() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-normal text-success">
      configurado <CheckCircle2 className="size-3.5" aria-label="✓" />
    </span>
  );
}
