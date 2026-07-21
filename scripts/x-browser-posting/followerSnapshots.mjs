import fs from "fs/promises";
import path from "path";

// フォロワー数・累計投稿数の推移を記録する共通台帳。
// 週次レビューの1回勝負ではなく、各投稿実行に相乗りして日次で追記できるよう、
// JST の日付単位で1件に集約する。投稿スクリプトと週次レビューの両方から利用する。

const SNAPSHOT_RELATIVE_PATH = "local/x-browser-posting/follower-snapshots.json";
const SNAPSHOT_VERSION = 1;
// 日次で追記するため、およそ1年強を保持できる件数に上限を置く。
const MAX_SNAPSHOTS = 400;

export function getFollowerSnapshotPath(cwd) {
  return path.join(cwd, SNAPSHOT_RELATIVE_PATH);
}

export async function readFollowerSnapshots(cwd) {
  try {
    const parsed = JSON.parse(
      await fs.readFile(getFollowerSnapshotPath(cwd), "utf8")
    );
    return Array.isArray(parsed?.snapshots) ? parsed.snapshots : [];
  } catch {
    return [];
  }
}

// スナップショットを1件追記する。同一 account・同一 JST 日付の既存行は置き換える。
// 新しい値が取得できなかった (null) 項目は、同日の既存値を維持して劣化を防ぐ。
export async function recordFollowerSnapshot(cwd, snapshot) {
  const snapshots = await readFollowerSnapshots(cwd);
  const next = upsertFollowerSnapshot(snapshots, snapshot);
  await writeFollowerSnapshots(cwd, next);
  return next[0];
}

export function upsertFollowerSnapshot(snapshots, snapshot) {
  const accountHandle = normalizeHandle(snapshot.accountHandle);
  const capturedAt = snapshot.capturedAt ?? new Date().toISOString();
  const dayKey = jstDayKey(capturedAt);
  const existing = snapshots.find(
    (entry) =>
      normalizeHandle(entry.accountHandle) === accountHandle &&
      (entry.dayKey ?? jstDayKey(entry.capturedAt)) === dayKey
  );
  const normalized = {
    capturedAt,
    dayKey,
    weekKey: snapshot.weekKey ?? existing?.weekKey ?? null,
    accountHandle,
    followers: Number.isFinite(snapshot.followers)
      ? snapshot.followers
      : existing?.followers ?? null,
    posts: Number.isFinite(snapshot.posts)
      ? snapshot.posts
      : existing?.posts ?? null,
    source: snapshot.source ?? existing?.source ?? "unknown",
  };
  const rest = snapshots.filter(
    (entry) =>
      !(
        normalizeHandle(entry.accountHandle) === accountHandle &&
        (entry.dayKey ?? jstDayKey(entry.capturedAt)) === dayKey
      )
  );
  return [normalized, ...rest]
    .sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    )
    .slice(0, MAX_SNAPSHOTS);
}

// 週次デルタ用に、指定時刻から一定日数以上前の最新スナップショットを返す。
export function findPreviousSnapshot(snapshots, now, minAgeDays = 5) {
  const cutoff = now.getTime() - minAgeDays * 24 * 60 * 60 * 1000;
  return snapshots.find(
    (entry) => new Date(entry.capturedAt).getTime() <= cutoff
  );
}

async function writeFollowerSnapshots(cwd, snapshots) {
  const filePath = getFollowerSnapshotPath(cwd);
  const value = { version: SNAPSHOT_VERSION, snapshots };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

function jstDayKey(isoString) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoString));
}

function normalizeHandle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}
