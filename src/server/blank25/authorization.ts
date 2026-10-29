import { timingSafeEqual } from "node:crypto";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const NO_STORE = { "Cache-Control": "no-store" };

/** Shared by the proxy and Route Handlers: 503 when unconfigured, 401 on bad Basic credentials. */
export function authenticateBlank25Editor(request: Request): Response | null {
  const user = process.env.BLANK25_EDITOR_USER;
  const password = process.env.BLANK25_EDITOR_PASSWORD;
  if (!user || !password) {
    return new Response("BLANK25 editor auth is not configured.", {
      status: 503,
      headers: NO_STORE,
    });
  }

  const authorization = request.headers.get("authorization");
  let credentials: Buffer | undefined;
  if (authorization?.startsWith("Basic ")) {
    try {
      // atob rejects malformed base64; Buffer.from alone silently accepts it.
      credentials = Buffer.from(atob(authorization.slice(6).trim()), "latin1");
    } catch {
      // Malformed credentials are treated as unauthenticated.
    }
  }
  const expected = Buffer.from(`${user}:${password}`, "utf8");
  if (
    !credentials ||
    credentials.length !== expected.length ||
    !timingSafeEqual(credentials, expected)
  ) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        ...NO_STORE,
        "WWW-Authenticate": 'Basic realm="BLANK25 Editor", charset="UTF-8"',
      },
    });
  }
  return null;
}

/** Rejects cross-origin mutations; non-mutation methods always pass. */
export function rejectCrossOriginMutation(request: Request): Response | null {
  if (MUTATION_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (
      (origin !== null && origin !== new URL(request.url).origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return new Response("Forbidden", { status: 403, headers: NO_STORE });
    }
  }
  return null;
}

/** Route Handlers must authenticate even when the proxy has not run. */
export function authorizeBlank25Editor(request: Request): Response | null {
  return authenticateBlank25Editor(request) ?? rejectCrossOriginMutation(request);
}
