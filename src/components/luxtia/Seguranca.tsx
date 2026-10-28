/** Ativação do aplicativo autenticador. O código é confirmado no navegador. */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FaixaSeguranca({
  prazo,
  bloqueado,
}: {
  prazo: string | null;
  bloqueado: boolean;
}) {
  const quando = prazo
    ? new Date(prazo).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : null;
  return (
    <p
      role="status"
      className={`border-b px-4 py-2 text-sm ${bloqueado ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-950"}`}
    >
      {bloqueado
        ? prazo
          ? "A segunda etapa é obrigatória para a plataforma. Ative o aplicativo autenticador para continuar."
          : "Esta conta de emergência exige a segunda etapa antes de continuar."
        : `Ative a segunda etapa até ${quando ?? "o prazo"} (horário de Brasília).`}
    </p>
  );
}

export function AtivarSegundaEtapa({ onPronta }: { onPronta: () => void }) {
  const [fator, setFator] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function comecar() {
    setOcupado(true);
    setErro(null);
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

  async function confirmar() {
    if (!fator) return;
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
    setOcupado(false);
    if (ver.error) {
      setErro("Código não conferiu. Tente o próximo do aplicativo.");
      return;
    }
    onPronta();
  }

  return (
    <section className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="font-display text-3xl text-purple-900">Segunda etapa</h1>
      <p className="text-sm text-ink-500">
        Use um aplicativo autenticador neste aparelho. Outra pessoa não ativa no seu lugar.
      </p>
      {!fator ? (
        <Button onClick={() => void comecar()} disabled={ocupado}>
          Gerar código
        </Button>
      ) : (
        <div className="space-y-3">
          <img src={fator.qr} alt="Código QR para o aplicativo autenticador" className="h-40 w-40" />
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
          <Button onClick={() => void confirmar()} disabled={ocupado || codigo.trim().length < 6}>
            Confirmar
          </Button>
        </div>
      )}
      {erro ? (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
