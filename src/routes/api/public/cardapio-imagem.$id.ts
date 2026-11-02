import { createFileRoute } from "@tanstack/react-router";
import { ipDoCliente } from "@/lib/ip-cliente";

const TIPOS = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Entrega as imagens do cardápio na mesma origem da página. O id nunca se repete, então o cache pode ser longo. */
export const Route = createFileRoute("/api/public/cardapio-imagem/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const admin = process.env["GATEWAY_ADMIN_URL"];
        if (!admin || !/^[0-9a-f]{32}$/.test(params.id)) return new Response(null, { status: 404 });
        const base = admin.replace(/\/admin\/v1\/?$/, "");
        const ip = ipDoCliente(request.headers);
        const r = await fetch(`${base}/api/v1/publico/cardapio/imagem/${params.id}`, {
          headers: ip ? { "X-Real-IP": ip } : {},
          signal: AbortSignal.timeout(10_000),
        }).catch(() => null);
        const tipo = r?.headers.get("content-type") ?? "";
        if (!r?.ok || !TIPOS.has(tipo)) return new Response(null, { status: 404 });
        return new Response(await r.arrayBuffer(), {
          headers: {
            "Content-Type": tipo,
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        });
      },
    },
  },
});
