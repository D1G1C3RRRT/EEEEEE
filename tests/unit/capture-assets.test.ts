import { afterEach, describe, expect, it, vi } from "vitest";
import { captureAssets } from "@/lib/blueprint/capture-assets";
import type { BlueprintAsset } from "@/lib/blueprint/types";

describe("captureAssets", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("skips data: and blob: URLs without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const assets: BlueprintAsset[] = [
      { url: "data:image/png;base64,aaa", type: "image" },
      { url: "blob:https://x/1", type: "image" },
    ];
    const out = await captureAssets(assets);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.every((a) => !a.captured)).toBe(true);
  });

  it("captures small image as base64 with path", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 1, 2, 3]); // fake png header-ish
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(bytes, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      ),
    );
    const assets: BlueprintAsset[] = [
      { url: "https://cdn.example/img/hero.png", type: "image" },
    ];
    const out = await captureAssets(assets);
    const cap = out.find((a) => a.captured);
    expect(cap).toBeTruthy();
    expect(cap!.base64).toBeTruthy();
    expect(cap!.path).toMatch(/^assets\/images\//);
    expect(cap!.contentType).toMatch(/png/);
  });

  it("skips failed fetches and keeps original asset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    const assets: BlueprintAsset[] = [
      { url: "https://cdn.example/missing.png", type: "image" },
    ];
    const out = await captureAssets(assets);
    expect(out[0].captured).toBeFalsy();
    expect(out[0].url).toContain("missing.png");
  });

  it("prefers stylesheets before images in capture order", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return new Response("body{}", {
          status: 200,
          headers: {
            "content-type": String(url).endsWith(".css")
              ? "text/css"
              : "image/png",
          },
        });
      }),
    );
    await captureAssets([
      { url: "https://cdn.example/a.png", type: "image" },
      { url: "https://cdn.example/a.css", type: "stylesheet" },
    ]);
    expect(urls[0]).toContain("a.css");
  });
});
