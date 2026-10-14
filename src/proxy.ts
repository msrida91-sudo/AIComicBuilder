import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Also reject browser cross-site requests and DNS rebinding.
// The listener must still bind only to loopback.
export default function proxy(request: NextRequest) {
  let host: URL;
  try {
    host = new URL("http://" + request.headers.get("host"));
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!LOOPBACK.has(host.hostname) || request.headers.get("sec-fetch-site") === "cross-site") {
    return new NextResponse("Local single-user access only", { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      if (!LOOPBACK.has(source.hostname) || source.host !== host.host ||
          source.protocol !== request.nextUrl.protocol) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    } catch {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }
  return request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.next()
    : intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/api/:path*"],
};
