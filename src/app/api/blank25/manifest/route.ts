import { NextResponse } from "next/server";

import {
  fetchManifestFromRaw,
  GitHubApiError,
  loadBlank25StorageConfig,
} from "@/server/blank25/github";
import { parseBlank25ManifestText } from "@/server/blank25/manifest-editor";
import type { Blank25Manifest } from "@/components/blank25/types";

export const runtime = "nodejs";

type ManifestResponse =
  | {
      ok: true;
      manifest: Blank25Manifest;
    }
  | {
      ok: false;
      error: string;
    };

export async function GET() {
  try {
    const config = loadBlank25StorageConfig();
    const manifestText = await fetchManifestFromRaw(config);
    const manifest = parseBlank25ManifestText(manifestText);

    return NextResponse.json<ManifestResponse>(
      { ok: true, manifest },
      {
        headers: {
          // クライアントキャッシュは 0、サーバー側でも毎回 raw URL から取得する
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json<ManifestResponse>(
        {
          ok: false,
          error: `Failed to fetch manifest (${error.status}).`,
        },
        { status: 502 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json<ManifestResponse>(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json<ManifestResponse>(
      { ok: false, error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
