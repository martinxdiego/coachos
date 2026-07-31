import NextAuth from "next-auth";
import { authConfig, isPublicPathname } from "./lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { edgeRateLimit } from "./lib/edge-rate-limit";

const { auth } = NextAuth(authConfig);

export default auth(async function middleware(req: NextRequest) {
  const ip = (req as any).ip || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const path = req.nextUrl.pathname;
  const isLoggedIn = Boolean((req as NextRequest & { auth?: unknown }).auth);
  const isPublicRoute = isPublicPathname(path);

  // Auth.js v5's custom middleware wrapper does not use the `authorized`
  // callback as the final response gate. Enforce the same boundary here so a
  // later `NextResponse.next()` can never make a protected route public.
  if (!isLoggedIn && !isPublicRoute) {
    if (path === "/api" || path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }

    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && path === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (
    path.startsWith("/api/push") ||
    path === "/api/health" ||
    req.method === "POST"
  ) {
    const limitResult = await edgeRateLimit(ip, 60, 60);
    if (!limitResult.success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": Math.max(
            1,
            Math.ceil((limitResult.reset - Date.now()) / 1000)
          ).toString(),
        },
      });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
