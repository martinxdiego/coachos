import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertTrainingImageWorkspaceCapacity,
  countWorkspaceTrainingImages
} from "./storage-quota";

function reader(imageUrls: string[][]) {
  return {
    trainingPhase: {
      findMany: vi
        .fn()
        .mockResolvedValue(imageUrls.map((urls) => ({ imageUrls: urls })))
    }
  };
}

describe("training image workspace quota", () => {
  it("counts unique, workspace-bound Storage objects", async () => {
    const client = reader([
      [
        "workspace-a/training/one.webp",
        "workspace-a/training/one.webp"
      ],
      [
        "workspace-a/training/two.webp",
        "workspace-b/training/foreign.webp"
      ]
    ]);

    await expect(
      countWorkspaceTrainingImages(client as never, "workspace-a")
    ).resolves.toBe(2);
  });

  it("rejects the next upload once 500 objects are referenced", async () => {
    const references = Array.from(
      { length: 500 },
      (_, index) => `workspace-a/training/${index}.webp`
    );
    const client = reader([references]);

    await expect(
      assertTrainingImageWorkspaceCapacity(
        client as never,
        "workspace-a"
      )
    ).rejects.toThrow(
      "Team-Limit von 500 Trainingsbildern ist erreicht"
    );
    await expect(
      assertTrainingImageWorkspaceCapacity(
        client as never,
        "workspace-a",
        0
      )
    ).resolves.toBeUndefined();
  });
});
