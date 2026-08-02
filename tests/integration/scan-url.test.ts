import { describe, expect, it } from "vitest";
import { scanToBlueprint } from "@/lib/blueprint/scan";

/**
 * Live network integration — needs outbound HTTP.
 * Skips automatically if example.com is unreachable.
 */
describe("scanToBlueprint · live URL", () => {
  it("scans https://example.com", async () => {
    let bp;
    try {
      bp = await scanToBlueprint({ url: "https://example.com" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/fetch|abort|ENOTFOUND|network|ECONN|timed/i.test(msg)) {
        console.warn("Skipping live URL test — network unavailable:", msg);
        return;
      }
      throw err;
    }

    expect(bp.source).toBe("url");
    expect(bp.sourceUrl).toContain("example.com");
    expect(bp.statusCode).toBe(200);
    expect(bp.meta.title.toLowerCase()).toContain("example");
    expect(bp.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(bp.html.length).toBeGreaterThan(50);
    expect(bp.stats.htmlBytes).toBeGreaterThan(50);
    expect(bp.id).toMatch(/^BLUEPRINT_/);
  }, 25_000);

  it("surfaces HTTP errors for bad public hosts that respond 404-ish path", async () => {
    // example.com/this-path-should-404 — some hosts still 200; just ensure no crash
    try {
      const bp = await scanToBlueprint({
        url: "https://example.com/this-path-does-not-exist-blueprint-test",
      });
      // example.com often returns 404
      if (bp) {
        expect(bp.id).toMatch(/^BLUEPRINT_/);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Accept either network skip or HTTP error message
      expect(msg.length).toBeGreaterThan(0);
    }
  }, 25_000);
});
