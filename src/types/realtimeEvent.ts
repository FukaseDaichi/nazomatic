export type RealtimeEventCategory = "sell" | "buy" | "exchange" | "unknown";

export type RealtimeEventDateResolution = "exact" | "date_only" | "inferred" | "unresolved";

export interface RealtimeEventPrice {
  amount: number;
  currency: string;
  perUnit?: "ticket" | "pair";
}

export interface NormalizedRealtimeEvent {
  postId: string;
  postURL: string;
  hashtags: string[];
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorImageUrl: string | null;
  rawPostText: string;
  eventTime: Date | null;
  eventDateResolution: RealtimeEventDateResolution;
  ticketTitle: string | null;
  category: RealtimeEventCategory;
  price: RealtimeEventPrice | null;
  quantity: number | null;
  deliveryMethod: string | null;
  location: string | null;
  sourceQuery: string;
  capturedAt: Date;
  normalizationEngine: string;
  confidence: number;
  notes: string | null;
  needsReview: boolean;
  reviewStatus: "pending" | "approved" | "rejected";
  lastReviewedAt: Date | null;
}

export interface NormalizationDiagnostics {
  matchedDateText?: string;
  hasTime: boolean;
  matchedPriceText?: string;
  matchedQuantityText?: string;
  matchedLocationText?: string;
}

export interface NormalizedRealtimeEventResult {
  event: NormalizedRealtimeEvent;
  diagnostics: NormalizationDiagnostics;
}
