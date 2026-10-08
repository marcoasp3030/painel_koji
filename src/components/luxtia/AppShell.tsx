import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut, Menu, Users, X, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { agruparMenu, type IconeMenu, type ItemMenu } from "@/lib/nav";
import { LuxtiaWordmark } from "./Brand";

const ICONES: Record<IconeMenu, LucideIcon> = {
  clientes: Building2,
  equipe: Users,
};

function itemAtivo(caminho: string, destino: string) {
  return caminho === destino || caminho.startsWith(`${destino}/`);
}

export function AppShell({
  nav,
  context,
  children,
}: {
  nav: ItemMenu[];
  context: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuAberto, setMenuAberto] = useState(false);
  const grupos = agruparMenu(nav);
  const atual = nav.find((item) => itemAtivo(pathname, item.to));

  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-base-100 lg:flex">
      {menuAberto ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-purple-900/45 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-purple-800 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-purple-900 font-display text-lg text-gold-500">
              L
            </span>
            <div>
              <LuxtiaWordmark />
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-purple-300">
                {context}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-purple-200 hover:bg-purple-700 lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="mx-5 h-px bg-gold-500/80" />

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Menu principal">
          {grupos.map((grupo) => (
            <div key={grupo.nome} className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-purple-400">
                {grupo.nome}
              </p>
              <ul className="space-y-1">
                {grupo.itens.map((item) => {
                  const ativo = itemAtivo(pathname, item.to);
                  const Icone = ICONES[item.icone];
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        aria-current={ativo ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          ativo
                            ? "bg-purple-700 text-base-50 shadow-[inset_3px_0_0_0_var(--gold-500)]"
                            : "text-purple-200 hover:bg-purple-700/60 hover:text-base-50"
                        }`}
                      >
                        <Icone className="size-4 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={sair}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-purple-200 transition-colors hover:bg-purple-700 hover:text-base-50"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-base-200 bg-base-50/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            className="rounded-lg border border-base-200 bg-card p-2 text-purple-800 lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto(true)}
          >
            <Menu className="size-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] uppercase tracking-[0.16em] text-ink-500">{context}</p>
            <p className="truncate text-sm font-medium text-ink-900">{atual?.label ?? "Painel"}</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 overflow-x-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
