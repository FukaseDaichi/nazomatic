import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    // React Compiler rules added by eslint-config-next 16; existing violations are tracked
    // in docs/system-design/quality/known-concerns.md until they are fixed.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  globalIgnores([
    ".next/**", "out/**", "build/**", "next-env.d.ts", "artifacts/**", "ds-bundle/**",
    // Local tooling, design-sync previews and nested worktrees, which next lint never covered
    // (flat config does not read .gitignore).
    ".claude/worktrees/**", ".ds-sync/**", ".design-sync/**"]),
]);
