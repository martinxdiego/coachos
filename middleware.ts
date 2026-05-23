import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "./lib/rate-limit";

const { auth } = NextAuth(authConfig);

export default auth(async function middleware(req: NextRequest) {
  const ip = (req as any).ip || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/trpc") || path.startsWith("/api/push") || req.method === "POST") {
    const limitResult = await rateLimit(ip, 60, 60);
    if (!limitResult.success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((limitResult.reset - Date.now()) / 1000).toString(),
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
