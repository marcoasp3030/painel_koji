/**
 * Aba Conexão com IA (só admin da plataforma), em três passos:
 * dados do fluxo → testar conexão → ativar IA real. O modo real nunca é
 * trocado numa lista de campos: só pelo botão do passo 3, depois do teste.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Ajuda, RotuloCampo, type ContextoGateway } from "@/components/luxtia/Gateway";
import { Cartao } from "@/components/luxtia/Superficie";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { alterarAgente, testarConexaoSkyone } from "@/lib/gateway-agentes.functions";
import { problemaNaUrl } from "@/lib/gateway/agentes";
import { conexaoSkyone } from "@/lib/gateway/prontidao";
import { TESTE_CONEXAO_DISPONIVEL } from "@/lib/gateway/recursos";
import type { AgenteDetalhe, ResultadoTeste } from "@/lib/gateway/tipos";
import { CAMPO_AGENTE, ENVIO } from "@/lib/gateway/vocabulario";

export function ConexaoIA({ ctx, agente }: { ctx: ContextoGateway; agente: AgenteDetalhe }) {
  const queryClient = useQueryClient();
  const alterar = useServerFn(alterarAgente);
  const testar = useServerFn(testarConexaoSkyone);

  const [url, setUrl] = useState(agente.skyone_webhook_url ?? "");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [timeout, setTimeout_] = useState(agente.timeout_s?.toString() ?? "90");
  const [instrucoes, setInstrucoes] = useState(agente.instrucoes_agente ?? "");
  const [erroDados, setErroDados] = useState<string | null>(null);
  const [teste, setTeste] = useState<
    { ok: true; resultado: ResultadoTeste } | { ok: false; mensagem: string } | null
  >(null);

  const efetiva = agente.configuracao_efetiva ?? {};
  const live = String(efetiva["agente_mode"] ?? agente.agente_mode ?? "mock") === "live";
  const envio = ENVIO[String(efetiva["send_mode"] ?? agente.send_mode ?? "dry")];
  const conexao = conexaoSkyone(agente);
  const usuarioSalvo = Boolean(agente.skyone_auth_usuario_configurado);
  const senhaSalva = Boolean(agente.skyone_auth_configurado);
  const outroAcesso = ["bearer", "cabecalho"].includes(agente.skyone_auth_tipo);

  const recarregar = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["gateway", "agente", ctx.empresa, agente.id],
    });
    await queryClient.invalidateQueries({ queryKey: ["gateway", "agentes", ctx.empresa] });
  };

  /** Monta o que mudou nos dados do fluxo; o modo do agente não é tocado aqui. */
  function dadosDoFluxo(): Record<string, unknown> | null {
    const problema = url.trim() ? problemaNaUrl(url.trim()) : "Informe a URL do fluxo.";
    if (problema) return (setErroDados(problema), null);
    if (!usuario.trim() && !usuarioSalvo)
      return (setErroDados("Informe o usuário do fluxo."), null);
    if (!senha && !senhaSalva) return (setErroDados("Informe a senha do fluxo."), null);
    const segundos = Number(timeout);
    if (!Number.isInteger(segundos) || segundos < 1 || segundos > 600) {
      return (setErroDados("O tempo limite vai de 1 a 600 segundos."), null);
    }
    setErroDados(null);
    const dados: Record<string, unknown> = {};
    if (agente.provedor !== "skyone") dados["provedor"] = "skyone";
    if (url.trim() !== (agente.skyone_webhook_url ?? "")) dados["skyone_webhook_url"] = url.trim();
    if (agente.skyone_auth_tipo !== "basic") dados["skyone_auth_tipo"] = "basic";
    if (usuario.trim()) dados["skyone_auth_usuario"] = usuario.trim();
    if (senha) dados["skyone_auth"] = senha;
    if (segundos !== agente.timeout_s) dados["timeout_s"] = segundos;
    if (instrucoes !== (agente.instrucoes_agente ?? "")) dados["instrucoes_agente"] = instrucoes;
    return dados;
  }

  const salvar = useMutation({
    mutationFn: async ({ e_testar }: { e_testar: boolean }) => {
      const dados = dadosDoFluxo();
      if (!dados) return null;
      if (Object.keys(dados).length > 0) {
        await alterar({ data: { empresa: ctx.empresa, agente: agente.id, dados } });
      }
      setUsuario("");
      setSenha("");
      if (!e_testar) return { salvo: Object.keys(dados).length > 0 };
      setTeste(null);
      try {
        const resultado = await testar({ data: { empresa: ctx.empresa, agente: agente.id } });
        setTeste({ ok: true, resultado });
      } catch (e) {
        setTeste({ ok: false, mensagem: (e as Error).message });
      }
      return { salvo: true };
    },
    onSuccess: async (r) => {
      if (!r) return;
      if (r.salvo) toast.success("Dados do fluxo salvos. As respostas continuam como estavam.");
      await recarregar();
    },
    onError: (e: Error) => setErroDados(e.message),
  });

  const modo = useMutation({
    mutationFn: (novo: "live" | "mock") =>
      alterar({ data: { empresa: ctx.empresa, agente: agente.id, dados: { agente_mode: novo } } }),
    onSuccess: async (_r, novo) => {
      toast.success(novo === "live" ? "IA real ativada." : "Respostas de volta à simulação.");
      setTeste(null);
      await recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ocupado = salvar.isPending || modo.isPending;

  return (
    <div className="space-y-6">
      <Passo
        numero={1}
        titulo="Dados do fluxo no Skyone"
        feito={conexao === "sim"}
        descricao="Crie o fluxo do zero no Skyone. Depois copie aqui a URL do webhook, o usuário e a senha."
      >
        <form
          className="space-y-5"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate({ e_testar: TESTE_CONEXAO_DISPONIVEL });
          }}
        >
          {outroAcesso ? (
            <p className="rounded-lg bg-purple-50 px-4 py-3 text-sm text-purple-800">
              Este agente usa outro tipo de acesso ao fluxo. Ao salvar com usuário e senha, ele
              passa a usar usuário e senha.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <RotuloCampo htmlFor="ia-url" campo={CAMPO_AGENTE.skyone_webhook_url} />
            <Input
              id="ia-url"
              type="url"
              inputMode="url"
              value={url}
              spellCheck={false}
              placeholder="https://luxtia.api.integrasky.cloud/…"
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ia-usuario" className="flex items-center gap-2">
                {CAMPO_AGENTE.skyone_auth_usuario.rotulo}
                {usuarioSalvo ? <Configurado /> : null}
              </Label>
              <Ajuda>{CAMPO_AGENTE.skyone_auth_usuario.ajuda}</Ajuda>
              <Input
                id="ia-usuario"
                value={usuario}
                autoComplete="off"
                spellCheck={false}
                placeholder={usuarioSalvo ? "Deixe em branco para manter" : "flow-<id>@luxtia"}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-senha" className="flex items-center gap-2">
                {CAMPO_AGENTE.skyone_auth.rotulo}
                {senhaSalva ? <Configurado /> : null}
              </Label>
              <Ajuda>{CAMPO_AGENTE.skyone_auth.ajuda}</Ajuda>
              <Input
                id="ia-senha"
                type="password"
                value={senha}
                autoComplete="new-password"
                placeholder={senhaSalva ? "Deixe em branco para manter" : ""}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
          </div>

          <details className="rounded-lg border border-base-200 bg-base-50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-700">Avançado</summary>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <RotuloCampo htmlFor="ia-timeout" campo={CAMPO_AGENTE.timeout_s} />
                <Input
                  id="ia-timeout"
                  type="number"
                  min={1}
                  max={600}
                  value={timeout}
                  className="max-w-[10rem]"
                  onChange={(e) => setTimeout_(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <RotuloCampo htmlFor="ia-instrucoes" campo={CAMPO_AGENTE.instrucoes_agente} />
                <Textarea
                  id="ia-instrucoes"
                  rows={3}
                  value={instrucoes}
                  onChange={(e) => setInstrucoes(e.target.value)}
                />
              </div>
            </div>
          </details>

          {erroDados ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {erroDados}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={ocupado || !TESTE_CONEXAO_DISPONIVEL}>
              {salvar.isPending && TESTE_CONEXAO_DISPONIVEL ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <PlugZap className="size-4" aria-hidden />
              )}
              Salvar e testar conexão
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => salvar.mutate({ e_testar: false })}
            >
              Só salvar os dados
            </Button>
          </div>
          {!TESTE_CONEXAO_DISPONIVEL ? (
            <Ajuda>
              O teste de conexão depende de uma atualização do gateway. Por enquanto, salve os
              dados; o teste será liberado em seguida. Salvar não muda as respostas do agente.
            </Ajuda>
          ) : null}
        </form>
      </Passo>

      <Passo
        numero={2}
        titulo="Testar conexão"
        feito={teste?.ok === true}
        descricao="Envia uma mensagem de teste ao fluxo sem mudar as respostas do agente. Nada vai para os clientes."
      >
        {!TESTE_CONEXAO_DISPONIVEL ? (
          <p className="text-sm text-ink-500">Aguardando a atualização do gateway.</p>
        ) : salvar.isPending ? (
          <p className="flex items-center gap-2 text-sm text-ink-500" aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Testando a conexão…
          </p>
        ) : teste?.ok ? (
          <div
            className="rounded-lg border border-success/30 bg-success-soft p-4"
            aria-live="polite"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Conectado: o Skyone respondeu em{" "}
              {(teste.resultado.latencia_ms / 1000).toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}{" "}
              s
            </p>
            {teste.resultado.resposta.map((linha, i) => (
              <p key={i} className="mt-2 whitespace-pre-wrap rounded-md bg-card px-3 py-2 text-sm">
                {linha}
              </p>
            ))}
          </div>
        ) : teste ? (
          <p
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
            aria-live="polite"
          >
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {teste.mensagem}
          </p>
        ) : (
          <p className="text-sm text-ink-500">Use “Salvar e testar conexão” no passo 1.</p>
        )}
      </Passo>

      <Passo
        numero={3}
        titulo="Ativar IA real"
        feito={live}
        descricao={`Com a IA real, o agente chama o Skyone em cada mensagem recebida. Envio aos clientes: ${envio}.`}
      >
        {live ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden /> IA real ativa
            </p>
            <Confirmar
              titulo="Voltar para simulação?"
              texto="O agente deixa de chamar o Skyone e passa a responder com a simulação."
              acao="Voltar para simulação"
              variante="outline"
              disabled={ocupado}
              onConfirmar={() => modo.mutate("mock")}
            />
          </div>
        ) : teste?.ok ? (
          <Confirmar
            titulo="Ativar a IA real?"
            texto="O agente passa a chamar o Skyone em cada mensagem recebida. As respostas ainda não são enviadas aos clientes."
            acao="Ativar IA real"
            disabled={ocupado}
            onConfirmar={() => modo.mutate("live")}
          />
        ) : (
          <p className="text-sm text-ink-500">
            Disponível depois de um teste de conexão com sucesso.
          </p>
        )}
      </Passo>
    </div>
  );
}

function Passo({
  numero,
  titulo,
  descricao,
  feito,
  children,
}: {
  numero: number;
  titulo: string;
  descricao: string;
  feito: boolean;
  children: React.ReactNode;
}) {
  return (
    <Cartao className="p-6">
      <div className="flex items-start gap-4">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
            feito ? "bg-success text-success-foreground" : "bg-purple-100 text-purple-800"
          }`}
          aria-hidden
        >
          {feito ? <CheckCircle2 className="size-4" /> : numero}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-purple-800">
            <span className="sr-only">Passo {numero}: </span>
            {titulo}
          </h2>
          <Ajuda>{descricao}</Ajuda>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </Cartao>
  );
}

function Confirmar({
  titulo,
  texto,
  acao,
  variante = "default",
  disabled,
  onConfirmar,
}: {
  titulo: string;
  texto: string;
  acao: string;
  variante?: "default" | "outline";
  disabled?: boolean;
  onConfirmar: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variante} disabled={disabled}>
          {acao}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{texto}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmar}>{acao}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Configurado() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-normal text-success">
      configurado <CheckCircle2 className="size-3.5" aria-label="✓" />
    </span>
  );
}
