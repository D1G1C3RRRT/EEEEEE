import { describe, expect, it } from "vitest";
import { compareBlueprints } from "@/lib/blueprint/compare";
import { makeMinimalBlueprint } from "../fixtures/minimal-blueprint";

describe("compareBlueprints · extended", () => {
  it("tracks asset and page count deltas", () => {
    const left = makeMinimalBlueprint({
      assets: [{ url: "https://a/1.png", type: "image" }],
      pages: [],
      stats: {
        ...makeMinimalBlueprint().stats,
        pageCount: 1,
        assetCount: 1,
      },
    });
    const right = makeMinimalBlueprint({
      id: "RIGHT",
      assets: [
        { url: "https://a/1.png", type: "image" },
        { url: "https://a/2.png", type: "image" },
      ],
      pages: [
        {
          url: "https://a/about",
          title: "About",
          contentHash: "x",
          statusCode: 200,
          htmlBytes: 10,
          headings: [],
          internalLinkCount: 0,
          formCount: 0,
        },
      ],
      stats: {
        ...makeMinimalBlueprint().stats,
        pageCount: 2,
        assetCount: 2,
      },
      links: [
        ...makeMinimalBlueprint().links,
        { href: "https://a/about", text: "About", internal: true },
      ],
    });
    const result = compareBlueprints(left, right);
    expect(result.summary.assetCountDelta).toBe(1);
    expect(result.summary.pageCountDelta).toBe(1);
    expect(result.summary.linkCountDelta).toBeGreaterThanOrEqual(1);
    expect(result.changes.some((c) => c.path === "assets" && c.kind === "added")).toBe(
      true,
    );
  });

  it("reports description change", () => {
    const left = makeMinimalBlueprint();
    const right = makeMinimalBlueprint({
      meta: { ...left.meta, description: "Changed description text" },
    });
    const result = compareBlueprints(left, right);
    expect(result.identical).toBe(false);
    expect(result.changes.some((c) => c.path === "meta.description")).toBe(true);
  });
});
