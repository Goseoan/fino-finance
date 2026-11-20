import { NextRequest, NextResponse } from "next/server";
import { allowedHost } from "./lib/http";
export function proxy(req: NextRequest) {
  if (!allowedHost(req.headers))
    return NextResponse.json(
      { error: "로컬 앱 주소에서만 접근할 수 있습니다" },
      { status: 403 },
    );
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: "/api/:path*" };
