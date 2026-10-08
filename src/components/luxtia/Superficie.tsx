/** Peças visuais compartilhadas do painel. Usam só a paleta Luxtia. */

export function CabecalhoPagina({
  sobretitulo,
  titulo,
  descricao,
}: {
  sobretitulo: string;
  titulo: string;
  descricao?: string;
}) {
  return (
    <header className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">{sobretitulo}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-purple-800">{titulo}</h1>
      {descricao ? <p className="mt-3 text-sm leading-relaxed text-ink-500">{descricao}</p> : null}
      <div className="mt-5 h-px w-12 bg-gold-500" />
    </header>
  );
}

export function Metrica({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
}) {
  return (
    <div className="rounded-xl border border-base-200 bg-card px-5 py-4 shadow-[0_1px_2px_rgba(26,21,32,0.04)]">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">{rotulo}</p>
      <p className="mt-2 font-display text-3xl text-purple-800">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-ink-500">{detalhe}</p> : null}
    </div>
  );
}

export function Cartao({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-base-200 bg-card shadow-[0_1px_2px_rgba(26,21,32,0.04),0_10px_28px_rgba(46,35,64,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function EstadoVazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-xl text-purple-800">{titulo}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">{texto}</p>
    </div>
  );
}

export function Iniciais({ nome }: { nome: string }) {
  const letras = nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-700">
      {letras || "·"}
    </span>
  );
}
