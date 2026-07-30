import { describe, expect, it } from "vitest";
import { workspaceExportFilename } from "./workspace-export-filename";

describe("workspaceExportFilename", () => {
  it("creates a portable, dated JSON filename", () => {
    expect(
      workspaceExportFilename(
        "FC Zürich U16 / Saison 26–27",
        new Date("2026-07-29T12:00:00.000Z")
      )
    ).toBe("coachos-fc-zurich-u16-saison-26-27-2026-07-29.json");
  });

  it("falls back for names without portable characters", () => {
    expect(
      workspaceExportFilename("⚽️", new Date("2026-07-29T12:00:00.000Z"))
    ).toBe("coachos-workspace-2026-07-29.json");
  });
});
