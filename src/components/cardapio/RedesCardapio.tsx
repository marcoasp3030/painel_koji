/** Ícones, rodapé e CTA de Instagram no cardápio do cliente (CARD-REDES). */
import { Facebook, Instagram, Phone } from "lucide-react";
import {
  ariaDaRede,
  ROTULO_TIPO_REDE,
  type RedePublica,
  type TipoRede,
} from "@/lib/cardapio-redes";

const ICONE: Record<TipoRede, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  telefone: Phone,
};

function linkProps(rede: RedePublica) {
  if (rede.tipo === "telefone") {
    return { href: rede.url, target: undefined, rel: undefined };
  }
  return { href: rede.url, target: "_blank", rel: "noopener noreferrer" };
}

/** Ícones redondos abaixo do slogan, nas cores do tema. */
export function IconesRedes({
  redes,
  empresa,
}: {
  redes: readonly RedePublica[];
  empresa: string;
}) {
  if (!redes.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label="Redes e contato">
      {redes.map((rede) => {
        const Icone = ICONE[rede.tipo];
        const props = linkProps(rede);
        return (
          <li key={rede.tipo}>
            <a
              {...props}
              aria-label={ariaDaRede(rede.tipo, empresa)}
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-current ring-1 ring-white/25 transition-colors hover:bg-white/25"
            >
              <Icone className="size-4" aria-hidden />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Bloco do rodapé com rótulo ao lado de cada ícone. */
export function RodapeRedes({
  redes,
  empresa,
}: {
  redes: readonly RedePublica[];
  empresa: string;
}) {
  if (!redes.length) return null;
  return (
    <section aria-label="Siga a gente" className="mx-auto mt-10 max-w-3xl px-4 pb-6">
      <p className="font-display text-lg text-[var(--cd-marca)]">Siga a gente</p>
      <ul className="mt-3 grid gap-2">
        {redes.map((rede) => {
          const Icone = ICONE[rede.tipo];
          const props = linkProps(rede);
          return (
            <li key={rede.tipo}>
              <a
                {...props}
                aria-label={ariaDaRede(rede.tipo, empresa)}
                className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 text-sm font-medium text-ink-900 shadow-[0_1px_3px_rgba(26,21,32,0.07)] ring-1 ring-base-200"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[var(--cd-marca)]">
                  <Icone className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-normal text-ink-500">
                    {ROTULO_TIPO_REDE[rede.tipo]}
                  </span>
                  <span className="block truncate">{rede.rotulo}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Só com Instagram ativo: na tela de pedido enviado / link já usado. */
export function CtaInstagramPedido({
  instagram,
  empresa,
}: {
  instagram: RedePublica;
  empresa: string;
}) {
  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-ink-700">Enquanto preparamos, siga a gente no Instagram</p>
      <a
        href={instagram.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaDaRede("instagram", empresa)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--cd-marca)] px-5 text-sm font-semibold text-[var(--cd-sobre)] shadow-sm"
      >
        <Instagram className="size-4" aria-hidden />
        Instagram
      </a>
    </div>
  );
}
