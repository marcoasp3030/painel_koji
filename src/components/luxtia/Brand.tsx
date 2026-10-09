export function LuxtiaWordmark({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span
      className={`font-display text-xl tracking-[0.22em] ${
        tone === "light" ? "text-base-50" : "text-purple-800"
      }`}
    >
      LUX<span className={tone === "light" ? "text-gold-500" : "text-gold-700"}>TIA</span>
    </span>
  );
}

export function GoldRule({ className = "" }: { className?: string }) {
  return <div className={`h-px w-12 bg-gold-500 ${className}`} />;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">{children}</p>;
}
