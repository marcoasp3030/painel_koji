import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BellRing,
  Bot,
  Building2,
  ClipboardList,
  Factory,
  FileKey2,
  FileText,
  FlaskConical,
  History,
  KeyRound,
  Layers,
  Webhook,
  LogOut,
  MessagesSquare,
  RadioTower,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Settings,
  SlidersHorizontal,
  Store,
  Users,
  UtensilsCrossed,
  X,
  type LucideIcon,
  Gauge,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { obterAcessoGateway } from "@/lib/gateway.functions";
import { estadoSeguranca } from "@/lib/seguranca.functions";
import { AtivarSegundaEtapa, FaixaSeguranca } from "./Seguranca";
import { obterModulosEmpresa } from "@/lib/gateway-modulos.functions";
import {
  agruparMenu,
  filtrarMenu,
  filtrarMenuPorTelas,
  type IconeMenu,
  type ItemMenu,
} from "@/lib/nav";
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
  documentos: FileText,
  webhooks: Webhook,
  simular: FlaskConical,
  conversas: MessagesSquare,
  pedidos: ClipboardList,
  operacao: Gauge,
  modelos: Layers,
  configuracoes: Settings,
  unidades: Store,
  cardapio: UtensilsCrossed,
  avisos: BellRing,
  historico: History,
  comportamento: SlidersHorizontal,
  formulario: FileKey2,
  aparencia: Palette,
};

const CHAVE_EMPRESA = "luxtia:gateway-empresa";

function itemAtivo(caminho: string, destino: string) {
  return caminho === destino || caminho.startsWith(`${destino}/`);
}

export function AppShell({
  nav,
  context,
  telaCheia = false,
  children,
}: {
  nav: ItemMenu[];
  context: string;
  /** A tela ocupa a altura da janela e cuida da própria rolagem. */
  telaCheia?: boolean;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuAberto, setMenuAberto] = useState(false);
  const [segurancaAberta, setSegurancaAberta] = useState(false);
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
  const buscarSeguranca = useServerFn(estadoSeguranca);
  const seguranca = useQuery({
    queryKey: ["seguranca"],
    queryFn: () => buscarSeguranca(),
    staleTime: 30_000,
    retry: false,
  });
  const buscarModulos = useServerFn(obterModulosEmpresa);
  const acesso = useQuery({
    queryKey: ["gateway", "acesso"],
    queryFn: () => buscarAcesso(),
    staleTime: 60_000,
    retry: false,
  });
  const plataforma = acesso.data?.papel === "plataforma";
  const [empresaMenu, setEmpresaMenu] = useState<string | null>(null);
  useEffect(() => {
    function ler() {
      try {
        setEmpresaMenu(localStorage.getItem(CHAVE_EMPRESA));
      } catch {
        setEmpresaMenu(null);
      }
    }
    ler();
    window.addEventListener("luxtia:empresa", ler);
    return () => window.removeEventListener("luxtia:empresa", ler);
  }, []);
  const modulos = useQuery({
    queryKey: ["gateway", "modulos-menu", plataforma ? empresaMenu : "sessao"],
    queryFn: () => buscarModulos({ data: { empresa: plataforma ? empresaMenu : null } }),
    enabled: Boolean(acesso.data?.papel) && (!plataforma || Boolean(empresaMenu)),
    staleTime: 30_000,
    retry: false,
  });
  // Super Admin: se o gateway não devolveu o papel (clone local, aal1, etc.),
  // assume "plataforma" para o menu não ficar só com Clientes.
  const papelMenu =
    acesso.data?.papel ?? (context === "Super Admin" ? ("plataforma" as const) : undefined);
  const itens = filtrarMenuPorTelas(
    acesso.isPending && papelMenu == null ? nav : filtrarMenu(nav, papelMenu),
    modulos.data?.telas ?? (modulos.isFetched ? [] : null),
  );
  const grupos = agruparMenu(itens);
  const atual = itens.find((item) => itemAtivo(pathname, item.to));

  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  // Em tela baixa, mantém visível o item da tela atual, inclusive quando a lista chega depois.
  const totalItens = itens.length;
  useEffect(() => {
    document
      .querySelector('#menu-lateral [aria-current="page"]')
      ?.scrollIntoView({ block: "center" });
  }, [pathname, totalItens]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  // Conta obrigada e bloqueada (emergência / prazo vencido): só o cadastro MFA.
  if (seguranca.data?.bloqueado) {
    return (
      <div className="min-h-screen bg-base-100">
        <FaixaSeguranca
          prazo={seguranca.data.prazo_ate}
          bloqueado
          onAtivar={() =>
            document
              .getElementById("cadastro-segunda-etapa")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
        <AtivarSegundaEtapa automatico onPronta={() => void seguranca.refetch()} />
        <div className="px-6 pb-8">
          <button type="button" className="text-sm underline" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={`bg-base-100 ${telaCheia ? "flex h-dvh flex-col overflow-hidden lg:flex-row" : "min-h-screen lg:flex"}`}
      >
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
            className={`flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 ${recolhido ? "lg:justify-center lg:px-0" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-900 font-display text-base text-gold-500">
                L
              </span>
              <div className={`min-w-0 leading-tight ${textoMenu}`}>
                <LuxtiaWordmark />
                <p className="truncate text-[10px] uppercase tracking-[0.14em] text-purple-300">
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

          <nav
            className="rolagem-menu min-h-0 flex-1 overflow-y-auto px-2 pb-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)]"
            aria-label="Menu principal"
          >
            {grupos.map((grupo, indice) => (
              <div key={grupo.nome}>
                {recolhido ? (
                  <div
                    className={`mx-3 my-2 hidden h-px bg-white/10 lg:block ${indice === 0 ? "lg:invisible" : ""}`}
                    aria-hidden
                  />
                ) : null}
                <p
                  className={`px-2.5 pb-1 pt-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-purple-300 ${textoMenu}`}
                >
                  {grupo.nome}
                </p>
                <ul className="space-y-px">
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
                              className={`relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-300 lg:h-[34px] ${recolhido ? "lg:justify-center lg:px-0" : ""} ${
                                ativo
                                  ? "bg-purple-700 font-medium text-base-50 shadow-[inset_3px_0_0_0_var(--gold-500)]"
                                  : "text-purple-200 hover:bg-purple-700/60 hover:text-base-50"
                              }`}
                            >
                              <Icone className="size-4 shrink-0" aria-hidden />
                              <span className={`min-w-0 flex-1 truncate ${textoMenu}`}>
                                {item.label}
                              </span>
                              {item.to === "/ia/pedidos" ? (
                                <span
                                  className={
                                    recolhido
                                      ? "contents lg:absolute lg:right-1 lg:top-0 lg:block lg:origin-top-right lg:scale-75"
                                      : "contents"
                                  }
                                >
                                  <ContadorPedidos papel={acesso.data?.papel} />
                                </span>
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

          <div className="shrink-0 border-t border-white/10 p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={sair}
                  aria-label="Sair"
                  className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-purple-200 transition-colors hover:bg-purple-700/60 hover:text-base-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-300 lg:h-[34px] ${recolhido ? "lg:justify-center lg:px-0" : ""}`}
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  <span className={textoMenu}>Sair</span>
                </button>
              </TooltipTrigger>
              {recolhido && (
                <TooltipContent side="right" className="hidden lg:block">
                  Sair
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-base-200 bg-base-50/90 h-14 shrink-0 px-4 backdrop-blur sm:px-6">
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
            <button
              type="button"
              className="rounded-lg border border-base-200 bg-card px-3 py-1.5 text-sm text-purple-800"
              onClick={() => setSegurancaAberta(true)}
            >
              Segurança
            </button>
          </header>
          {seguranca.data?.obrigatorio && seguranca.data.fatores === 0 ? (
            <FaixaSeguranca
              prazo={seguranca.data.prazo_ate}
              bloqueado={seguranca.data.bloqueado}
              onAtivar={() => setSegurancaAberta(true)}
            />
          ) : null}
          {seguranca.data &&
          seguranca.data.fatores > 0 &&
          (seguranca.data.codigos_restantes ?? 0) === 0 ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50 px-4 py-2 text-sm text-amber-950"
            >
              <p>
                O aplicativo está ativo, mas ainda não há códigos de recuperação. Gere-os em
                Segurança antes que a segunda etapa vire obrigatória para todos.
              </p>
              <button
                type="button"
                className="rounded-lg bg-purple-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-900"
                onClick={() => setSegurancaAberta(true)}
              >
                Segurança
              </button>
            </div>
          ) : null}
          <main
            className={
              telaCheia
                ? "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
                : "w-full min-w-0 flex-1 px-4 py-5 sm:px-6 lg:py-6"
            }
          >
            {seguranca.data?.bloqueado ? (
              <AtivarSegundaEtapa onPronta={() => void seguranca.refetch()} />
            ) : (
              children
            )}
          </main>
          {segurancaAberta ? (
            <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-6">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-segunda-etapa"
                className="my-auto w-full max-w-lg rounded-xl bg-card shadow-lg"
              >
                <AtivarSegundaEtapa
                  automatico
                  onPronta={() => {
                    setSegurancaAberta(false);
                    void seguranca.refetch();
                  }}
                  onFechar={() => setSegurancaAberta(false)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
