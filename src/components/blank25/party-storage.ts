import type {
  Blank25PartyLoadResult,
  Blank25PartyLegacyParticipantV1,
  Blank25PartyLegacyStateV1,
  Blank25PartyParticipant,
  Blank25PartyPersistedState,
  Blank25PartyScoreEvent,
} from "@/components/blank25/party-types";

export const BLANK25_PARTY_STORAGE_KEY = "blank25:party-score:v2:default";
export const BLANK25_PARTY_LEGACY_STORAGE_KEY =
  "blank25:party-score:v1:default";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isParticipantKind = (value: unknown): value is "group" | "person" =>
  value === "group" || value === "person";

const isLegacyPartyParticipant = (
  value: unknown,
): value is Blank25PartyLegacyParticipantV1 => {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isParticipantKind(value.kind) &&
    isFiniteNumber(value.score) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt)
  );
};

const isPartyParticipant = (
  value: unknown,
): value is Blank25PartyParticipant => {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isParticipantKind(value.kind) &&
    isFiniteNumber(value.score) &&
    isNullableString(value.iconDataUrl) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt)
  );
};

const isPartyScoreEvent = (value: unknown): value is Blank25PartyScoreEvent => {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.participantId === "string" &&
    (value.mode === "delta" || value.mode === "set") &&
    isFiniteNumber(value.delta) &&
    isFiniteNumber(value.fromScore) &&
    isFiniteNumber(value.toScore) &&
    isFiniteNumber(value.createdAt)
  );
};

const isLegacyPartyState = (value: unknown): value is Blank25PartyLegacyStateV1 => {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isFiniteNumber(value.updatedAt)) return false;
  if (!Array.isArray(value.participants) || !Array.isArray(value.events)) {
    return false;
  }

  return (
    value.participants.every((participant) => isLegacyPartyParticipant(participant)) &&
    value.events.every((event) => isPartyScoreEvent(event))
  );
};

const isPartyState = (
  value: unknown,
): value is Blank25PartyPersistedState => {
  if (!isRecord(value)) return false;
  if (value.version !== 2) return false;
  if (!isFiniteNumber(value.updatedAt)) return false;
  if (!Array.isArray(value.participants) || !Array.isArray(value.events)) {
    return false;
  }

  return (
    value.participants.every((participant) => isPartyParticipant(participant)) &&
    value.events.every((event) => isPartyScoreEvent(event))
  );
};

export const createBlank25PartyState = (
  timestamp = 0,
): Blank25PartyPersistedState => ({
  version: 2,
  updatedAt: timestamp,
  participants: [],
  events: [],
});

const migrateLegacyState = (
  legacyState: Blank25PartyLegacyStateV1,
): Blank25PartyPersistedState => ({
  version: 2,
  updatedAt: legacyState.updatedAt,
  participants: legacyState.participants.map((participant) => ({
    ...participant,
    iconDataUrl: null,
  })),
  events: legacyState.events,
});

export const coerceBlank25PartyScore = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
};

export const createBlank25PartyId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `party-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const loadBlank25PartyState = (): Blank25PartyLoadResult => {
  if (typeof window === "undefined") {
    return {
      state: createBlank25PartyState(),
      recoveredFromInvalidData: false,
    };
  }

  const currentRawValue = window.localStorage.getItem(BLANK25_PARTY_STORAGE_KEY);
  const legacyRawValue = window.localStorage.getItem(
    BLANK25_PARTY_LEGACY_STORAGE_KEY,
  );

  const rawValue = currentRawValue ?? legacyRawValue;
  if (!rawValue) {
    return {
      state: createBlank25PartyState(Date.now()),
      recoveredFromInvalidData: false,
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (isPartyState(parsed)) {
      return {
        state: parsed,
        recoveredFromInvalidData: false,
      };
    }

    if (isLegacyPartyState(parsed)) {
      return {
        state: migrateLegacyState(parsed),
        recoveredFromInvalidData: false,
      };
    }

    window.localStorage.removeItem(BLANK25_PARTY_STORAGE_KEY);
    window.localStorage.removeItem(BLANK25_PARTY_LEGACY_STORAGE_KEY);
    return {
      state: createBlank25PartyState(Date.now()),
      recoveredFromInvalidData: true,
    };
  } catch {
    window.localStorage.removeItem(BLANK25_PARTY_STORAGE_KEY);
    window.localStorage.removeItem(BLANK25_PARTY_LEGACY_STORAGE_KEY);
    return {
      state: createBlank25PartyState(Date.now()),
      recoveredFromInvalidData: true,
    };
  }
};

export const saveBlank25PartyState = (
  state: Blank25PartyPersistedState,
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BLANK25_PARTY_STORAGE_KEY, JSON.stringify(state));
  window.localStorage.removeItem(BLANK25_PARTY_LEGACY_STORAGE_KEY);
};

export const clearBlank25PartyState = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BLANK25_PARTY_STORAGE_KEY);
  window.localStorage.removeItem(BLANK25_PARTY_LEGACY_STORAGE_KEY);
};
