// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { imagetools } from "vite-imagetools";
import { spawnSync } from "node:child_process";

/**
 * Fails any production build when agency-dominant self-description survives on
 * public routes or marketing components. Runs in the build regardless of how it
 * was invoked, so the npm `prebuild` hook is a convenience, not the only gate.
 */
function publicVocabularyGuard() {
  return {
    name: "taasflow-public-vocabulary-guard",
    apply: "build" as const,
    buildStart() {
      const result = spawnSync(
        process.execPath,
        ["scripts/check-public-vocabulary.mjs"],
        { cwd: import.meta.dirname, encoding: "utf8" },
      );
      if (result.status !== 0) {
        throw new Error(
          `Public vocabulary check failed.\n${result.stderr || result.stdout || ""}`,
        );
      }
    },
  };
}


export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [publicVocabularyGuard(), imagetools(), mcpPlugin()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
});
