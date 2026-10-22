import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  root: "/app/tests/visual/cat3",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": "/app/src" }, dedupe: ["react", "react-dom"] },
  server: { fs: { allow: ["/app"] } },
});
