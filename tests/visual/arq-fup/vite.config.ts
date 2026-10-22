import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  root: "/home/twadmin/painel_koji/tests/visual/arq-fup",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@tanstack/react-start/server",
        replacement: "/home/twadmin/painel_koji/tests/visual/arq-fup/stub.tsx",
      },
      {
        find: "@tanstack/react-start",
        replacement: "/home/twadmin/painel_koji/tests/visual/arq-fup/stub.tsx",
      },
      {
        find: "@/components/luxtia/AppShell",
        replacement: "/home/twadmin/painel_koji/tests/visual/arq-fup/stub.tsx",
      },
      {
        find: "@/lib/gateway.functions",
        replacement: "/home/twadmin/painel_koji/tests/visual/arq-fup/stub.tsx",
      },
      {
        find: "@/lib/gateway-empresas.functions",
        replacement: "/home/twadmin/painel_koji/tests/visual/arq-fup/stub.tsx",
      },
      { find: "@", replacement: "/home/twadmin/painel_koji/src" },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { fs: { allow: ["/home/twadmin/painel_koji"] } },
});
