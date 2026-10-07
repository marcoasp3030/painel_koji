import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LuxtiaWordmark } from "./Brand";

type NavItem = { to: string; label: string };

export function AppShell({
  nav,
  context,
  children,
}: {
  nav: NavItem[];
  context: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-base-50">
      <header className="bg-purple-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <LuxtiaWordmark />
            <span className="hidden h-4 w-px bg-purple-500 sm:block" />
            <span className="hidden text-sm text-purple-300 sm:block">{context}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-md border border-purple-500 px-3 py-1.5 text-sm text-purple-200 transition-colors hover:bg-purple-700 hover:text-base-50"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </div>
        <div className="h-px w-full bg-gold-500/60" />
        <nav className="mx-auto flex max-w-6xl gap-6 px-6">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`-mb-px border-b-2 py-3 text-sm transition-colors ${
                  active
                    ? "border-gold-500 text-base-50"
                    : "border-transparent text-purple-300 hover:text-base-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
