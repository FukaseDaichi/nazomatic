// X のプロフィール数値と投稿数値を、ログイン済み画面の innerText から抽出する共通パーサ。
// ブラウザ側で innerText を取得したあと、この Node 側関数で数値化する。
// x-weekly-growth-review と cdpChromePage の両方から利用し、重複実装を避ける。

const PROFILE_FOLLOWER_LABELS = ["フォロワー", "Followers"];
const PROFILE_POST_LABELS = ["件のポスト", "posts", "Posts"];

export function parseCompactNumber(value) {
  const match = /([0-9][0-9,.]*)([万千KkMm]?)/.exec(String(value ?? ""));
  if (!match) {
    return null;
  }
  const base = Number(match[1].replace(/,/g, ""));
  const multiplier =
    match[2] === "万"
      ? 10000
      : match[2] === "千" || /k/i.test(match[2])
        ? 1000
        : /m/i.test(match[2])
          ? 1000000
          : 1;
  return Math.round(base * multiplier);
}

export function findLocalizedMetric(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const before = new RegExp(
      `([0-9][0-9,.]*[万千KkMm]?)\\s*${escaped}`,
      "i"
    ).exec(text);
    if (before) {
      return parseCompactNumber(before[1]);
    }
    const after = new RegExp(
      `${escaped}\\s*([0-9][0-9,.]*[万千KkMm]?)`,
      "i"
    ).exec(text);
    if (after) {
      return parseCompactNumber(after[1]);
    }
  }
  return null;
}

// プロフィール画面の body innerText から followers / posts を抽出する。
export function parseProfileStats(bodyText) {
  return {
    followers: findLocalizedMetric(bodyText, PROFILE_FOLLOWER_LABELS),
    posts: findLocalizedMetric(bodyText, PROFILE_POST_LABELS),
  };
}

// 投稿詳細のアクションボタン文字列から reply / repost / like / views を数値化する。
// ボタンが存在しない値は null、存在するが数が読めない値は 0 とする。
export function parsePostMetrics(raw) {
  if (!raw || typeof raw !== "object") {
    return { replies: null, reposts: null, likes: null, views: null };
  }
  const fromAction = (value) =>
    value == null ? null : parseCompactNumber(value) ?? 0;
  return {
    replies: fromAction(raw.reply),
    reposts: fromAction(raw.retweet),
    likes: fromAction(raw.like),
    views: raw.views == null ? null : parseCompactNumber(raw.views),
  };
}
