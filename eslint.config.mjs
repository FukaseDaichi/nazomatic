import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  globalIgnores([
    ".next/**", "out/**", "build/**", "next-env.d.ts", "artifacts/**", "ds-bundle/**",
    // Local tooling, design-sync previews and nested worktrees, which next lint never covered
    // (flat config does not read .gitignore).
    ".claude/worktrees/**", ".ds-sync/**", ".design-sync/**"]),
]);
