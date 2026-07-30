import type { NextAuthConfig } from "next-auth";

export function isPublicPathname(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password/") ||
    pathname.startsWith("/verify-email/") ||
    pathname === "/offline" ||
    pathname === "/offline.html" ||
    pathname === "/support" ||
    pathname === "/legal" ||
    pathname.startsWith("/legal/") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/join" ||
    pathname.startsWith("/join/") ||
    pathname === "/p" ||
    pathname.startsWith("/p/") ||
    pathname === "/player" ||
    pathname.startsWith("/player/") ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/stripe/webhook" ||
    pathname.startsWith("/api/player/session/") ||
    pathname === "/api/push/subscribe" ||
    pathname === "/api/push/daily" ||
    pathname === "/api/storage/retention" ||
    pathname === "/api/data/retention" ||
    pathname === "/api/health"
  );
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isPublicRoute = isPublicPathname(pathname);

      if (isPublicRoute) {
        if (
          isLoggedIn &&
          pathname === "/login" &&
          nextUrl.searchParams.get("reauth") !== "1"
        ) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.authVersion = (user as any).authVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).authVersion = token.authVersion as number;
      }
      return session;
    },
  },
  providers: [], // Configured in lib/auth.ts
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
