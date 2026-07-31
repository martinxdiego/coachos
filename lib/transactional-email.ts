import "server-only";

import { logger } from "@/lib/logger";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return replacements[character] ?? character;
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "CoachOS Passwort zurücksetzen",
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px">
            <h1 style="font-size:24px">Passwort zurücksetzen</h1>
            <p>Über diesen sicheren Link kannst du ein neues CoachOS-Passwort setzen. Der Link ist 30 Minuten gültig.</p>
            <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#059669;color:white;padding:12px 18px;border-radius:999px;text-decoration:none">Neues Passwort setzen</a></p>
            <p style="color:#64748b;font-size:13px">Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
          </div>
        `
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (response.ok) return true;
    logger.error("Password reset email provider rejected request", {
      status: response.status
    });
  } catch (error) {
    logger.error("Password reset email delivery failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
  }
  return false;
}

export async function sendEmailVerificationEmail(
  to: string,
  verificationUrl: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "CoachOS E-Mail bestätigen",
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px">
            <h1 style="font-size:24px">E-Mail bestätigen</h1>
            <p>Bestätige deine E-Mail-Adresse, um dein CoachOS-Konto zu aktivieren. Der Link ist 24 Stunden gültig.</p>
            <p><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;background:#059669;color:white;padding:12px 18px;border-radius:999px;text-decoration:none">E-Mail bestätigen</a></p>
            <p style="color:#64748b;font-size:13px">Wenn du kein CoachOS-Konto erstellt hast, kannst du diese E-Mail ignorieren.</p>
          </div>
        `
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (response.ok) return true;
    logger.error("Email verification provider rejected request", {
      status: response.status
    });
  } catch (error) {
    logger.error("Email verification delivery failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
  }
  return false;
}
