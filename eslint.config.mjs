import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scratch/debug scripts are not application code
    "scratch/**",
    "prisma/**",
  ]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // Server components use try/catch + JSX for data fetching - valid Next.js pattern
      "react-hooks/error-boundaries": "off",
      // Syncing setState with controlled prop value is valid in UI components (select, status-badge)
      "react-hooks/set-state-in-effect": "off",
      // Project uses 'any' intentionally in many Prisma/AI call sites
      "@typescript-eslint/no-explicit-any": "off",
      // Downgrade unused vars to warning (doesn't block build)
      "@typescript-eslint/no-unused-vars": "warn",
      // Allow require() in API routes that need CJS modules
      "@typescript-eslint/no-require-imports": "off",
    }
  }
]);

export default eslintConfig;

