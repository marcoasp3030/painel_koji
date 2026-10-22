/** Campos de data (dd/mm/aaaa) e hora (24h) que não seguem o idioma do navegador. */
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { horaDigitada } from "@/lib/gateway/cardapio-ux";
import { dataBrParaIso, isoParaDataBr, mascaraData } from "@/lib/data-hora";
import { cn } from "@/lib/utils";

export function CampoData({
  id,
  valor,
  onChange,
  disabled,
  className,
  rotulo,
}: {
  id?: string;
  /** AAAA-MM-DD, ou vazio. */
  valor: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  className?: string;
  rotulo?: string;
}) {
  const [texto, setTexto] = useState(() => isoParaDataBr(valor));
  useEffect(() => setTexto(isoParaDataBr(valor)), [valor]);
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      maxLength={10}
      lang="pt-BR"
      className={cn("w-40 tabular-nums", className)}
      aria-label={rotulo}
      disabled={disabled}
      value={texto}
      onChange={(e) => {
        const mascarado = mascaraData(e.target.value);
        setTexto(mascarado);
        if (!mascarado) onChange("");
        else {
          const iso = dataBrParaIso(mascarado);
          if (iso) onChange(iso);
        }
      }}
    />
  );
}

export function CampoHora({
  id,
  valor,
  onChange,
  disabled,
  className,
  rotulo,
}: {
  id?: string;
  /** HH:mm, 24 horas. */
  valor: string;
  onChange: (hora: string) => void;
  disabled?: boolean;
  className?: string;
  rotulo?: string;
}) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="00:00"
      maxLength={5}
      lang="pt-BR"
      className={cn("w-32 tabular-nums", className)}
      aria-label={rotulo}
      disabled={disabled}
      value={valor}
      onChange={(e) => onChange(horaDigitada(e.target.value))}
    />
  );
}
