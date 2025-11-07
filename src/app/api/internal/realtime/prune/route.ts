import { NextResponse } from "next/server";

import { firestore } from "@/server/firebase/admin";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

const DEFAULT_CUTOFF_DAYS = 1;
const MAX_CUTOFF_DAYS = 30;
const MAX_BATCHES = 20;
const BATCH_SIZE = 500;

type PruneRequest = {
  cutoffDays?: number;
  dryRun?: boolean;
};

type PruneResponse = {
  cutoffIso: string;
  dryRun: boolean;
  deleted: number;
  checked: number;
  batches: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    enforceAuthorization(request);

    const body = await parseBody(request);
    const params = validateParams(body);

    const cutoffDate = getCutoffDate(params.cutoffDays);
    const cutoffIso = cutoffDate.toISOString();

    let totalChecked = 0;
    let totalDeleted = 0;
    let batches = 0;

    const collection = firestore.collection("realtimeEvents");

    while (batches < MAX_BATCHES) {
      batches += 1;
      const snapshot = await collection
        .where("eventTime", "<", cutoffDate)
        .orderBy("eventTime", "asc")
        .limit(BATCH_SIZE)
        .get();

      if (snapshot.empty) {
        batches -= 1;
        break;
      }

      totalChecked += snapshot.size;

      if (params.dryRun) {
        continue;
      }

      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += snapshot.size;

      if (snapshot.size < BATCH_SIZE) {
        break;
      }
    }

    return NextResponse.json<PruneResponse>({
      cutoffIso,
      dryRun: params.dryRun,
      deleted: params.dryRun ? 0 : totalDeleted,
      checked: totalChecked,
      batches,
    });
  } catch (error) {
    return handleError(error);
  }
}

function enforceAuthorization(request: Request) {
  const expected = process.env.REALTIME_INTERNAL_API_TOKEN;
  if (!expected) {
    console.error("REALTIME_INTERNAL_API_TOKEN is not set");
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization");
  if (!header || header !== `Bearer ${expected}`) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }
}

async function parseBody(request: Request): Promise<PruneRequest> {
  if (request.body === null) {
    return {};
  }

  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") {
      return parsed as PruneRequest;
    }
    throw new Error("Body must be an object");
  } catch {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }
}

function validateParams(params: PruneRequest): Required<PruneRequest> {
  const cutoffDaysRaw = params.cutoffDays;
  if (cutoffDaysRaw !== undefined) {
    if (typeof cutoffDaysRaw !== "number" || !Number.isFinite(cutoffDaysRaw) || cutoffDaysRaw <= 0) {
      throw NextResponse.json<RealtimeApiErrorResponse>(
        { error: "cutoffDays must be a positive number" },
        { status: 400 },
      );
    }
  }

  const normalizedCutoffDays = cutoffDaysRaw ? Math.min(cutoffDaysRaw, MAX_CUTOFF_DAYS) : DEFAULT_CUTOFF_DAYS;
  const dryRun = Boolean(params.dryRun);

  return {
    cutoffDays: normalizedCutoffDays,
    dryRun,
  };
}

function getCutoffDate(days: number): Date {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - Math.floor(days));
  return cutoff;
}

function handleError(error: unknown) {
  if (error instanceof NextResponse || error instanceof Response) {
    return error;
  }

  console.error("Failed to prune realtime events", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Internal server error" },
    { status: 500 },
  );
}
