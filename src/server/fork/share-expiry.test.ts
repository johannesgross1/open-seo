import { describe, expect, it } from "vitest";
import { isShareExpired, shareTtlHours } from "./share-expiry";

describe("shareTtlHours", () => {
  it("reads the hour marker from the project name", () => {
    expect(shareTtlHours("Nachrichten [24h]")).toBe(24);
    expect(shareTtlHours("[48H] Drafts")).toBe(48);
  });

  it("ignores projects without a marker or with zero hours", () => {
    expect(shareTtlHours("Client project")).toBeNull();
    expect(shareTtlHours("Drafts [0h]")).toBeNull();
    expect(shareTtlHours(null)).toBeNull();
  });
});

describe("isShareExpired", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");

  it("never expires links outside opted-in projects", () => {
    expect(
      isShareExpired(
        { projectName: "Client project", sharedAt: "2020-01-01T00:00:00Z" },
        now,
      ),
    ).toBe(false);
  });

  it("keeps a link inside its window", () => {
    expect(
      isShareExpired(
        { projectName: "Mails [24h]", sharedAt: "2026-11-26T12:00:01.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("expires a link once the window has passed", () => {
    expect(
      isShareExpired(
        { projectName: "Mails [24h]", sharedAt: "2026-11-26T12:00:00.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("treats a missing or broken mint time as expired", () => {
    expect(
      isShareExpired({ projectName: "Mails [24h]", sharedAt: null }, now),
    ).toBe(true);
    expect(
      isShareExpired({ projectName: "Mails [24h]", sharedAt: "x" }, now),
    ).toBe(true);
  });
});
