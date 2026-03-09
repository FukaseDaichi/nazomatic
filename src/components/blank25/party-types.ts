export type Blank25PartyParticipantKind = "group" | "person";

export type Blank25PartyLegacyParticipantV1 = {
  id: string;
  name: string;
  kind: Blank25PartyParticipantKind;
  score: number;
  createdAt: number;
  updatedAt: number;
};

export type Blank25PartyParticipant = {
  id: string;
  name: string;
  kind: Blank25PartyParticipantKind;
  score: number;
  iconDataUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Blank25PartyScoreEventMode = "delta" | "set";

export type Blank25PartyScoreEvent = {
  id: string;
  participantId: string;
  mode: Blank25PartyScoreEventMode;
  delta: number;
  fromScore: number;
  toScore: number;
  createdAt: number;
};

export type Blank25PartyLegacyStateV1 = {
  version: 1;
  updatedAt: number;
  participants: Blank25PartyLegacyParticipantV1[];
  events: Blank25PartyScoreEvent[];
};

export type Blank25PartyPersistedStateV2 = {
  version: 2;
  updatedAt: number;
  participants: Blank25PartyParticipant[];
  events: Blank25PartyScoreEvent[];
};

export type Blank25PartyPersistedState = Blank25PartyPersistedStateV2;

export type Blank25PartyLoadResult = {
  state: Blank25PartyPersistedState;
  recoveredFromInvalidData: boolean;
};
