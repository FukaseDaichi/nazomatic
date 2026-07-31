import type { NormalizedRealtimeEvent } from "@/types/realtimeEvent";

export type CalendarEventCategory = NormalizedRealtimeEvent["category"];

export interface CalendarEventPrice {
  amount: number;
  currency: string;
  perUnit?: "ticket" | "pair";
}

export interface CalendarEventAuthor {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface CalendarEvent {
  id: string;
  postId: string;
  postURL: string;
  sourceQuery: string;
  ticketTitle: string | null;
  hashtags: string[];
  eventTime: string;
  eventTimestamp: number;
  category: CalendarEventCategory;
  price: CalendarEventPrice | null;
  quantity: number | null;
  deliveryMethod: string | null;
  location: string | null;
  confidence: number;
  needsReview: boolean;
  rawPostText: string;
  author: CalendarEventAuthor;
  capturedAt: string;
}

export interface CalendarApiResponse {
  query: string;
  from: string;
  to: string;
  generatedAt: string;
  /** API が 1 回で返す document 数の上限。 */
  limit: number;
  /**
   * Firestore の取得が `limit` に達したときに true。
   *
   * 判定は可視性フィルタ前の raw document 数で行うため、「未返却の event が
   * 残っている可能性がある」ことしか意味しません。非表示 document が多い場合は
   * `truncated: true` でも実際の取りこぼしが 0 件のことがあります。
   */
  truncated: boolean;
  events: CalendarEvent[];
}
