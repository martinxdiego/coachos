import { afterEach, describe, expect, it, vi } from "vitest";
import { createQrCodeDataUrl } from "@/components/qr-code";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createQrCodeDataUrl", () => {
  it("erzeugt den QR-Code lokal, ohne den Inhalt per fetch zu versenden", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const dataUrl = await createQrCodeDataUrl(
      "https://coachos.example/join/private-token",
      240
    );

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("weist leere Inhalte zurück", async () => {
    await expect(createQrCodeDataUrl("   ")).rejects.toThrow(
      "QR-Code-Inhalt fehlt"
    );
  });
});
