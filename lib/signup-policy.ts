import { timingSafeEqual } from "node:crypto";

export function isSignupCodeAccepted(
  candidate: string,
  configuredCode: string | undefined
) {
  const expected = configuredCode?.trim();
  if (!expected) return true;

  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
