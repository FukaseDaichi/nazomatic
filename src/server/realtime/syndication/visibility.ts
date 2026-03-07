export type SyndicationVisibilityStatus =
  | "pending"
  | "available"
  | "deleted"
  | "unknown";

export const SYNDICATION_HIDDEN_REASON_DELETED = "syndication_deleted";

const DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_CHECK_DELAY_HOURS = 6;

export function buildInitialSyndicationFields(capturedAt: Date) {
  return {
    isVisible: true,
    hiddenReason: null,
    hiddenAt: null,
    syndicationStatus: "pending" as const,
    syndicationCheckedAt: null,
    syndicationNextCheckAt: addHours(capturedAt, INITIAL_CHECK_DELAY_HOURS),
    syndicationErrorCount: 0,
  };
}

export function isRealtimeEventVisible(data: FirebaseFirestore.DocumentData) {
  return data.isVisible !== false;
}

export function shouldCheckSyndicationNow(
  data: FirebaseFirestore.DocumentData,
  now: Date
) {
  if (!isRealtimeEventVisible(data)) {
    return false;
  }

  const nextCheckAt = readDateValue(data.syndicationNextCheckAt);
  if (nextCheckAt) {
    return nextCheckAt.getTime() <= now.getTime();
  }

  return readDateValue(data.syndicationCheckedAt) === null;
}

export function shouldBootstrapSyndicationState(
  data: FirebaseFirestore.DocumentData
) {
  if (!isRealtimeEventVisible(data)) {
    return false;
  }

  return (
    readDateValue(data.syndicationCheckedAt) === null &&
    readDateValue(data.syndicationNextCheckAt) === null
  );
}

export function readDateValue(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime())
      ? converted
      : null;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function getSyndicationErrorCount(
  data: FirebaseFirestore.DocumentData
) {
  const value = data.syndicationErrorCount;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function computeNextSyndicationCheckAt({
  now,
  eventTime,
  errorCount = 0,
}: {
  now: Date;
  eventTime: Date | null;
  errorCount?: number;
}) {
  if (errorCount > 0) {
    if (errorCount <= 1) {
      return addHours(now, 6);
    }
    if (errorCount === 2) {
      return addHours(now, 12);
    }
    return addHours(now, 24);
  }

  if (!eventTime) {
    return addHours(now, 24);
  }

  const diffMs = eventTime.getTime() - now.getTime();

  if (diffMs <= 3 * DAY_MS) {
    return addHours(now, 12);
  }
  if (diffMs <= 14 * DAY_MS) {
    return addHours(now, 24);
  }
  return addHours(now, 72);
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}
