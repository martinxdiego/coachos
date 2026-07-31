"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSiteUrl, isProductionDeployment } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/transactional-email";

export type PasswordResetRequestState =
  | { status: "success"; developmentUrl?: string }
  | { status: "error"; message: string }
  | null;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(
  _state: PasswordResetRequestState,
  formData: FormData
): Promise<PasswordResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "success" };
  }

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  const [ipLimit, emailLimit] = await Promise.all([
    rateLimit(`password-reset-ip:${ip}`, 10, 60 * 60),
    rateLimit(`password-reset-email:${email}`, 3, 60 * 60)
  ]);
  if (!ipLimit.success || !emailLimit.success) {
    return { status: "success" };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true }
  });
  if (!user) return { status: "success" };

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    })
  ]);

  const resetUrl = `${getSiteUrl()}/reset-password/${token}`;
  const delivered = await sendPasswordResetEmail(user.email, resetUrl);
  return {
    status: "success",
    ...(!delivered && !isProductionDeployment()
      ? { developmentUrl: resetUrl }
      : {})
  };
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");
  if (
    token.length < 32 ||
    token.length > 128 ||
    password.length < 10 ||
    password.length > 128 ||
    password !== confirmation
  ) {
    throw new Error("Passwörter stimmen nicht überein oder sind zu kurz.");
  }

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true }
  });
  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt.getTime() <= Date.now()
  ) {
    throw new Error("Der Link ist ungültig oder abgelaufen.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.$transaction([
    db.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        authVersion: { increment: 1 },
        emailVerifiedAt: new Date()
      }
    }),
    db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    })
  ]);
  redirect("/login?reset=success");
}
