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


/**
 * Stamp the build so a served page can say which commit it came from.
 *
 * ENGINE_VERSION only moves when scoring semantics move, so it cannot answer
 * "is this the build I am reading?" — sixteen commits shipped under v1.5.2
 * after audit #8 gated on v1.5.2. Falls back through the CI-provided sha
 * variables, then to "unknown", which build-info.ts renders as "not stamped"
 * rather than inventing an identifier.
 */
function buildStamp(): { sha: string; time: string } {
  const fromEnv =
    process.env.LOVABLE_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "";
  if (fromEnv) return { sha: fromEnv.slice(0, 7), time: new Date().toISOString() };

  const git = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: import.meta.dirname,
    encoding: "utf8",
  });
  const sha = git.status === 0 ? git.stdout.trim() : "unknown";
  return { sha, time: new Date().toISOString() };
}

const STAMP = buildStamp();

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __BUILD_SHA__: JSON.stringify(STAMP.sha),
      __BUILD_TIME__: JSON.stringify(STAMP.time),
    },
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
