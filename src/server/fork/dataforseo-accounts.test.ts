import { beforeEach, describe, expect, it, vi } from "vitest";

const envValues = new Map<string, string>();
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: (name: string) => Promise.resolve(envValues.get(name)),
}));

const {
  currentDataforseoAccountLabel,
  currentDataforseoProjectId,
  projectIdFromToolArgs,
  resolveForkDataforseoAccount,
  runWithDataforseoProject,
} = await import("./dataforseo-accounts");

describe("fork DataForSEO accounts", () => {
  beforeEach(() => {
    envValues.clear();
    envValues.set("FORK_DATAFORSEO_ACCOUNTS", JSON.stringify({ a: "key-a" }));
    envValues.set(
      "FORK_DATAFORSEO_PROJECT_ACCOUNTS",
      JSON.stringify({ p1: "a", p2: "missing" }),
    );
  });

  it("uses the default outside a project", async () => {
    expect(await resolveForkDataforseoAccount()).toBeNull();
    expect(await currentDataforseoAccountLabel()).toBe("default");
  });

  it("uses the mapped account inside a project, across awaits", async () => {
    await runWithDataforseoProject("p1", async () => {
      await Promise.resolve();
      expect(currentDataforseoProjectId()).toBe("p1");
      expect(await resolveForkDataforseoAccount()).toEqual({
        label: "a",
        apiKey: "key-a",
      });
    });
  });

  it("keeps concurrent projects apart", async () => {
    const seen = await Promise.all(
      ["p1", "p3"].map((id) =>
        runWithDataforseoProject(id, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return (await resolveForkDataforseoAccount())?.label ?? "default";
        }),
      ),
    );
    expect(seen).toEqual(["a", "default"]);
  });

  it("fails instead of falling back when a mapped key is missing", async () => {
    await runWithDataforseoProject("p2", async () => {
      await expect(resolveForkDataforseoAccount()).rejects.toThrow(
        /No DataForSEO key/,
      );
      expect(await currentDataforseoAccountLabel()).toBe("misconfigured");
    });
  });

  it("fails on invalid JSON", async () => {
    envValues.set("FORK_DATAFORSEO_PROJECT_ACCOUNTS", "{oops");
    await runWithDataforseoProject("p1", async () => {
      await expect(resolveForkDataforseoAccount()).rejects.toThrow(/JSON/);
    });
  });

  it("reads projectId from tool args", () => {
    expect(projectIdFromToolArgs({ projectId: "p1" })).toBe("p1");
    expect(projectIdFromToolArgs({})).toBeNull();
    expect(projectIdFromToolArgs(null)).toBeNull();
  });
});
