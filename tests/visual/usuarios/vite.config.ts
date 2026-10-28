import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const raiz = "/home/twadmin/painel_koji";
const aqui = `${raiz}/tests/visual/usuarios`;

export default defineConfig({
  root: aqui,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: "@", replacement: `${raiz}/src` }],
    dedupe: ["react", "react-dom"],
  },
  cacheDir: "/tmp/vite-usuarios",
  server: { host: "127.0.0.1", port: 18176, fs: { allow: [raiz] } },
});
