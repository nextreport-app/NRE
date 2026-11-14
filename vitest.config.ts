import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // These use node:test and run via test:quality-agents / test:all.
    // Importing them into Vitest executes them outside its suite lifecycle.
    exclude: [...configDefaults.exclude, "scripts/agents/**/*.test.mjs"],
  },
});
