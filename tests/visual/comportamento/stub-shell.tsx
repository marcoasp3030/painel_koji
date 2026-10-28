import type { ReactNode } from "react";

/** Sem o menu: a prévia mostra só o miolo da tela. */
export function AppShell({ children }: { children?: ReactNode }) {
  return <div className="mx-auto min-h-screen max-w-6xl bg-background p-6">{children}</div>;
}
