import type { RealtimePost } from "@/types/realtime";
import type { NormalizedRealtimeEvent, NormalizedRealtimeEventResult } from "@/types/realtimeEvent";

import { computeConfidence } from "./confidence";
import { parseJapaneseDate } from "./dateParser";
import {
  extractDeliveryMethod,
  extractLocation,
  extractPrice,
  extractQuantity,
  inferCategory,
  inferTicketTitle,
} from "./extractors";

export const RULESET_VERSION = "ruleset-v2025-11";

export interface NormalizePostContext {
  query: string;
  capturedAt: Date;
}

const NEEDS_REVIEW_THRESHOLD = 0.6;

export function normalizePost(post: RealtimePost, context: NormalizePostContext): NormalizedRealtimeEventResult {
  const baseCreatedAt = safeParseDate(post.createdAt) ?? context.capturedAt;
  const text = post.textPlain || post.text || "";

  const dateResult = parseJapaneseDate(text, { referenceDate: baseCreatedAt });
  const priceResult = extractPrice(text);
  const quantityResult = extractQuantity(text);
  const categoryResult = inferCategory(text);
  const locationResult = extractLocation(text);
  const deliveryMethod = extractDeliveryMethod(text);
  const ticketTitle = inferTicketTitle(text, post.hashtags);

  const confidence = computeConfidence({
    hasDate: Boolean(dateResult),
    hasTime: Boolean(dateResult?.hasTime),
    hasPrice: Boolean(priceResult),
    hasQuantity: Boolean(quantityResult),
    hasLocation: Boolean(locationResult),
    hasCategory: categoryResult.category !== "unknown",
  });

  const needsReview = !dateResult || confidence < NEEDS_REVIEW_THRESHOLD;

  const event: NormalizedRealtimeEvent = {
    postId: post.id,
    postURL: post.url,
    hashtags: post.hashtags,
    createdAt: baseCreatedAt,
    authorId: post.author.id,
    authorName: post.author.name || post.author.screenName || "",
    authorImageUrl: post.author.profileImageUrl ?? null,
    rawPostText: text,
    eventTime: dateResult ? dateResult.date : null,
    eventDateResolution: dateResult ? dateResult.resolution : "unresolved",
    ticketTitle,
    category: categoryResult.category,
    price: priceResult?.price ?? null,
    quantity: quantityResult?.quantity ?? null,
    deliveryMethod,
    location: locationResult?.location ?? null,
    sourceQuery: context.query,
    capturedAt: context.capturedAt,
    normalizationEngine: RULESET_VERSION,
    confidence,
    notes: buildNotes({ dateResult, priceResult, quantityResult, locationResult }),
    needsReview,
    reviewStatus: "pending" as const,
    lastReviewedAt: null,
  };

  return {
    event,
    diagnostics: {
      matchedDateText: dateResult?.matchedText,
      hasTime: Boolean(dateResult?.hasTime),
      matchedPriceText: priceResult?.matchedText,
      matchedQuantityText: quantityResult?.matchedText,
      matchedLocationText: locationResult?.matchedText ?? null,
    },
  };
}

function safeParseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildNotes({
  dateResult,
  priceResult,
  quantityResult,
  locationResult,
}: {
  dateResult: ReturnType<typeof parseJapaneseDate> | null;
  priceResult: ReturnType<typeof extractPrice>;
  quantityResult: ReturnType<typeof extractQuantity>;
  locationResult: ReturnType<typeof extractLocation>;
}): string | null {
  const notes: string[] = [];

  if (dateResult?.notes) {
    notes.push(dateResult.notes);
  }
  if (priceResult) {
    notes.push(`price="${priceResult.matchedText}"`);
  }
  if (quantityResult) {
    notes.push(`quantity="${quantityResult.matchedText}"`);
  }
  if (locationResult) {
    notes.push(`location="${locationResult.matchedText}"`);
  }

  return notes.length ? notes.join(" | ") : null;
}
