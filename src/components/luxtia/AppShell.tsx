import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Building2,
  ClipboardList,
  Factory,
  KeyRound,
  LogOut,
  MessagesSquare,
  RadioTower,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { obterAcessoGateway } from "@/lib/gateway.functions";
import { agruparMenu, filtrarMenu, type IconeMenu, type ItemMenu } from "@/lib/nav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LuxtiaWordmark } from "./Brand";
import { ContadorPedidos } from "./ContadorPedidos";

const ICONES: Record<IconeMenu, LucideIcon> = {
  clientes: Building2,
  equipe: Users,
  empresas: Factory,
  agentes: Bot,
  canais: RadioTower,
  chaves: KeyRound,
  simular: MessagesSquare,
  conversas: MessagesSquare,
  pedidos: ClipboardList,
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
  const [recolhido, setRecolhido] = useState(false);
  const textoMenu = recolhido ? "lg:hidden" : "";

  useEffect(() => {
    try {
      setRecolhido(localStorage.getItem("luxtia:menu-recolhido") === "true");
    } catch {
      /* O menu continua funcionando sem armazenamento local. */
    }
  }, []);

  function alternarMenu() {
    const proximo = !recolhido;
    setRecolhido(proximo);
    try {
      localStorage.setItem("luxtia:menu-recolhido", String(proximo));
    } catch {
      /* A preferência vale durante esta sessão. */
    }
  }

  useEffect(() => {
    if (!menuAberto) return;
    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuAberto(false);
    }
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [menuAberto]);

  const buscarAcesso = useServerFn(obterAcessoGateway);
  const acesso = useQuery({
    queryKey: ["gateway", "acesso"],
    queryFn: () => buscarAcesso(),
    staleTime: 60_000,
    retry: false,
  });
  const itens = filtrarMenu(nav, acesso.data?.papel);
  const grupos = agruparMenu(itens);
  const atual = itens.find((item) => itemAtivo(pathname, item.to));

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
    <TooltipProvider delayDuration={150}>
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
          id="menu-lateral"
          className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-purple-700/50 bg-purple-800 transition-[width,transform] duration-200 motion-reduce:transition-none ${recolhido ? "lg:w-[72px]" : "lg:w-60"} lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
            menuAberto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div
            className={`flex h-20 items-center justify-between gap-3 px-4 ${recolhido ? "lg:justify-center lg:px-0" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-900 font-display text-lg text-gold-500">
                L
              </span>
              <div className={textoMenu}>
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
          <div className="mx-4 h-px bg-gold-500/40" />

          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu principal">
            {grupos.map((grupo) => (
              <div key={grupo.nome} className="mb-5">
                <p
                  className={`px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-purple-300 ${textoMenu}`}
                >
                  {grupo.nome}
                </p>
                <ul className="space-y-1">
                  {grupo.itens.map((item) => {
                    const ativo = itemAtivo(pathname, item.to);
                    const Icone = ICONES[item.icone];
                    return (
                      <li key={item.to}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              to={item.to}
                              aria-label={item.label}
                              aria-current={ativo ? "page" : undefined}
                              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 ${recolhido ? "lg:justify-center lg:px-0" : ""} ${
                                ativo
                                  ? "bg-purple-700 text-base-50 shadow-[inset_3px_0_0_0_var(--gold-500)]"
                                  : "text-purple-200 hover:bg-purple-700/60 hover:text-base-50"
                              }`}
                            >
                              <Icone className="size-4 shrink-0" aria-hidden />
                              <span className={textoMenu}>{item.label}</span>
                              {item.to === "/ia/pedidos" ? (
                                <ContadorPedidos papel={acesso.data?.papel} />
                              ) : null}
                            </Link>
                          </TooltipTrigger>
                          {recolhido && (
                            <TooltipContent side="right" className="hidden lg:block">
                              {item.label}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="space-y-1 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={alternarMenu}
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
              aria-expanded={!recolhido}
              aria-controls="menu-lateral"
              title={recolhido ? "Expandir menu" : "Recolher menu"}
              className={`hidden w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-purple-200 transition-colors hover:bg-purple-700 hover:text-base-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 lg:flex ${recolhido ? "justify-center px-0" : ""}`}
            >
              {recolhido ? (
                <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
              ) : (
                <PanelLeftClose className="size-4 shrink-0" aria-hidden />
              )}
              <span className={textoMenu}>Recolher menu</span>
            </button>
            <button
              type="button"
              onClick={sair}
              aria-label="Sair"
              title="Sair"
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-purple-200 transition-colors hover:bg-purple-700 hover:text-base-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 ${recolhido ? "lg:justify-center lg:px-0" : ""}`}
            >
              <LogOut className="size-4" aria-hidden />
              <span className={textoMenu}>Sair</span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-base-200 bg-base-50/90 h-14 px-4 backdrop-blur sm:px-6">
            <button
              type="button"
              className="rounded-lg border border-base-200 bg-card p-2 text-purple-800 lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto(true)}
            >
              <Menu className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={alternarMenu}
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
              title={recolhido ? "Expandir menu" : "Recolher menu"}
              aria-expanded={!recolhido}
              aria-controls="menu-lateral"
              className="hidden rounded-lg p-2 text-ink-500 transition-colors hover:bg-purple-100 hover:text-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:block"
            >
              {recolhido ? (
                <PanelLeftOpen className="size-5" aria-hidden />
              ) : (
                <PanelLeftClose className="size-5" aria-hidden />
              )}
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <p className="truncate text-[11px] uppercase tracking-[0.16em] text-ink-500">
                {context}
              </p>
              <span className="text-ink-300" aria-hidden>
                /
              </span>
              <p className="truncate text-sm font-medium text-ink-900">
                {atual?.label ?? "Painel"}
              </p>
            </div>
          </header>
          <main className="w-full min-w-0 flex-1 px-4 py-5 sm:px-6 lg:py-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
