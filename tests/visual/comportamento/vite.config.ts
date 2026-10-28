import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const raiz = "/home/twadmin/painel_koji";
const aqui = `${raiz}/tests/visual/comportamento`;

export default defineConfig({
  root: aqui,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@tanstack/react-start/server", replacement: `${aqui}/stub-start.tsx` },
      { find: "@tanstack/react-start", replacement: `${aqui}/stub-start.tsx` },
      { find: "@tanstack/react-router", replacement: `${aqui}/stub-router.tsx` },
      { find: "@/components/luxtia/AppShell", replacement: `${aqui}/stub-shell.tsx` },
      { find: "@/lib/gateway.functions", replacement: `${aqui}/dados.ts` },
      { find: "@/lib/gateway-empresas.functions", replacement: `${aqui}/dados.ts` },
      { find: "@/lib/gateway-atendimento.functions", replacement: `${aqui}/dados.ts` },
      { find: "@/lib/gateway-agentes.functions", replacement: `${aqui}/dados.ts` },
      { find: "@/lib/gateway-canais.functions", replacement: `${aqui}/dados.ts` },
      { find: "@/lib/gateway-modulos.functions", replacement: `${aqui}/dados.ts` },
      { find: "@", replacement: `${raiz}/src` },
    ],
    dedupe: ["react", "react-dom"],
  },
  cacheDir: "/tmp/vite-comportamento",
  server: { fs: { allow: [raiz] } },
});
