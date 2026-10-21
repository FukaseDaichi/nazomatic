import { timingSafeEqual } from "node:crypto";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Route Handlers must authenticate even when middleware has not run. */
export function authorizeBlank25Editor(request: Request): Response | null {
  const user = process.env.BLANK25_EDITOR_USER;
  const password = process.env.BLANK25_EDITOR_PASSWORD;
  const headers = { "Cache-Control": "no-store" };
  if (!user || !password) {
    return new Response("BLANK25 editor auth is not configured.", {
      status: 503,
      headers,
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
        ...headers,
        "WWW-Authenticate": 'Basic realm="BLANK25 Editor", charset="UTF-8"',
      },
    });
  }

  if (MUTATION_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (
      (origin !== null && origin !== new URL(request.url).origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return new Response("Forbidden", { status: 403, headers });
    }
  }
  return null;
}
