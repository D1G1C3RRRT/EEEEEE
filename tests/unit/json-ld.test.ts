import { describe, expect, it } from "vitest";
import {
  buildFaqJsonLd,
  buildHeadJsonLdScripts,
  buildSiteJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

describe("JSON-LD structured data", () => {
  it("builds WebSite + WebApplication graph", () => {
    const ld = buildSiteJsonLd({ origin: "https://blueprint.example" });
    expect(ld["@context"]).toBe("https://schema.org");
    const types = ld["@graph"].flatMap((n) =>
      Array.isArray(n["@type"]) ? (n["@type"] as string[]) : [n["@type"]],
    );
    expect(types).toEqual(
      expect.arrayContaining([
        "Organization",
        "WebSite",
        "WebApplication",
        "SoftwareApplication",
        "WebPage",
      ]),
    );
    const app = ld["@graph"].find((n) =>
      Array.isArray(n["@type"])
        ? (n["@type"] as string[]).includes("WebApplication")
        : n["@type"] === "WebApplication",
    );
    expect(app?.name).toBe("Blueprint Scanner");
    expect(app?.applicationCategory).toBe("DeveloperApplication");
    expect(app?.offers).toMatchObject({ price: "0", priceCurrency: "EUR" });
  });

  it("uses absolute URLs when origin provided", () => {
    const ld = buildSiteJsonLd({ origin: "https://app.example/" });
    const site = ld["@graph"].find((n) => n["@type"] === "WebSite");
    expect(site?.url).toBe("https://app.example/");
    expect(String(site?.["@id"])).toContain("https://app.example");
  });

  it("works without origin (relative paths)", () => {
    const ld = buildSiteJsonLd();
    const site = ld["@graph"].find((n) => n["@type"] === "WebSite");
    expect(site?.url).toBe("/");
  });

  it("builds FAQPage with 3 questions", () => {
    const faq = buildFaqJsonLd({ origin: "https://x.test" });
    const page = faq["@graph"][0];
    expect(page["@type"]).toBe("FAQPage");
    const entities = page.mainEntity as unknown[];
    expect(entities).toHaveLength(3);
  });

  it("serializeJsonLd escapes </script> breakouts", () => {
    const raw = serializeJsonLd({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "Thing", name: "</script><script>alert(1)" }],
    });
    expect(raw).not.toMatch(/<\/script>/i);
    expect(raw).toContain("\\u003c");
  });

  it("buildHeadJsonLdScripts returns two ld+json payloads", () => {
    const scripts = buildHeadJsonLdScripts({ origin: "https://bp.test" });
    expect(scripts).toHaveLength(2);
    expect(scripts.every((s) => s.type === "application/ld+json")).toBe(true);
    for (const s of scripts) {
      const parsed = JSON.parse(s.children);
      expect(parsed["@context"]).toBe("https://schema.org");
      expect(Array.isArray(parsed["@graph"])).toBe(true);
    }
  });
});
