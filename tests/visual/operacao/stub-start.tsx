/** A prévia chama a função direto, sem o servidor do painel. */
export function useServerFn<T>(fn: T) {
  return fn;
}

function cadeia() {
  const api = {
    middleware() {
      return api;
    },
    inputValidator() {
      return api;
    },
    handler(fn: unknown) {
      return fn;
    },
  };
  return api;
}

export function createServerFn() {
  return cadeia();
}

export function createMiddleware() {
  return { server: (fn: unknown) => fn };
}
