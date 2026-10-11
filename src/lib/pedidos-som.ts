/** Preferência local do som de pedido novo. Padrão desligado. */
export function chaveSomPedido(usuario: string) {
  return `luxtia:pedidos-som:${usuario}`;
}
export function somPedidoLigado(usuario: string) {
  try {
    return localStorage.getItem(chaveSomPedido(usuario)) === "1";
  } catch {
    return false;
  }
}
export function definirSomPedido(usuario: string, ligado: boolean) {
  try {
    localStorage.setItem(chaveSomPedido(usuario), ligado ? "1" : "0");
  } catch {
    /* A preferência vale enquanto a aba estiver aberta. */
  }
  window.dispatchEvent(new Event("luxtia:pedidos-som"));
}
export function tocarPedidoNovo() {
  const audio = new AudioContext();
  const osc = audio.createOscillator();
  const ganho = audio.createGain();
  osc.frequency.value = 880;
  ganho.gain.value = 0.04;
  osc.connect(ganho);
  ganho.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.12);
  window.setTimeout(() => void audio.close(), 400);
}
