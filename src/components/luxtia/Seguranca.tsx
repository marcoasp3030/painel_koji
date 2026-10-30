/** Ativação do aplicativo autenticador. O código é confirmado no navegador.
 * Os códigos de recuperação aparecem uma vez, depois da confirmação. */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { gerarCodigosRecuperacao } from "@/lib/acesso/codigos-recuperacao";
import { guardarCodigosRecuperacao } from "@/lib/seguranca.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FaixaSeguranca({
  prazo,
  bloqueado,
  onAtivar,
}: {
  prazo: string | null;
  bloqueado: boolean;
  onAtivar: () => void;
}) {
  const quando = prazo
    ? new Date(prazo).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : null;
  const texto = bloqueado
    ? prazo
      ? "A segunda etapa é obrigatória para a plataforma. Ative o aplicativo autenticador para continuar."
      : "Esta conta de emergência exige a segunda etapa antes de continuar."
    : `Ative a segunda etapa até ${quando ?? "o prazo"} (horário de Brasília).`;
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm ${bloqueado ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-950"}`}
    >
      <p>{texto}</p>
      <button
        type="button"
        className="rounded-lg bg-purple-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-800"
        onClick={onAtivar}
      >
        Ativar agora
      </button>
    </div>
  );
}

export function AtivarSegundaEtapa({
  onPronta,
  onFechar,
  automatico = false,
}: {
  onPronta: () => void;
  onFechar?: () => void;
  /** Abre já no QR, sem o clique extra de gerar. */
  automatico?: boolean;
}) {
  const guardar = useServerFn(guardarCodigosRecuperacao);
  const [fator, setFator] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const iniciado = useRef(false);

  async function comecar() {
    setOcupado(true);
    setErro(null);
    const lista = await supabase.auth.mfa.listFactors();
    for (const item of lista.data?.all ?? []) {
      if (item.factor_type === "totp" && item.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: item.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Luxtia",
    });
    setOcupado(false);
    if (error || !data) {
      setErro(error?.message ?? "Não foi possível começar a ativação.");
      return;
    }
    setFator({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
  }

  useEffect(() => {
    if (!automatico || iniciado.current) return;
    iniciado.current = true;
    void comecar();
  }, [automatico]);

  async function confirmar() {
    if (!fator || codigos) return;
    setOcupado(true);
    setErro(null);
    const desafio = await supabase.auth.mfa.challenge({ factorId: fator.id });
    if (desafio.error || !desafio.data) {
      setOcupado(false);
      setErro(desafio.error?.message ?? "Não foi possível validar o código.");
      return;
    }
    const ver = await supabase.auth.mfa.verify({
      factorId: fator.id,
      challengeId: desafio.data.id,
      code: codigo.replace(/\s/g, ""),
    });
    if (ver.error) {
      setOcupado(false);
      setErro("Código não conferiu. Tente o próximo do aplicativo.");
      return;
    }
    const novos = gerarCodigosRecuperacao();
    try {
      await guardar({ data: { codigos: novos } });
    } catch {
      setOcupado(false);
      setErro(
        "O aplicativo foi ligado, mas os códigos de recuperação não foram guardados. Tente de novo.",
      );
      return;
    }
    setOcupado(false);
    setCodigos(novos);
  }

  async function copiar() {
    if (!codigos) return;
    try {
      await navigator.clipboard.writeText(codigos.join("\n"));
    } catch {
      setErro("Não foi possível copiar. Anote os códigos na tela.");
    }
  }

  return (
    <section id="cadastro-segunda-etapa" className="mx-auto max-w-md space-y-4 p-6">
      <h1 id="titulo-segunda-etapa" className="font-display text-3xl text-purple-900">
        Segunda etapa
      </h1>
      {codigos ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-500">
            Guarde estes códigos. Cada um serve uma vez, se você perder o aplicativo. Usar um código
            desliga a segunda etapa e pede para ativar de novo. A conta de plataforma continua
            obrigada a ter a segunda etapa.
          </p>
          <ul aria-label="Códigos de recuperação" className="grid grid-cols-2 gap-2">
            {codigos.map((item) => (
              <li key={item} className="rounded-md bg-base-100 px-2 py-1 font-mono text-sm">
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void copiar()}>
              Copiar códigos
            </Button>
            <Button type="button" onClick={onPronta}>
              Guardei os códigos
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-500">
            Use um aplicativo autenticador neste aparelho. Outra pessoa não ativa no seu lugar.
          </p>
          {!fator ? (
            <Button onClick={() => void comecar()} disabled={ocupado}>
              {ocupado ? "Gerando…" : "Gerar código"}
            </Button>
          ) : (
            <div className="space-y-3">
              <img
                src={fator.qr}
                alt="Código QR para o aplicativo autenticador"
                className="h-40 w-40"
              />
              <p className="break-all text-xs text-ink-500">Chave manual: {fator.segredo}</p>
              <label className="block text-sm font-medium">
                Código de 6 dígitos
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </label>
              <Button
                onClick={() => void confirmar()}
                disabled={ocupado || codigo.trim().length < 6}
              >
                {ocupado ? "Confirmando…" : "Confirmar"}
              </Button>
            </div>
          )}
        </>
      )}
      {erro ? (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      ) : null}
      {onFechar && !codigos ? (
        <button type="button" className="text-sm underline" onClick={onFechar}>
          Fechar
        </button>
      ) : null}
    </section>
  );
}
