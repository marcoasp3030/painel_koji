/** Último passo do link da loja: o cliente envia o código pelo WhatsApp e a página avança sozinha quando o pedido chega. */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, MessageCircle, TriangleAlert } from "lucide-react";
import { reais, textoRecusa } from "@/lib/cardapio";

export type Finalizacao = { codigo: string; whatsapp_url: string };
export type SituacaoFinalizacao =
  | { estado: "aguardando" }
  | { estado: "recebido"; numero: string; total: number }
  | { estado: "recusado"; motivo: string }
  | { estado: "expirado" };

const INTERVALO_MS = 3000;

function Passo({
  estado,
  titulo,
  ajuda,
  ultimo,
}: {
  estado: "feito" | "agora" | "depois";
  titulo: string;
  ajuda: string;
  ultimo?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {ultimo ? null : (
        <span
          aria-hidden
          className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${
            estado === "feito" ? "bg-[#25d366]" : "bg-base-200"
          }`}
        />
      )}
      <span className="relative flex size-8 shrink-0 items-center justify-center">
        {estado === "agora" ? (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#25d366]/40 motion-safe:animate-ping"
          />
        ) : null}
        <span
          className={`relative flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
            estado === "depois" ? "bg-base-200 text-ink-500" : "bg-[#25d366] text-[#0b3d20]"
          }`}
        >
          {estado === "feito" ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
          {estado === "agora" ? <MessageCircle className="size-4" aria-hidden /> : null}
        </span>
      </span>
      <span className="min-w-0 pt-0.5">
        <span
          className={`block text-base font-semibold ${
            estado === "depois" ? "text-ink-500" : "text-ink-900"
          }`}
        >
          {titulo}
        </span>
        <span className="block text-sm text-ink-500">{ajuda}</span>
      </span>
    </li>
  );
}

export function FinalizarWhatsapp({
  finalizacao,
  total,
  consultar,
  concluir,
  voltar,
}: {
  finalizacao: Finalizacao;
  total: number;
  consultar: (codigo: string) => Promise<SituacaoFinalizacao | null>;
  concluir: (numero: string, total: number) => void;
  voltar: () => void;
}) {
  const { codigo, whatsapp_url } = finalizacao;
  const [abriu, setAbriu] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const concluirAgora = useRef(concluir);
  concluirAgora.current = concluir;

  useEffect(() => {
    if (problema) return;
    let vivo = true;
    async function olhar() {
      const s = await consultar(codigo).catch(() => null);
      if (!vivo || !s) return;
      if (s.estado === "recebido") concluirAgora.current(s.numero, s.total);
      else if (s.estado === "expirado") setProblema(textoRecusa("codigo_expirado"));
      else if (s.estado === "recusado") setProblema(textoRecusa(s.motivo));
    }
    const relogio = window.setInterval(() => void olhar(), INTERVALO_MS);
    // Ao voltar do WhatsApp, a resposta não espera a próxima volta do relógio.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void olhar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [codigo, consultar, problema]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-base-100 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
      <div className="flex items-center gap-2 border-b border-base-200 bg-card px-2 py-2">
        <button
          type="button"
          onClick={voltar}
          aria-label="Voltar ao pedido"
          className="flex size-11 items-center justify-center rounded-full text-ink-700 active:bg-base-200"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <p className="text-base font-semibold text-ink-900">Finalizar pedido</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {problema ? (
          <div
            role="alert"
            className="rounded-2xl bg-card p-5 text-center shadow-[0_1px_3px_rgba(26,21,32,0.07)]"
          >
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-amber-100">
              <TriangleAlert className="size-6 text-amber-800" aria-hidden />
            </span>
            <p className="text-base font-semibold text-ink-900">
              Seu pedido ainda não foi finalizado
            </p>
            <p className="mt-1 text-sm text-ink-500">{problema}</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(26,21,32,0.07)]">
              <p className="text-sm text-ink-500">Total do pedido</p>
              <p className="font-display text-3xl tabular-nums text-ink-900">{reais(total)}</p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-base-100 px-3 py-1 text-sm text-ink-700">
                Código
                <span className="font-semibold tracking-widest tabular-nums">#{codigo}</span>
              </p>
            </div>
            <ol
              aria-label="Etapas do envio"
              className="mt-3 rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(26,21,32,0.07)]"
            >
              <Passo estado="feito" titulo="Pedido conferido" ajuda="Itens, taxa e pagamento ok." />
              <Passo
                estado="agora"
                titulo="Envie a mensagem no WhatsApp"
                ajuda="Ela já vem pronta. É só tocar em enviar."
              />
              <Passo
                estado="depois"
                titulo="A loja recebe seu pedido"
                ajuda="Esta página avança sozinha."
                ultimo
              />
            </ol>
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-base-200 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {problema ? (
          <button
            type="button"
            onClick={voltar}
            className="flex h-13 min-h-12 w-full items-center justify-center rounded-2xl bg-purple-800 px-4 text-base font-semibold text-[var(--cd-sobre)]"
          >
            Voltar ao pedido
          </button>
        ) : (
          <>
            {/* Link, e não abertura por código: o navegador do celular bloqueia janela aberta depois de esperar uma resposta. */}
            <a
              href={whatsapp_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => setAbriu(true)}
              className="flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-4 text-base font-semibold text-[#0b3d20] transition-transform active:scale-[0.98]"
            >
              <MessageCircle className="size-5" aria-hidden />
              {abriu ? "Abrir o WhatsApp de novo" : "Abrir o WhatsApp"}
            </a>
            <p
              aria-live="polite"
              className="flex min-h-5 items-center justify-center gap-2 text-center text-sm text-ink-500"
            >
              {abriu ? (
                <>
                  <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
                  Aguardando sua mensagem…
                </>
              ) : (
                "Seu número fica confirmado, sem criar conta."
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
