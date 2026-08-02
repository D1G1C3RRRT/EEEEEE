import { describe, expect, it } from "vitest";
import { detectTech } from "@/lib/blueprint/detect-tech";

const empty = { html: "", css: "", headers: {}, scripts: [] as string[] };

describe("detectTech", () => {
  it("returns empty for blank page", () => {
    expect(detectTech(empty)).toEqual([]);
  });

  it("detects WordPress + WooCommerce", () => {
    const tech = detectTech({
      ...empty,
      html: `<link href="/wp-content/themes/x/style.css"><div class="woocommerce"></div>`,
    });
    const names = tech.map((t) => t.name);
    expect(names).toContain("WordPress");
    expect(names).toContain("WooCommerce");
  });

  it("detects React + Next.js", () => {
    const tech = detectTech({
      ...empty,
      html: `<div id="__next"></div><script>window.__NEXT_DATA__={}</script><script src="/_next/static/chunks/main.js"></script>`,
    });
    const names = tech.map((t) => t.name);
    expect(names).toContain("React");
    expect(names).toContain("Next.js");
  });

  it("detects Vue + Nuxt", () => {
    const tech = detectTech({
      ...empty,
      html: `<div data-v-abc123></div><script>window.__NUXT__={}</script>`,
    });
    const names = tech.map((t) => t.name);
    expect(names).toContain("Vue.js");
    expect(names).toContain("Nuxt");
  });

  it("detects Angular", () => {
    const tech = detectTech({
      ...empty,
      html: `<app-root ng-version="17.0.0"></app-root>`,
    });
    expect(tech.some((t) => t.name === "Angular")).toBe(true);
  });

  it("detects Bootstrap from CSS", () => {
    const tech = detectTech({
      ...empty,
      css: `.btn-primary { --bs-btn-bg: #0d6efd; }`,
    });
    expect(tech.some((t) => t.name === "Bootstrap")).toBe(true);
  });

  it("detects Tailwind utility pattern", () => {
    const tech = detectTech({
      ...empty,
      html: `<div class="flex grid md:flex text-sm bg-zinc-900 p-4 gap-2 rounded-lg shadow-md w-full max-w-xl"></div>`,
    });
    expect(tech.some((t) => t.name === "Tailwind CSS")).toBe(true);
  });

  it("detects PWA + analytics + hosting headers", () => {
    const tech = detectTech({
      ...empty,
      html: `<link rel="manifest" href="/m.json"><script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXX"></script>`,
      headers: {
        "cf-ray": "abc",
        "x-vercel-id": "iad1::1",
        server: "Vercel",
      },
    });
    const names = tech.map((t) => t.name);
    expect(names).toContain("PWA");
    expect(names).toContain("Google Tag Manager");
    expect(names).toContain("Cloudflare");
    expect(names).toContain("Vercel");
  });

  it("detects Shopify and Webflow", () => {
    const shop = detectTech({
      ...empty,
      html: `<script src="https://cdn.shopify.com/s/files/x.js"></script>`,
    });
    const wf = detectTech({
      ...empty,
      html: `<div data-wf-page="x" class="w-webflow"></div>`,
    });
    expect(shop.some((t) => t.name === "Shopify")).toBe(true);
    expect(wf.some((t) => t.name === "Webflow")).toBe(true);
  });

  it("detects Laravel session cookie signal", () => {
    const tech = detectTech({
      ...empty,
      headers: { "set-cookie": "laravel_session=abc; path=/" },
    });
    expect(tech.some((t) => t.name === "Laravel")).toBe(true);
  });

  it("assigns confidence levels", () => {
    const tech = detectTech({
      ...empty,
      html: `wp-content react.min.js`,
    });
    for (const t of tech) {
      expect(["high", "medium", "low"]).toContain(t.confidence);
      expect(t.evidence.length).toBeGreaterThan(0);
    }
  });
});
