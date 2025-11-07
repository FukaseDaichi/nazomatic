import { NextResponse } from "next/server";

import { firestore } from "@/server/firebase/admin";
import type { CalendarApiResponse, CalendarEvent } from "@/types/calendar";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

const DEFAULT_QUERY = "#謎チケ売ります";
const DEFAULT_RANGE_DAYS = 28;
const MAX_RANGE_DAYS = 60;
const MAX_RESULTS = 500;

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = normalizeQuery(searchParams.get("query"));
    const rangeDaysParam = searchParams.get("rangeDays");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const rangeDays = clampRangeDays(rangeDaysParam);
    const { from, inclusiveTo } = buildDateRange({ fromParam, toParam, rangeDays });

    const snapshot = await buildFirestoreQuery({ query, from, inclusiveTo }).limit(MAX_RESULTS).get();

    const events: CalendarEvent[] = snapshot.docs
      .map((doc) => mapDocToCalendarEvent(doc))
      .filter((event): event is CalendarEvent => event !== null);

    const response: CalendarApiResponse = {
      query,
      from: from.toISOString(),
      to: inclusiveTo.toISOString(),
      generatedAt: new Date().toISOString(),
      events,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

function normalizeQuery(value: string | null): string {
  if (!value) {
    return DEFAULT_QUERY;
  }
  return value.trim() || DEFAULT_QUERY;
}

function clampRangeDays(value: string | null): number {
  if (!value) {
    return DEFAULT_RANGE_DAYS;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "rangeDays must be a positive number" },
      { status: 400 },
    );
  }
  return Math.min(Math.floor(parsed), MAX_RANGE_DAYS);
}

function buildDateRange({
  fromParam,
  toParam,
  rangeDays,
}: {
  fromParam: string | null;
  toParam: string | null;
  rangeDays: number;
}) {
  const now = new Date();
  const defaultFrom = startOfDay(now);

  const from = fromParam ? parseDateOrThrow(fromParam, "from") : defaultFrom;
  const start = startOfDay(from);

  let endExclusive: Date;
  if (toParam) {
    const parsedTo = parseDateOrThrow(toParam, "to");
    const end = startOfDay(parsedTo);
    endExclusive = addDays(end, 1);
  } else {
    endExclusive = addDays(start, rangeDays);
  }

  return {
    from: start,
    inclusiveTo: endExclusive,
  };
}

function buildFirestoreQuery({
  query,
  from,
  inclusiveTo,
}: {
  query: string;
  from: Date;
  inclusiveTo: Date;
}) {
  let ref = firestore.collection("realtimeEvents").where("eventTime", ">=", from).where("eventTime", "<", inclusiveTo).orderBy("eventTime", "asc");
  if (query) {
    ref = ref.where("sourceQuery", "==", query);
  }
  return ref;
}

function mapDocToCalendarEvent(doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>): CalendarEvent | null {
  const data = doc.data();
  const eventTime: FirebaseFirestore.Timestamp | undefined = data.eventTime;
  if (!eventTime) {
    return null;
  }

  const eventDate = eventTime.toDate();
  const capturedRaw = data.capturedAt;
  let capturedAtIso: string;
  if (capturedRaw instanceof Date) {
    capturedAtIso = capturedRaw.toISOString();
  } else if (capturedRaw?.toDate instanceof Function) {
    capturedAtIso = capturedRaw.toDate().toISOString();
  } else if (typeof capturedRaw === "string") {
    capturedAtIso = capturedRaw;
  } else {
    capturedAtIso = new Date().toISOString();
  }

  const priceData = data.price;
  const price =
    priceData && typeof priceData === "object"
      ? {
          amount: typeof priceData.amount === "number" ? priceData.amount : Number(priceData.amount) || 0,
          currency: typeof priceData.currency === "string" ? priceData.currency : "JPY",
          perUnit: typeof priceData.perUnit === "string" ? priceData.perUnit : undefined,
        }
      : null;

  return {
    id: doc.id,
    postId: data.postId ?? "",
    postURL: data.postURL ?? "",
    sourceQuery: data.sourceQuery ?? "",
    ticketTitle: data.ticketTitle ?? null,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    eventTime: eventDate.toISOString(),
    eventTimestamp: eventDate.getTime(),
    category: data.category ?? "unknown",
    price,
    quantity: typeof data.quantity === "number" ? data.quantity : null,
    deliveryMethod: typeof data.deliveryMethod === "string" ? data.deliveryMethod : null,
    location: typeof data.location === "string" ? data.location : null,
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    needsReview: Boolean(data.needsReview),
    rawPostText: typeof data.rawPostText === "string" ? data.rawPostText : "",
    author: {
      id: data.authorId ?? "",
      name: data.authorName ?? "",
      imageUrl: typeof data.authorImageUrl === "string" ? data.authorImageUrl : null,
    },
    capturedAt: capturedAtIso,
  };
}

function parseDateOrThrow(value: string, parameterName: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: `Invalid ${parameterName} parameter` },
      { status: 400 },
    );
  }
  return parsed;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function handleError(error: unknown) {
  if (error instanceof NextResponse || error instanceof Response) {
    return error;
  }

  console.error("Unexpected error while fetching calendar events", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Internal server error" },
    { status: 500 },
  );
}
