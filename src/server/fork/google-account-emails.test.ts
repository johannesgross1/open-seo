import { describe, expect, it, vi } from "vitest";
import {
  applyRememberedEmails,
  pickRememberedEmails,
} from "./google-account-emails";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: {} }));

describe("fork remembered Google account emails", () => {
  it("keeps the newest stored email per account", () => {
    const remembered = pickRememberedEmails([
      { accountId: "a", email: "old@example.com", updatedAt: "2026-11-01" },
      { accountId: "a", email: "new@example.com", updatedAt: "2026-11-20" },
      { accountId: "b", email: "b@example.com", updatedAt: null },
      { accountId: "c", email: null, updatedAt: "2026-11-20" },
      { accountId: null, email: "x@example.com", updatedAt: "2026-11-20" },
    ]);
    expect(Object.fromEntries(remembered)).toEqual({
      a: "new@example.com",
      b: "b@example.com",
    });
  });

  it("fills only missing emails and keeps live ones", () => {
    const accounts = [
      { accountId: "a", email: null, requiresReconnect: true },
      { accountId: "b", email: "live@example.com", requiresReconnect: false },
      { accountId: "c", email: null, requiresReconnect: true },
    ];
    const remembered = new Map([
      ["a", "stored@example.com"],
      ["b", "stale@example.com"],
    ]);
    expect(applyRememberedEmails(accounts, remembered)).toEqual([
      { accountId: "a", email: "stored@example.com", requiresReconnect: true },
      { accountId: "b", email: "live@example.com", requiresReconnect: false },
      { accountId: "c", email: null, requiresReconnect: true },
    ]);
  });
});
