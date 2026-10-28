/** A prévia chama a função direto, sem o servidor do painel. */
export function useServerFn<T>(fn: T) {
  return fn;
}

export function createMiddleware() {
  return { server: (fn: unknown) => fn };
}
