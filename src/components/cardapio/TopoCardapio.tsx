/** Topo da página do cliente. Fica à parte para a tela de aparência mostrar exatamente o mesmo. */
import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

export type InfoLoja = { icone: LucideIcon; titulo: string; valor: string };

export function MarcaLoja({ nome, logoUrl }: { nome: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${nome}`}
        className="size-16 shrink-0 rounded-2xl bg-white object-contain p-1 shadow-md"
      />
    );
  }
  return (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-display text-2xl text-[var(--cd-destaque)] ring-1 ring-white/20">
      {nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Faixa do topo, com banner ou na cor da marca. Toda tela de entrada do cardápio usa esta mesma capa. */
export function CapaLoja({
  bannerUrl,
  bannerFoco,
  children,
}: {
  bannerUrl: string | null;
  bannerFoco: number;
  children: ReactNode;
}) {
  // Sobre foto, o texto é sempre branco com véu escuro; sobre a cor, segue o contraste calculado.
  const corTexto = bannerUrl ? "text-white" : "text-[var(--cd-sobre)]";
  return (
    <header
      className={`relative overflow-hidden bg-gradient-to-br from-purple-900 via-purple-800 to-purple-600 px-4 ${bannerUrl ? "flex min-h-56 flex-col justify-end pb-12 pt-16 md:min-h-80" : "pb-12 pt-5"} ${corTexto}`}
    >
      {bannerUrl ? (
        <>
          <img
            src={bannerUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={{ objectPosition: `50% ${bannerFoco}%` }}
          />
          <span
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10"
            aria-hidden
          />
        </>
      ) : null}
      {children}
    </header>
  );
}

export function TopoCardapio({
  nome,
  slogan,
  unidade,
  aberta,
  podeTrocar,
  trocar,
  logoUrl,
  bannerUrl,
  bannerFoco,
  infos,
}: {
  nome: string;
  slogan: string | null;
  unidade: string;
  aberta: boolean | null;
  podeTrocar: boolean;
  trocar?: () => void;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerFoco: number;
  infos: InfoLoja[];
}) {
  return (
    <>
      <CapaLoja bannerUrl={bannerUrl} bannerFoco={bannerFoco}>
        <div className="relative mx-auto flex w-full max-w-3xl items-center gap-3">
          <MarcaLoja nome={nome} logoUrl={logoUrl} />
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 font-display text-2xl leading-tight">{nome}</h1>
            {slogan ? <p className="line-clamp-2 text-sm opacity-90">{slogan}</p> : null}
            <button
              type="button"
              disabled={!podeTrocar}
              onClick={trocar}
              className="mt-0.5 flex max-w-full items-center gap-1 text-sm opacity-80"
            >
              <span className="truncate">{unidade}</span>
              {podeTrocar ? <ChevronDown className="size-4 shrink-0" aria-hidden /> : null}
            </button>
          </div>
          <span
            className={`flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-medium ${bannerUrl ? "bg-black/40 text-white" : "bg-white/15"}`}
          >
            <span
              className={`size-1.5 rounded-full ${aberta === false ? "bg-amber-400" : "bg-emerald-400"}`}
              aria-hidden
            />
            {aberta === false ? "Fechada" : "Aberta"}
          </span>
        </div>
      </CapaLoja>

      {infos.length ? (
        <div className="relative z-10 mx-auto -mt-8 max-w-3xl px-4">
          <ul
            className="grid divide-x divide-base-200 rounded-2xl bg-card py-3 shadow-[0_6px_20px_rgba(26,21,32,0.1)]"
            style={{ gridTemplateColumns: `repeat(${infos.length}, minmax(0, 1fr))` }}
          >
            {infos.map(({ icone: Icone, titulo, valor }) => (
              <li key={titulo} className="min-w-0 px-2 text-center">
                <Icone className="mx-auto size-4 text-[var(--cd-marca)]" aria-hidden />
                <p className="mt-1 truncate text-xs text-ink-500">{titulo}</p>
                <p className="truncate text-sm font-semibold tabular-nums text-ink-900">{valor}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
