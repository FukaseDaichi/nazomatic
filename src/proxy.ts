import { NextRequest, NextResponse } from "next/server";

import {
  authenticateBlank25Editor,
  rejectCrossOriginMutation,
} from "@/server/blank25/authorization";

const API_PREFIX = "/api/internal/blank25/editor";

export function proxy(request: NextRequest) {
  const denied =
    authenticateBlank25Editor(request) ??
    (request.nextUrl.pathname.startsWith(API_PREFIX)
      ? rejectCrossOriginMutation(request)
      : null);

  return denied ?? NextResponse.next();
}

export const config = {
  matcher: ["/blank25/editor/:path*", "/api/internal/blank25/editor/:path*"],
};
