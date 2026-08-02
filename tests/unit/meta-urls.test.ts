import { describe, expect, it } from "vitest";
import {
  absolutizeOpenGraphMeta,
  absolutizeTwitterMeta,
  absolutizeUrl,
} from "@/lib/blueprint/meta-urls";
import { scanToBlueprint } from "@/lib/blueprint/scan";

describe("absolutize Open Graph / Twitter URLs", () => {
  const base = "https://shop.example/app/";

  it("absolutizeUrl joins relative paths", () => {
    expect(absolutizeUrl("/images/og.png", base)).toBe(
      "https://shop.example/images/og.png",
    );
    expect(absolutizeUrl("images/og.png", base)).toBe(
      "https://shop.example/app/images/og.png",
    );
    expect(absolutizeUrl("https://cdn.example/a.png", base)).toBe(
      "https://cdn.example/a.png",
    );
    expect(absolutizeUrl("//cdn.example/a.png", base)).toBe(
      "https://cdn.example/a.png",
    );
  });

  it("absolutizeOpenGraphMeta rewrites og:image and og:url", () => {
    const og = absolutizeOpenGraphMeta(
      {
        "og:title": "X",
        "og:image": "/img/hero.png",
        "og:url": "/product/1",
      },
      "https://shop.example/",
    );
    expect(og["og:image"]).toBe("https://shop.example/img/hero.png");
    expect(og["og:url"]).toBe("https://shop.example/product/1");
  });

  it("fills og:url from base when missing", () => {
    const og = absolutizeOpenGraphMeta(
      { "og:image": "/a.png" },
      "https://x.test/page",
    );
    expect(og["og:url"]).toMatch(/^https:\/\/x\.test\//);
    expect(og["og:image"]).toBe("https://x.test/a.png");
  });

  it("absolutizeTwitterMeta rewrites twitter:image", () => {
    const tw = absolutizeTwitterMeta(
      { "twitter:image": "/tw.png", "twitter:card": "summary" },
      "https://x.test/",
    );
    expect(tw["twitter:image"]).toBe("https://x.test/tw.png");
    expect(tw["twitter:card"]).toBe("summary");
  });

  it("scanToBlueprint meta has absolute og:image and og:url", async () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:title" content="Shop" />
      <meta property="og:image" content="/images/og.png" />
      <meta property="og:url" content="/home" />
      <meta name="twitter:image" content="/tw.png" />
    </head><body><h1>Shop</h1><p>Content here with enough text for a real page body.</p></body></html>`;
    const bp = await scanToBlueprint({
      html,
      baseUrl: "https://shop.example/",
      captureAssets: false,
      render: false,
      wayback: false,
      maxPages: 1,
      wpJetEngine: false,
    });
    expect(bp.meta.og["og:image"]).toBe("https://shop.example/images/og.png");
    expect(bp.meta.og["og:url"]).toBe("https://shop.example/home");
    expect(bp.meta.twitter["twitter:image"]).toBe("https://shop.example/tw.png");
  });
});
