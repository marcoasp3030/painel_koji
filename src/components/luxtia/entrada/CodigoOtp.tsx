import { useRef } from "react";
import { Label } from "@/components/ui/label";

/** Seis campos numéricos com colar do código inteiro e avanço automático. */
export function CodigoOtp({
  valor,
  onChange,
  disabled,
  id = "otp",
}: {
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const digitos = Array.from({ length: 6 }, (_, i) => valor[i] ?? "");
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function aplicar(texto: string, inicio = 0) {
    const limpo = texto.replace(/\D/g, "").slice(0, 6);
    const arr = digitos.slice();
    for (let i = 0; i < limpo.length; i++) arr[inicio + i] = limpo[i]!;
    const novo = arr.join("").replace(/\s/g, "").slice(0, 6);
    onChange(novo);
    const prox = Math.min(inicio + limpo.length, 5);
    refs.current[prox]?.focus();
  }

  return (
    <div className="space-y-2">
      <Label id={`${id}-label`}>Código de 6 dígitos</Label>
      <div className="flex gap-2" role="group" aria-labelledby={`${id}-label`}>
        {digitos.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={i === 0 ? id : undefined}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={d}
            disabled={disabled}
            aria-label={`Dígito ${i + 1}`}
            className="h-12 w-11 rounded-lg border border-base-200 bg-base-50 text-center text-lg font-semibold tabular-nums text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 disabled:opacity-50"
            onChange={(e) => {
              const t = e.target.value;
              if (t.length > 1) {
                aplicar(t, i);
                return;
              }
              const arr = digitos.slice();
              arr[i] = t.replace(/\D/g, "").slice(-1);
              onChange(arr.join(""));
              if (t && i < 5) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digitos[i] && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              aplicar(e.clipboardData.getData("text"), 0);
            }}
          />
        ))}
      </div>
    </div>
  );
}
