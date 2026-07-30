import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { DUMMY_PASSWORD_HASH } from "./password";

describe("dummy credential hash", () => {
  it("is a valid cost-10 bcrypt hash that never matches a user password", async () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/);
    await expect(
      bcrypt.compare("definitely-not-the-dummy-value", DUMMY_PASSWORD_HASH)
    ).resolves.toBe(false);
  });
});
