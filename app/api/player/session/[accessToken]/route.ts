import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  issuePlayerSession,
  PLAYER_SESSION_COOKIE,
  playerSessionCookieOptions
} from "@/lib/player-session";
import { rateLimit } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirectToPlayer(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path }
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  const { accessToken } = await params;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const limit = await rateLimit(`player-session:${ip}`, 20, 60);
  if (!limit.success) {
    return new NextResponse("Zu viele Versuche.", {
      status: 429,
      headers: { "Cache-Control": "no-store" }
    });
  }
  if (!UUID_RE.test(accessToken)) {
    return redirectToPlayer("/player/access?error=invalid");
  }

  const player = await db.player.findUnique({
    where: { accessToken },
    select: { id: true, workspaceId: true }
  });
  if (!player) {
    return redirectToPlayer("/player/access?error=invalid");
  }

  const session = await issuePlayerSession(
    player.id,
    request.headers.get("user-agent")
  );
  await recordAuditEvent({
    workspaceId: player.workspaceId,
    event: "player.session.created",
    actorPlayerId: player.id,
    targetType: "PlayerPortalSession",
    targetId: session.id
  });

  // Keep the redirect relative so the browser cannot cross from the request
  // host to a differently configured canonical host and lose this host-only
  // session cookie (for example 127.0.0.1 -> localhost in local/staging tests).
  const response = redirectToPlayer("/player");
  response.cookies.set(
    PLAYER_SESSION_COOKIE,
    session.token,
    playerSessionCookieOptions()
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
