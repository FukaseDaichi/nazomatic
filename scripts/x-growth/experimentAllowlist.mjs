// 自動改善ループが編集してよいパスと変更種別の allowlist。
// LLM の裁量ではなく、この決定論コードが唯一の境界。
export const EXPERIMENT_ALLOWLIST = [
  {
    path: "src/server/x-browser-posting/comment-patterns.json",
    kind: "json-array",
    note: "個別イベント投稿のコメント候補（配列1件の入替）",
  },
  {
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-copy",
    note: "fallback 候補文・prompt テンプレート・閾値定数（文言と数値のみ。ロジック不可）",
  },
  {
    path: "docs/system-design/operations/x-browser-post-schedules.md",
    kind: "doc",
    note: "運用台帳の記述更新",
  },
];

// 絶対に触らせないパス。allowlist と多重防御。
export const DENY_PATH_PATTERNS = [
  /(^|\/)config\.mjs$/,
  /(^|\/)\.env/,
  /^\.github\//,
  /middleware\.(ts|js)$/,
  /(^|\/)package(-lock)?\.json$/,
];

// ts-copy の find/replace に現れてはいけない重要トークン。
// これによりループは「文言・候補文・数値閾値の中身」しか変えられず、
// 投稿ロジック・認証・実行ガード・外部呼び出しには触れられない。
export const FORBIDDEN_CHANGE_TOKENS = [
  "validatetrendjoketext",
  "weightedtextlength",
  "max_trend_joke",
  "max_daily",
  "min_cooldown",
  "--execute",
  "confirmation_mode",
  "auto_execute",
  "process.env",
  "spawn",
  "exec(",
  "execfile",
  "execsync",
  "child_process",
  "fetch(",
  "import ",
  "import(",
  "require(",
  "eval(",
  "function(",
  "globalthis",
];

const ALLOWED_KINDS = new Set(["json-array", "ts-copy", "doc"]);

export function validateProposalTarget(proposal) {
  const path = String(proposal?.path ?? "");
  const kind = String(proposal?.kind ?? "");
  if (!path) {
    return { ok: false, reason: "path is empty" };
  }
  if (path.includes("..") || path.startsWith("/")) {
    return { ok: false, reason: "path must be a repo-relative simple path" };
  }
  if (DENY_PATH_PATTERNS.some((re) => re.test(path))) {
    return { ok: false, reason: `path is explicitly denied: ${path}` };
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return { ok: false, reason: `unknown change kind: ${kind}` };
  }
  const entry = EXPERIMENT_ALLOWLIST.find((e) => e.path === path);
  if (!entry) {
    return { ok: false, reason: `path not in allowlist: ${path}` };
  }
  if (entry.kind !== kind) {
    return {
      ok: false,
      reason: `kind ${kind} does not match allowlist kind ${entry.kind} for ${path}`,
    };
  }
  return { ok: true };
}

export function validateProposalChange(proposal) {
  if (proposal?.kind !== "ts-copy") {
    return { ok: true };
  }
  const haystack = `${proposal?.change?.find ?? ""}\n${proposal?.change?.replace ?? ""}`.toLowerCase();
  const hit = FORBIDDEN_CHANGE_TOKENS.find((token) => haystack.includes(token));
  if (hit) {
    return {
      ok: false,
      reason: `ts-copy change touches a forbidden token: ${hit}`,
    };
  }
  return { ok: true };
}
