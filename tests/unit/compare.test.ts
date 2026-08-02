import { describe, expect, it } from "vitest";
import { compareBlueprints } from "@/lib/blueprint/compare";
import { makeMinimalBlueprint } from "../fixtures/minimal-blueprint";

describe("compareBlueprints", () => {
  it("detects identical snapshots", () => {
    const a = makeMinimalBlueprint();
    const b = makeMinimalBlueprint();
    const r = compareBlueprints(a, b);
    expect(r.identical).toBe(true);
    expect(r.summary.hashChanged).toBe(false);
  });

  it("detects title, tech and link diffs", () => {
    const left = makeMinimalBlueprint({
      meta: { ...makeMinimalBlueprint().meta, title: "A" },
      tech: [{ name: "React", confidence: "high", evidence: "x" }],
      links: [{ href: "https://a.example/", text: "a", internal: true }],
    });
    const right = makeMinimalBlueprint({
      id: "BLUEPRINT_other",
      contentHash: "different",
      meta: { ...makeMinimalBlueprint().meta, title: "B" },
      tech: [
        { name: "Vue.js", confidence: "high", evidence: "y" },
        { name: "React", confidence: "high", evidence: "x" },
      ],
      links: [
        { href: "https://a.example/", text: "a", internal: true },
        { href: "https://b.example/", text: "b", internal: false },
      ],
    });
    const r = compareBlueprints(left, right);
    expect(r.identical).toBe(false);
    expect(r.summary.titleChanged).toBe(true);
    expect(r.summary.hashChanged).toBe(true);
    expect(r.summary.techAdded).toContain("Vue.js");
    expect(r.summary.linkCountDelta).toBe(1);
    expect(r.changes.some((c) => c.path === "meta.title")).toBe(true);
  });
});
