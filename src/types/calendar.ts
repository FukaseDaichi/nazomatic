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
  events: CalendarEvent[];
}
