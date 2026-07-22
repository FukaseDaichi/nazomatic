import { firestore } from "@/server/firebase/admin";

import { SIGNATURE_TTL_SECONDS } from "./signature";

const COLLECTION = "internalApiNonces";
const ALREADY_EXISTS = 6;
const CLEANUP_PROBABILITY = 0.1;
const CLEANUP_BATCH_SIZE = 200;

/**
 * nonce を一度だけ記録する。既に記録済みなら false（replay）。
 * `create()` は同一 document id が存在すると失敗するため、
 * 追加の transaction なしで atomic に重複を検出できる。
 */
export async function consumeNonce(nonce: string, now: Date): Promise<boolean> {
  const expiresAt = new Date(now.getTime() + SIGNATURE_TTL_SECONDS * 2 * 1000);

  try {
    await firestore.collection(COLLECTION).doc(nonce).create({
      createdAt: now,
      expiresAt,
    });
  } catch (error) {
    if (isAlreadyExists(error)) {
      return false;
    }
    throw error;
  }

  void cleanupExpiredNonces(now);
  return true;
}

function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === ALREADY_EXISTS
  );
}

/**
 * 期限切れ nonce の best-effort 削除。
 * Firestore の TTL policy を `expiresAt` に設定している場合は不要だが、
 * 未設定でも document が無制限に増えないようにする。
 */
async function cleanupExpiredNonces(now: Date): Promise<void> {
  if (Math.random() > CLEANUP_PROBABILITY) {
    return;
  }

  try {
    const snapshot = await firestore
      .collection(COLLECTION)
      .where("expiresAt", "<", now)
      .limit(CLEANUP_BATCH_SIZE)
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error("Failed to clean up expired internal API nonces", error);
  }
}
