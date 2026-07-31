import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function loginRedirect(status: "success" | "invalid") {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/login?verification=${status}` }
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (token.length < 32 || token.length > 128) {
    return loginRedirect("invalid");
  }
  const verification = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true }
  });
  if (
    !verification ||
    verification.usedAt ||
    verification.expiresAt.getTime() <= Date.now()
  ) {
    return loginRedirect("invalid");
  }

  await db.$transaction([
    db.user.update({
      where: { id: verification.userId },
      data: { emailVerifiedAt: new Date() }
    }),
    db.emailVerificationToken.update({
      where: { id: verification.id },
      data: { usedAt: new Date() }
    })
  ]);
  return loginRedirect("success");
}
