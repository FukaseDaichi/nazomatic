export type Blank25Category = {
  id: string;
  name: string;
  description: string;
  color: string;
  problems: Blank25Problem[];
};

export type Blank25Manifest = {
  version: number;
  categories: Blank25Category[];
};

export type Blank25Problem = {
  id: string;
  linkName: string;
  imageFile: string;
  answers: string[];
};

export type Blank25PersistedStateV1 = {
  version: 1;
  openedPanels: boolean[];
  openedHistory: number[];
  startedAt: number;
  solvedAt: number | null;
  isCorrect: boolean;
  score: number | null;
};

