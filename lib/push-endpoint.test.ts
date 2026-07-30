import { describe, expect, it } from "vitest";
import { isTrustedPushEndpoint } from "./push-endpoint";

describe("isTrustedPushEndpoint", () => {
  it("accepts mainstream browser push services", () => {
    expect(
      isTrustedPushEndpoint("https://fcm.googleapis.com/fcm/send/device")
    ).toBe(true);
    expect(
      isTrustedPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/device"
      )
    ).toBe(true);
    expect(
      isTrustedPushEndpoint("https://web.push.apple.com/QD/device")
    ).toBe(true);
    expect(
      isTrustedPushEndpoint(
        "https://wns2-am3p.notify.windows.com/w/?token=device"
      )
    ).toBe(true);
  });

  it("rejects arbitrary hosts, credentials and non-standard ports", () => {
    expect(isTrustedPushEndpoint("https://attacker.example/push")).toBe(false);
    expect(
      isTrustedPushEndpoint("https://user:password@fcm.googleapis.com/push")
    ).toBe(false);
    expect(
      isTrustedPushEndpoint("https://fcm.googleapis.com:8443/push")
    ).toBe(false);
    expect(isTrustedPushEndpoint("http://fcm.googleapis.com/push")).toBe(false);
  });
});
