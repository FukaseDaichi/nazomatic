import { NextRequest, NextResponse } from "next/server";

const REALM = "BLANK25 Editor";
const API_PREFIX = "/api/internal/blank25/editor";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const unauthorized = () =>
  new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });

const parseBasicAuth = (
  authorizationHeader: string | null,
): { user: string; password: string } | null => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
    return null;
  }

  const encoded = authorizationHeader.slice("Basic ".length).trim();
  if (!encoded) {
    return null;
  }

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }

  const separator = decoded.indexOf(":");
  if (separator < 0) {
    return null;
  }

  return {
    user: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
};

export function middleware(request: NextRequest) {
  const expectedUser = process.env.BLANK25_EDITOR_USER;
  const expectedPassword = process.env.BLANK25_EDITOR_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new NextResponse("BLANK25 editor auth is not configured.", {
      status: 503,
    });
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));
  if (
    !credentials ||
    credentials.user !== expectedUser ||
    credentials.password !== expectedPassword
  ) {
    return unauthorized();
  }

  const path = request.nextUrl.pathname;
  if (path.startsWith(API_PREFIX) && MUTATION_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/blank25/editor/:path*", "/api/internal/blank25/editor/:path*"],
};
