import ts from "typescript";

// 自動改善ループが編集してよいパスと変更種別の allowlist。
// LLM の裁量ではなく、この決定論コードが唯一の境界。
export const EXPERIMENT_ALLOWLIST = [
  {
    path: "src/server/x-browser-posting/comment-patterns.json",
    kind: "json-patch",
    targetKeys: ["comment-pattern:*"],
    note: "個別イベント投稿のコメント候補（既存配列の長さを変えない最大6箇所の改善）",
  },
  {
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-patch",
    targetKeys: ["trend-joke:*"],
    note: "投稿生成戦略、fallback、prompt、候補選択ロジック（最大6箇所。保護された運用・安全境界は変更不可。投稿型 archetype はCLIの5型ローテーションが正本であり、特定の型への固定・既定選択の変更は禁止）",
  },
];

export const MAX_PROPOSAL_CHANGES = 6;
export const MAX_PROPOSAL_CHANGED_LINES = 120;
export const MAX_PROPOSAL_REPLACEMENT_CHARS = 12000;

// 絶対に触らせないパス。allowlist と多重防御。
export const DENY_PATH_PATTERNS = [
  /(^|\/)config\.mjs$/,
  /(^|\/)\.env/,
  /^\.github\//,
  /middleware\.(ts|js)$/,
  /(^|\/)package(-lock)?\.json$/,
];

// 追加コードに現れてはいけない実行・秘密情報アクセス用 token。
// 既存コードに同名 token がある場合は、下の protected declaration 比較で
// その宣言全体を固定する。
export const FORBIDDEN_ADDED_CODE_PATTERNS = [
  ["environment access", /\bprocess(?:\s*\?*\.)?\s*env\b/i],
  ["global object access", /\bglobalThis\b/i],
  ["dynamic evaluation", /\beval\s*\(|\bFunction\s*\(/],
  ["module loading", /\brequire\s*\(|\bimport\s*\(/],
  ["process execution", /\b(?:spawn|exec|execFile|execSync)\s*\(/i],
  ["external I/O", /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/i],
  ["external search", /\b(?:fetchYahooRealtimePosts|fetchSearchSamples)\s*\(/],
  ["execute flag", /--execute/i],
  ["confirmation guard", /confirmation_mode|auto_execute/i],
  ["child process", /child_process/i],
];

const PROTECTED_TS_FUNCTIONS = new Set([
  "weightedTextLength",
  "validateTrendJokeText",
  "validatePollOptions",
  "normalizeExcludedToolPaths",
  "normalizeArchetype",
  "pickArchetype",
  "normalizeTimezone",
  "normalizeRunDate",
  "formatZonedDate",
  "normalizeRunSlot",
  "normalizeQueryBundleKey",
  "normalizeTopicKey",
  "normalizeSearchQueries",
  "normalizeBoundedInteger",
  "pickSearchQueries",
  "fetchSearchSamples",
  "extractTicketTitle",
  "extractTitleFromText",
  "sanitizeTitle",
  "pickTool",
  "buildSearchFingerprint",
  "isQueryBundleKey",
  "isTopicKey",
  "containsEmoji",
]);

const PROTECTED_TS_CALLS = new Set([
  "normalizeParams",
  "pickArchetype",
  "normalizeTimezone",
  "normalizeRunDate",
  "normalizeRunSlot",
  "normalizeQueryBundleKey",
  "normalizeSearchQueries",
  "normalizeBoundedInteger",
  "normalizeTopicKey",
  "normalizeExcludedToolPaths",
  "fetchSearchSamples",
  "validateTrendJokeText",
  "validatePollOptions",
  "pickTool",
  "buildSearchFingerprint",
]);

const PROTECTED_TS_CALL_COUNTS = new Set([
  "normalizeArchetype",
]);

const PROTECTED_TS_CONSTANTS = new Set([
  "DEFAULT_TIMEZONE",
  "DEFAULT_MAX_SEARCH_QUERIES",
  "DEFAULT_MAX_POSTS_PER_QUERY",
  "MAX_SEARCH_QUERIES",
  "MAX_POSTS_PER_QUERY",
  "SEARCH_TIMEOUT_MS",
  "MAX_TREND_JOKE_WEIGHTED_LENGTH",
  "MAX_TREND_JOKE_NEWLINES",
  "PUBLIC_BASE_URL",
]);

const ALLOWED_KINDS = new Set(["json-patch", "ts-patch"]);

const LEGACY_FORBIDDEN_TOKENS = [
  "max_daily",
  "min_cooldown",
  "--execute",
  "confirmation_mode",
  "auto_execute",
];

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
  const targetKey = String(proposal?.targetKey ?? "");
  if (!targetKey || !entry.targetKeys.some((pattern) => pattern.endsWith("*") ? targetKey.startsWith(pattern.slice(0, -1)) : targetKey === pattern)) {
    return { ok: false, reason: `targetKey is not allowed for ${path}` };
  }
  return { ok: true };
}

export function validateProposalChange(proposal) {
  const changes = proposal?.changes;
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > MAX_PROPOSAL_CHANGES) {
    return {
      ok: false,
      reason: `changes must contain 1 to ${MAX_PROPOSAL_CHANGES} replacements`,
    };
  }
  let changedLines = 0;
  let replacementChars = 0;
  for (const [index, change] of changes.entries()) {
    const find = change?.find;
    const replace = change?.replace;
    if (typeof find !== "string" || typeof replace !== "string" || !find || !replace) {
      return { ok: false, reason: `changes[${index}] find/replace must be non-empty strings` };
    }
    if (find === replace) {
      return { ok: false, reason: `changes[${index}] is a no-op` };
    }
    changedLines += countLines(find) + countLines(replace);
    replacementChars += replace.length;
  }
  if (changedLines > MAX_PROPOSAL_CHANGED_LINES) {
    return {
      ok: false,
      reason: `proposal change budget exceeded (${changedLines}/${MAX_PROPOSAL_CHANGED_LINES} lines)`,
    };
  }
  if (replacementChars > MAX_PROPOSAL_REPLACEMENT_CHARS) {
    return {
      ok: false,
      reason: `proposal replacement budget exceeded (${replacementChars}/${MAX_PROPOSAL_REPLACEMENT_CHARS} characters)`,
    };
  }
  if (proposal?.kind === "ts-patch") {
    const addedCode = changes.map((change) => change.replace).join("\n");
    const forbiddenPattern = FORBIDDEN_ADDED_CODE_PATTERNS.find(([, pattern]) =>
      pattern.test(addedCode),
    );
    if (forbiddenPattern) {
      return {
        ok: false,
        reason: `ts-patch introduces forbidden ${forbiddenPattern[0]}`,
      };
    }
    const lowered = addedCode.toLowerCase();
    const legacyHit = LEGACY_FORBIDDEN_TOKENS.find((token) => lowered.includes(token));
    if (legacyHit) {
      return {
        ok: false,
        reason: `ts-patch touches a forbidden token: ${legacyHit}`,
      };
    }
  }
  return { ok: true };
}

export function validateAppliedChange(proposal, before, after) {
  if (before === after) {
    return { ok: false, reason: "proposal did not change the target file" };
  }
  if (proposal.kind === "json-patch") {
    try {
      const beforeValue = JSON.parse(before);
      const afterValue = JSON.parse(after);
      if (!Array.isArray(beforeValue) || !Array.isArray(afterValue)) {
        return { ok: false, reason: "json-patch target must remain an array" };
      }
      if (beforeValue.length !== afterValue.length) {
        return { ok: false, reason: "json-patch must not change the array length" };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: `result is not valid JSON: ${error.message}` };
    }
  }
  if (proposal.kind !== "ts-patch") {
    return { ok: false, reason: `unsupported proposal kind: ${proposal.kind}` };
  }
  const beforeSnapshot = collectProtectedTsSnapshot(before);
  const afterSnapshot = collectProtectedTsSnapshot(after);
  if (beforeSnapshot.error) {
    return { ok: false, reason: `base TypeScript could not be inspected: ${beforeSnapshot.error}` };
  }
  if (afterSnapshot.error) {
    return { ok: false, reason: `patched TypeScript could not be inspected: ${afterSnapshot.error}` };
  }
  if (JSON.stringify(beforeSnapshot.imports) !== JSON.stringify(afterSnapshot.imports)) {
    return { ok: false, reason: "ts-patch must not add, remove, or change imports" };
  }
  if (
    JSON.stringify(beforeSnapshot.protectedCalls) !==
    JSON.stringify(afterSnapshot.protectedCalls)
  ) {
    return {
      ok: false,
      reason: "ts-patch must not change protected validation, external I/O, or fingerprint calls",
    };
  }
  if (
    JSON.stringify(beforeSnapshot.protectedCallCounts) !==
    JSON.stringify(afterSnapshot.protectedCallCounts)
  ) {
    return {
      ok: false,
      reason: "ts-patch must keep protected validator calls",
    };
  }
  for (const [name, source] of Object.entries(beforeSnapshot.protectedDeclarations)) {
    if (afterSnapshot.protectedDeclarations[name] !== source) {
      return { ok: false, reason: `ts-patch must not change protected declaration: ${name}` };
    }
  }
  if (
    Object.keys(beforeSnapshot.protectedDeclarations).length !==
    Object.keys(afterSnapshot.protectedDeclarations).length
  ) {
    return { ok: false, reason: "ts-patch must not add or remove protected declarations" };
  }
  return { ok: true };
}

function collectProtectedTsSnapshot(source) {
  const file = ts.createSourceFile(
    "trend-joke-post.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (file.parseDiagnostics.length > 0) {
    return {
      error: file.parseDiagnostics
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "))
        .join("; "),
    };
  }
  const imports = [];
  const protectedCalls = [];
  const protectedCallCounts = {};
  const protectedDeclarations = {};
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      imports.push(statement.getText(file));
      continue;
    }
    if (ts.isFunctionDeclaration(statement)) {
      const name = statement.name?.text;
      if (name && PROTECTED_TS_FUNCTIONS.has(name)) {
        protectedDeclarations[`function:${name}`] = statement.getText(file);
      }
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = ts.isIdentifier(declaration.name) ? declaration.name.text : null;
        if (name && PROTECTED_TS_CONSTANTS.has(name)) {
          protectedDeclarations[`constant:${name}`] = statement.getText(file);
        }
      }
    }
  }
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      PROTECTED_TS_CALLS.has(node.expression.text)
    ) {
      protectedCalls.push(node.getText(file));
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      PROTECTED_TS_CALL_COUNTS.has(node.expression.text)
    ) {
      protectedCallCounts[node.expression.text] =
        (protectedCallCounts[node.expression.text] ?? 0) + 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return {
    imports,
    protectedCalls,
    protectedCallCounts,
    protectedDeclarations,
  };
}

function countLines(value) {
  return String(value).split(/\r?\n/).length;
}
