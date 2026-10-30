import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const raiz = "/home/twadmin/painel_koji";
const aqui = `${raiz}/tests/visual/operacao`;

export default defineConfig({
  root: aqui,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@tanstack/react-start/server", replacement: `${aqui}/stub-start.tsx` },
      { find: "@tanstack/react-start", replacement: `${aqui}/stub-start.tsx` },
      { find: "@tanstack/react-router", replacement: `${aqui}/stub-router.tsx` },
      { find: "@/components/luxtia/AppShell", replacement: `${aqui}/stub-shell.tsx` },
      { find: "@/integrations/supabase/client", replacement: `${aqui}/stub-supabase.ts` },
      { find: /@\/lib\/.*functions$/, replacement: `${aqui}/dados.ts` },
      { find: "@", replacement: `${raiz}/src` },
    ],
    dedupe: ["react", "react-dom"],
  },
  cacheDir: "/tmp/vite-operacao",
  server: { host: "0.0.0.0", port: 18176, strictPort: true, fs: { allow: [raiz] } },
});
