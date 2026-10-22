import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  root: "/app/tests/visual/cardapio",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": "/app/src" }, dedupe: ["react", "react-dom"] },
  server: { fs: { allow: ["/app"] } },
});
