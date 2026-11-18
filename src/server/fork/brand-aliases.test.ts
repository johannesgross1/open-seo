import { describe, expect, it } from "vitest";
import {
  aiBrandNames,
  aiPromptIsBranded,
} from "@/server/features/ai-visibility/services/aiVisibilityMatching";
import { brandAliases } from "./brand-aliases";

const own = { name: "Acme | Acme Summit", domain: "acme.com", own: true };

describe("fork brand aliases", () => {
  it("splits a brand name on |", () => {
    expect(brandAliases("Acme | Acme Summit |  ")).toEqual([
      "Acme",
      "Acme Summit",
    ]);
    expect(brandAliases("Acme")).toEqual(["Acme"]);
  });

  it("matches every alias of the own brand", () => {
    expect(aiBrandNames(own)).toEqual(["Acme", "acme.com", "Acme Summit"]);
  });

  it("keeps a competitor's name whole", () => {
    expect(
      aiBrandNames({ name: "Foo | Bar", domain: "foo.com", own: false }),
    ).toEqual(["Foo | Bar", "foo.com"]);
  });

  it("treats a prompt naming an alias as branded", () => {
    expect(aiPromptIsBranded("Is the Acme Summit worth it?", own)).toBe(true);
    expect(aiPromptIsBranded("Which summits are worth it?", own)).toBe(false);
  });
});
