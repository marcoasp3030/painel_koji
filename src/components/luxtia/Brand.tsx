/** Marca Luxbrain: logo + wordmark. */

const LOGO = "/luxbrain-logo.jpeg";

export function LuxbrainLogo({
  className = "size-8",
  alt = "Luxbrain",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={LOGO}
      alt={alt}
      width={128}
      height={128}
      className={`rounded-lg object-cover ${className}`}
      decoding="async"
    />
  );
}

export function LuxbrainWordmark({
  tone = "light",
  comLogo = true,
}: {
  tone?: "light" | "dark";
  /** Inclui o símbolo ao lado do nome (padrão). */
  comLogo?: boolean;
}) {
  const texto = tone === "light" ? "text-base-50" : "text-purple-800";
  const destaque = tone === "light" ? "text-gold-500" : "text-gold-700";
  return (
    <span className={`inline-flex items-center gap-2.5 ${texto}`}>
      {comLogo ? <LuxbrainLogo className="size-8 shrink-0" /> : null}
      <span className="font-display text-xl tracking-[0.18em]">
        LUX<span className={destaque}>BRAIN</span>
      </span>
    </span>
  );
}

export function GoldRule({ className = "" }: { className?: string }) {
  return <div className={`h-px w-12 bg-gold-500 ${className}`} />;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">{children}</p>;
}
