import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CampoSenha({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  required,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
}) {
  const [ver, setVer] = useState(false);
  const [caps, setCaps] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={ver ? "text" : "password"}
          value={value}
          disabled={disabled}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="bg-base-50 pr-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700"
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
          onKeyDown={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-500 hover:bg-base-100 hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-purple-700"
          aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setVer((v) => !v)}
          tabIndex={-1}
        >
          {ver ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {caps ? (
        <p role="status" className="text-xs text-amber-800">
          Caps Lock ligado
        </p>
      ) : null}
    </div>
  );
}
