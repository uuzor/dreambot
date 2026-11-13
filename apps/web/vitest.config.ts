import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Next resolves "server-only" through its bundler; plain vitest does not, and
// the module throws on import outside that context. Stub it so server modules
// under test (session, api) can be imported directly.
export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
});
