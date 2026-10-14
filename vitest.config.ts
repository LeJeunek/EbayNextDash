// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → "./src/*" so tests import like the app does.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each file gets fresh module state, so vi.mock in one file never leaks.
    isolate: true,
    restoreMocks: true,
  },
});
