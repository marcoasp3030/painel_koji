/** Prepara a imagem no navegador de quem envia: reduz, converte e descarta metadados, como localização de foto. */
export const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"];
export const MAX_ARQUIVO = 10 * 1024 * 1024;
const MAX_FINAL = 1_500_000;

export type Preparada = { base64: string; largura: number; altura: number; url: string };

export function problemaNaImagem(arquivo: { type: string; size: number }) {
  if (!TIPOS_IMAGEM.includes(arquivo.type)) return "Use uma imagem PNG, JPG ou WebP.";
  if (arquivo.size > MAX_ARQUIVO) return "A imagem pode ter até 10 MB.";
  return null;
}

/** Tamanho final mantendo a proporção; nunca amplia. */
export function dimensoes(largura: number, altura: number, maxLargura: number, maxAltura: number) {
  const escala = Math.min(1, maxLargura / largura, maxAltura / altura);
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number) {
  return new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, qualidade));
}

export async function prepararImagem(
  arquivo: File,
  limite: { largura: number; altura: number },
): Promise<Preparada> {
  const original = await createImageBitmap(arquivo).catch(() => null);
  if (!original) throw new Error("Não foi possível ler esta imagem.");
  const d = dimensoes(original.width, original.height, limite.largura, limite.altura);
  const canvas = document.createElement("canvas");
  canvas.width = d.largura;
  canvas.height = d.altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar esta imagem.");
  ctx.drawImage(original, 0, 0, d.largura, d.altura);
  original.close();
  let blob: Blob | null = null;
  for (const qualidade of [0.9, 0.8, 0.65, 0.5]) {
    // Sem suporte a WebP, o navegador devolve PNG: serve, desde que caiba.
    blob = await paraBlob(canvas, "image/webp", qualidade);
    if (blob && blob.size <= MAX_FINAL) break;
  }
  if (blob && blob.size > MAX_FINAL) blob = await paraBlob(canvas, "image/jpeg", 0.7);
  if (!blob || blob.size > MAX_FINAL) throw new Error("A imagem ficou grande demais. Use outra.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return {
    base64: btoa(binario),
    largura: d.largura,
    altura: d.altura,
    url: URL.createObjectURL(blob),
  };
}
