import { describe, expect, it, vi } from "vitest";
import { fetchPageWithFallback } from "@/lib/scanner/pipeline";
import {
  captureAssetsGuarded,
  MAX_ASSET_BYTES,
  safeJsonStringify,
} from "@/lib/scanner/assets";
import {
  renderWithBrowserShield,
  withHardTimeout,
} from "@/lib/scanner/browser";
import { toApiError, withApiGuard } from "@/lib/scanner/errors";
import { scanToBlueprint } from "@/lib/blueprint/scan";
import type { BlueprintAsset } from "@/lib/blueprint/types";

describe("hardening · DNS failure", () => {
  it("scan of non-existent domain fails with clear error (no crash)", async () => {
    await expect(
      scanToBlueprint({
        url: "https://this-domain-definitely-does-not-exist-blueprint-xyz123.invalid/",
        render: false,
        wayback: false,
        captureAssets: false,
        maxPages: 1,
        wpJetEngine: false,
      }),
    ).rejects.toThrow(/ENOTFOUND|getaddrinfo|DNS|fetch|failed|nedostup|error|HTTP/i);
  }, 20_000);
});

describe("hardening · huge asset (100 MB)", () => {
  it("skips oversize asset via Content-Length without capturing", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-length": String(100 * 1024 * 1024), // 100 MB
        },
      });
    }) as typeof fetch;

    try {
      const assets: BlueprintAsset[] = [
        {
          url: "https://cdn.example/huge.bin",
          type: "other",
        },
      ];
      const result = await captureAssetsGuarded(assets, {
        maxEach: MAX_ASSET_BYTES,
        maxTotal: 50 * 1024 * 1024,
      });
      expect(result.skippedOversize).toBeGreaterThanOrEqual(1);
      expect(result.assets.some((a) => a.captured)).toBe(false);
      expect(result.warnings[0]?.reason).toMatch(/exceeds max size|100/i);
      expect(result.totalCapturedBytes).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("safeJsonStringify handles circular objects", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    const s = safeJsonStringify(a);
    expect(s).toMatch(/Circular|self/);
    expect(() => JSON.parse(s.replace("/* truncated by memory guard */", ""))).not.toThrow();
  });
});

describe("hardening · Playwright abort mid-render", () => {
  it("withHardTimeout rejects on AbortSignal", async () => {
    const ac = new AbortController();
    const work = new Promise((resolve) => setTimeout(resolve, 5_000));
    const p = withHardTimeout(work, 10_000, ac.signal, "test");
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("renderWithBrowserShield returns aborted without throw when pre-aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const r = await renderWithBrowserShield("https://example.com", {
      signal: ac.signal,
      timeoutMs: 5_000,
    });
    expect(r.aborted).toBe(true);
    expect(r.html).toBe("");
  });

  it("pipeline records headless error and falls back to HTTP", async () => {
    const result = await fetchPageWithFallback({
      url: "https://example.local/page",
      wantRender: true,
      wantWayback: false,
      renderFn: async () => {
        const e = new Error("Headless render timeout (30000ms)");
        e.name = "TimeoutError";
        throw e;
      },
      httpFn: async () => ({
        text: "<html><body><h1>Static OK</h1></body></html>",
        finalUrl: "https://example.local/page",
        status: 200,
        headers: { "content-type": "text/html" },
        contentType: "text/html",
      }),
    });
    expect(result.stageUsed).toBe("http");
    expect(result.rendered).toBe(false);
    expect(result.html).toContain("Static OK");
    expect(result.partialErrors.some((e) => e.stage === "headless")).toBe(true);
  });

  it("pipeline falls through to wayback when HTTP fails", async () => {
    const result = await fetchPageWithFallback({
      url: "https://dead.example/",
      wantRender: false,
      wantWayback: true,
      httpFn: async (u) => {
        if (u.includes("web.archive.org") || u.includes("wayback")) {
          return {
            text: "<html><body>from archive</body></html>",
            finalUrl: u,
            status: 200,
            headers: {},
            contentType: "text/html",
          };
        }
        throw new Error("getaddrinfo ENOTFOUND dead.example");
      },
      waybackFn: async () => ({
        url: "https://web.archive.org/web/20200101000000/https://dead.example/",
        timestamp: "20200101000000",
      }),
    });
    expect(result.stageUsed).toBe("wayback");
    expect(result.source).toBe("wayback");
    expect(result.html).toContain("from archive");
  });
});

describe("hardening · API guard", () => {
  it("withApiGuard never throws — returns structured error", async () => {
    const out = await withApiGuard(async () => {
      throw new Error("getaddrinfo ENOTFOUND x.invalid");
    });
    expect(out).toMatchObject({ ok: false });
    if (out.ok === false) {
      expect(out.code).toBe("DNS_FAILURE");
      expect(out.error).toMatch(/ENOTFOUND/);
    }
  });

  it("toApiError maps abort", () => {
    const e = new Error("aborted");
    e.name = "AbortError";
    expect(toApiError(e).code).toBe("ABORTED");
  });
});
