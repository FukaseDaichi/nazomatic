import { NextResponse } from "next/server";

import {
  fetchBlank25ManifestFile,
  GitHubApiError,
  loadBlank25GitHubConfig,
} from "@/server/blank25/github";
import { parseBlank25ManifestText } from "@/server/blank25/manifest-editor";

export const runtime = "nodejs";

type ManifestResponse =
  | {
      ok: true;
      manifestSha: string;
      manifest: ReturnType<typeof parseBlank25ManifestText>;
    }
  | {
      ok: false;
      error: string;
    };

export async function GET() {
  try {
    const config = loadBlank25GitHubConfig();
    const { manifestText, manifestSha } = await fetchBlank25ManifestFile(config);
    const manifest = parseBlank25ManifestText(manifestText);

    return NextResponse.json<ManifestResponse>({
      ok: true,
      manifestSha,
      manifest,
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json<ManifestResponse>(
        {
          ok: false,
          error: `GitHub request failed (${error.status}).`,
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
