const IP = /^[0-9a-fA-F:.]{3,45}$/;

/**
 * IP de quem chamou, atrás do proxy do painel. O proxy acrescenta o endereço real ao fim de
 * X-Forwarded-For. O início da lista vem de quem fez o pedido e pode ser forjado.
 */
export function ipDoCliente(cabecalhos: Pick<Headers, "get">) {
  const ip =
    cabecalhos.get("x-forwarded-for")?.split(",").at(-1)?.trim() || cabecalhos.get("x-real-ip");
  return ip && IP.test(ip) ? ip : null;
}
