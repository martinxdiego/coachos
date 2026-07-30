import { describe, expect, it } from "vitest";
import { normalizeDatabaseCaCert } from "@/lib/database-ca";

describe("normalizeDatabaseCaCert", () => {
  it("normalizes escaped PEM line breaks", () => {
    expect(
      normalizeDatabaseCaCert(
        "  -----BEGIN CERTIFICATE-----\\nYWJj\\r\\n-----END CERTIFICATE-----  "
      )
    ).toBe(
      "-----BEGIN CERTIFICATE-----\nYWJj\n-----END CERTIFICATE-----"
    );
  });

  it("keeps multiline PEM content and trims surrounding whitespace", () => {
    expect(
      normalizeDatabaseCaCert(`
-----BEGIN CERTIFICATE-----
YWJj
-----END CERTIFICATE-----
`)
    ).toBe(
      "-----BEGIN CERTIFICATE-----\nYWJj\n-----END CERTIFICATE-----"
    );
  });
});
