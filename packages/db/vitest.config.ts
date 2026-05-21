import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    // DB integration tests hit local Supabase — run serially to avoid noise.
    testTimeout: 15000,
  },
});
