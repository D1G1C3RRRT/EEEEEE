import { describe, expect, it, vi } from "vitest";
import {
  computeBackoffMs,
  isTransientError,
  isTransientHttpStatus,
  shouldRetryHttpStatus,
  withRetry,
} from "@/lib/blueprint/retry";
import {
  harvestCrawlPages,
  harvestOneWithRetry,
  type PageHarvest,
} from "@/lib/blueprint/crawl-pages";
import type { BlueprintPage, DesignTokens } from "@/lib/blueprint/types";

const emptyDesign = (): DesignTokens => ({
  colors: [],
  fonts: [],
  cssVariables: {},
  borderRadii: [],
  shadows: [],
  spacingHints: [],
});

function ok(url: string): PageHarvest {
  const page: BlueprintPage = {
    url,
    title: "ok",
    contentHash: "h",
    statusCode: 200,
    htmlBytes: 10,
    headings: [],
    internalLinkCount: 0,
    formCount: 0,
  };
  return {
    page,
    links: [],
    forms: [],
    assets: [],
    scripts: [],
    stylesheets: [],
    cssBundles: [],
    design: emptyDesign(),
  };
}

function statusPage(url: string, status: number): PageHarvest {
  const h = ok(url);
  h.page.statusCode = status;
  h.page.title = "";
  return h;
}

describe("retry helpers", () => {
  it("classifies transient HTTP statuses", () => {
    expect(isTransientHttpStatus(503)).toBe(true);
    expect(isTransientHttpStatus(429)).toBe(true);
    expect(isTransientHttpStatus(500)).toBe(true);
    expect(isTransientHttpStatus(404)).toBe(false);
    expect(isTransientHttpStatus(401)).toBe(false);
    expect(shouldRetryHttpStatus(502)).toBe(true);
    expect(shouldRetryHttpStatus(404)).toBe(false);
  });

  it("classifies transient network errors", () => {
    expect(isTransientError(new Error("fetch failed"))).toBe(true);
    expect(isTransientError(new Error("ECONNRESET"))).toBe(true);
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "AbortError";
    expect(isTransientError(timeout)).toBe(true);
    expect(isTransientError(new Error("Invalid JSON"))).toBe(false);
  });

  it("computeBackoffMs grows and caps", () => {
    const a1 = computeBackoffMs(1, 100, 10_000, false);
    const a3 = computeBackoffMs(3, 100, 10_000, false);
    expect(a3).toBeGreaterThan(a1);
    expect(computeBackoffMs(20, 100, 500, false)).toBe(500);
  });

  it("withRetry succeeds after transient failures", async () => {
    let n = 0;
    const result = await withRetry(
      async () => {
        n += 1;
        if (n < 3) throw new Error("ECONNRESET");
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 },
    );
    expect(result).toBe("ok");
    expect(n).toBe(3);
  });

  it("withRetry does not retry permanent errors", async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n += 1;
          throw new Error("Invalid JSON");
        },
        {
          maxAttempts: 5,
          baseDelayMs: 1,
          shouldRetry: (err) => isTransientError(err),
        },
      ),
    ).rejects.toThrow(/Invalid JSON/);
    expect(n).toBe(1);
  });

  it("withRetry respects AbortSignal", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      withRetry(async () => "x", { signal: ac.signal, maxAttempts: 3 }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("harvestOneWithRetry", () => {
  it("retries 503 then succeeds", async () => {
    let n = 0;
    const harvestOne = vi.fn(async (url: string) => {
      n += 1;
      if (n < 3) return statusPage(url, 503);
      return ok(url);
    });
    const { harvested, attempts } = await harvestOneWithRetry(
      "https://ex.test/flaky",
      harvestOne,
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    );
    expect(harvested?.page.statusCode).toBe(200);
    expect(attempts).toBe(3);
    expect(harvestOne).toHaveBeenCalledTimes(3);
  });

  it("does not retry 404", async () => {
    const harvestOne = vi.fn(async (url: string) => statusPage(url, 404));
    const { harvested, attempts } = await harvestOneWithRetry(
      "https://ex.test/missing",
      harvestOne,
      { maxAttempts: 3, baseDelayMs: 1 },
    );
    expect(harvested?.page.statusCode).toBe(404);
    expect(attempts).toBe(1);
    expect(harvestOne).toHaveBeenCalledTimes(1);
  });

  it("retries network throw then succeeds", async () => {
    let n = 0;
    const harvestOne = vi.fn(async (url: string) => {
      n += 1;
      if (n === 1) throw new Error("socket hang up");
      return ok(url);
    });
    const { harvested, attempts } = await harvestOneWithRetry(
      "https://ex.test/net",
      harvestOne,
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    );
    expect(harvested?.page.statusCode).toBe(200);
    expect(attempts).toBe(2);
  });

  it("exhausts retries on persistent 500", async () => {
    const harvestOne = vi.fn(async (url: string) => statusPage(url, 500));
    const { harvested, attempts } = await harvestOneWithRetry(
      "https://ex.test/down",
      harvestOne,
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    );
    expect(harvested?.page.statusCode).toBe(500);
    expect(attempts).toBe(3);
    expect(harvestOne).toHaveBeenCalledTimes(3);
  });
});

describe("harvestCrawlPages · retries", () => {
  it("recovers page after transient 503 without marking failed", async () => {
    let n = 0;
    const result = await harvestCrawlPages({
      baseUrl: "https://shop.example/",
      maxAdditionalPages: 1,
      primaryInternalLinks: ["https://shop.example/p1"],
      maxAttemptsPerUrl: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
      harvestOne: async (url) => {
        n += 1;
        if (n < 2) return statusPage(url, 503);
        return ok(url);
      },
    });
    expect(result.scannedPages).toHaveLength(1);
    expect(result.failedUrls).toHaveLength(0);
    expect(result.scanStatus).toBe("complete");
  });

  it("records failure after retries exhausted", async () => {
    const result = await harvestCrawlPages({
      baseUrl: "https://shop.example/",
      maxAdditionalPages: 1,
      primaryInternalLinks: ["https://shop.example/p1"],
      maxAttemptsPerUrl: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
      harvestOne: async (url) => statusPage(url, 503),
    });
    expect(result.scannedPages).toHaveLength(0);
    expect(result.failedUrls).toHaveLength(1);
    expect(result.failedUrls[0].error).toMatch(/after 3 attempts|HTTP 503/);
    expect(result.scanStatus).toBe("partial");
  });
});
