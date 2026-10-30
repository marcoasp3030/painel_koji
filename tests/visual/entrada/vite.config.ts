import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "../../..");

export default defineConfig({
  root: aqui,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: "@", replacement: path.join(raiz, "src") }],
    dedupe: ["react", "react-dom"],
  },
  cacheDir: "/tmp/vite-entrada",
  server: { host: "127.0.0.1", port: 18180, fs: { allow: [raiz] } },
});
