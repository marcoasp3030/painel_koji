/** Substitui o que a prévia não executa: sessão, menu e funções de servidor. */
import type { ReactNode } from "react";

export function AppShell({ children }: { children?: ReactNode }) {
  return children;
}

export function useServerFn<T>(fn: T) {
  return fn;
}

export function createMiddleware() {
  return { server: (fn: unknown) => fn };
}

export function getRequest() {
  return new Request("http://127.0.0.1/");
}

export function obterAcessoGateway() {
  return undefined;
}

export function listarEmpresasGateway() {
  return undefined;
}
