import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest-Setup fuer reine Unit-Tests in lib/ (Logik ohne Next-Runtime).
// Lokal: `npm test` oder `npm run test:watch`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["lib/**/__tests__/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
