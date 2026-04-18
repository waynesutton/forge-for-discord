import { defineConfig, globalIgnores } from "eslint/config";
import convexPlugin from "@convex-dev/eslint-plugin";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Forge lint config. Two main goals:
//   1. Run the Convex plugin's recommended rules on convex/**.
//   2. Run react-hooks rules on src/** so we catch missing deps and the
//      useSyncExternalStore + useEffect patterns we rely on.
// typescript-eslint is wired with project-aware parsing so the Convex plugin's
// type-aware rules (explicit-table-ids, no-collect-in-query) actually run.
export default defineConfig([
  globalIgnores([
    "dist/**",
    "build/**",
    "node_modules/**",
    "convex/_generated/**",
  ]),

  // Frontend app: TS + React hooks rules.
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ["src/**/*.{ts,tsx}"],
  })),
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Convex backend: recommended plugin config + extra type-aware rules.
  ...convexPlugin.configs.recommended,
  {
    files: ["convex/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@convex-dev/no-collect-in-query": "warn",
      "@convex-dev/import-wrong-runtime": "warn",
    },
  },
]);
