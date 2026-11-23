import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": "./test-shims/server-only.ts",
    },
  },
  test: {
    setupFiles: ["./test-setup.ts"],
    environment: "node",

    include: ["app/**/*.test.ts","lib/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
