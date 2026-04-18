import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["node_modules/**", "dist/**", "dist-server/**"]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        proposalcraft: "src/widget/proposalcraft.html"
      }
    }
  },
  server: {
    port: 5173
  }
});
