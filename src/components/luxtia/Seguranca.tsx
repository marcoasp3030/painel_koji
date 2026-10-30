/** Ativação do aplicativo autenticador e códigos de recuperação (MFA1). */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { gerarCodigosRecuperacao } from "@/lib/acesso/codigos-recuperacao";
import {
  guardarCodigosRecuperacao,
  regenerarCodigosRecuperacao,
} from "@/lib/seguranca.functions";
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

async function confirmarTotp(factorId: string, codigo: string) {
  const desafio = await supabase.auth.mfa.challenge({ factorId });
  if (desafio.error || !desafio.data) {
    return { ok: false as const, erro: desafio.error?.message ?? "Não foi possível validar o código." };
  }
  const ver = await supabase.auth.mfa.verify({
    factorId,
    challengeId: desafio.data.id,
    code: codigo.replace(/\s/g, ""),
  });
  if (ver.error) return { ok: false as const, erro: "Código não conferiu. Tente o próximo do aplicativo." };
  return { ok: true as const };
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
  const regenerar = useServerFn(regenerarCodigosRecuperacao);
  const [fator, setFator] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [existente, setExistente] = useState<{ id: string; nome: string }[] | null>(null);
  const [modo, setModo] = useState<"enroll" | "codigos" | null>(null);
  const [codigo, setCodigo] = useState("");
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const iniciado = useRef(false);

  useEffect(() => {
    let vivo = true;
    void supabase.auth.mfa.listFactors().then((lista) => {
      if (!vivo) return;
      const totp = (lista.data?.totp ?? []).filter((f) => f.status === "verified");
      setExistente(totp.map((f) => ({ id: f.id, nome: f.friendly_name || "Aplicativo" })));
      if (automatico && !iniciado.current) {
        iniciado.current = true;
        if (totp.length === 0) void comecar();
        else setModo("codigos");
      }
    });
    return () => {
      vivo = false;
    };
  }, [automatico]);

  async function comecar() {
    setOcupado(true);
    setErro(null);
    setModo("enroll");
    const lista = await supabase.auth.mfa.listFactors();
    for (const item of lista.data?.all ?? []) {
      if (item.factor_type === "totp" && item.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: item.id });
      }
    }
    const verificado = (lista.data?.totp ?? []).filter((f) => f.status === "verified").length;
    if (verificado >= 2) {
      setOcupado(false);
      setErro("Esta conta já tem 2 aplicativos. Remova um antes de adicionar outro.");
      return;
    }
    const nome = verificado === 0 ? "Luxtia" : `Luxtia ${verificado + 1}`;
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: nome,
    });
    setOcupado(false);
    if (error || !data) {
      setErro(error?.message ?? "Não foi possível começar a ativação.");
      return;
    }
    setFator({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
  }

  async function confirmarEnroll() {
    if (!fator || codigos) return;
    setOcupado(true);
    setErro(null);
    const r = await confirmarTotp(fator.id, codigo);
    if (!r.ok) {
      setOcupado(false);
      setErro(r.erro);
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

  async function confirmarCodigos() {
    if (!existente?.length || codigos) return;
    setOcupado(true);
    setErro(null);
    const r = await confirmarTotp(existente[0]!.id, codigo);
    if (!r.ok) {
      setOcupado(false);
      setErro(r.erro);
      return;
    }
    const novos = gerarCodigosRecuperacao();
    try {
      await regenerar({ data: { codigos: novos } });
    } catch {
      setOcupado(false);
      setErro("Não foi possível guardar os códigos. Tente de novo.");
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
            Guarde estes 10 códigos. Cada um serve uma vez se você perder o aplicativo. Usar um
            código não remove o autenticador — só libera esta entrada. Regenere em Segurança quando
            restarem poucos.
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
      ) : modo === "codigos" && existente && existente.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-500">
            Aplicativo ativo: {existente.map((e) => e.nome).join(", ")}. Confirme o código de 6
            dígitos para gerar 10 códigos de recuperação (os anteriores, se houver, deixam de
            valer).
          </p>
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
            onClick={() => void confirmarCodigos()}
            disabled={ocupado || codigo.trim().length < 6}
          >
            {ocupado ? "Gerando…" : "Gerar códigos de recuperação"}
          </Button>
          {(existente.length < 2) && (
            <button type="button" className="block text-sm underline" onClick={() => void comecar()}>
              Adicionar outro aplicativo
            </button>
          )}
        </div>
      ) : modo === "enroll" || fator ? (
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
                onClick={() => void confirmarEnroll()}
                disabled={ocupado || codigo.trim().length < 6}
              >
                {ocupado ? "Confirmando…" : "Confirmar"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-500">
            {existente && existente.length > 0
              ? "Gerencie o aplicativo ou os códigos de recuperação."
              : "Use um aplicativo autenticador neste aparelho."}
          </p>
          {existente && existente.length > 0 ? (
            <Button onClick={() => setModo("codigos")}>Códigos de recuperação</Button>
          ) : (
            <Button onClick={() => void comecar()} disabled={ocupado}>
              {ocupado ? "Gerando…" : "Gerar código"}
            </Button>
          )}
          {existente && existente.length > 0 && existente.length < 2 ? (
            <Button variant="outline" onClick={() => void comecar()} disabled={ocupado}>
              Adicionar outro aplicativo
            </Button>
          ) : null}
        </div>
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
