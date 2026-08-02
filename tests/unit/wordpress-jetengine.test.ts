import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractElementorSections,
  extractJetDynamicFields,
  extractJetListingGrids,
  extractNavFooterLinks,
  parseDataSettings,
} from "@/lib/blueprint/wordpress-jetengine";
import { scanToBlueprint } from "@/lib/blueprint/scan";
import { detectTech } from "@/lib/blueprint/detect-tech";

const fixture = readFileSync(
  path.resolve(__dirname, "../fixtures/wp-jetengine-sample.html"),
  "utf8",
);
const base = "https://wp.example/";

describe("WP / JetEngine DOM extract", () => {
  it("finds jet-listing-grid and item template", () => {
    const grids = extractJetListingGrids(fixture, base);
    expect(grids.length).toBeGreaterThanOrEqual(1);
    const g = grids[0];
    expect(g.classes.some((c) => c.includes("jet-listing-grid--42"))).toBe(true);
    expect(g.listingId).toBe("42");
    expect(g.postType).toBe("aplikacie");
    expect(g.itemCount).toBe(2);
    expect(g.itemTemplate?.textSample).toMatch(/App Alpha|alpha/i);
    expect(g.itemTemplate?.links.some((l) => l.includes("/aplikacie/alpha"))).toBe(
      true,
    );
  });

  it("parses Elementor data-settings with HTML entities", () => {
    const q = "&" + "quot;";
    const encoded = `{${q}dynamic_field_source${q}:${q}object_meta${q},${q}dynamic_field_post_meta${q}:${q}cena${q}}`;
    const s = parseDataSettings(encoded);
    expect(s?.dynamic_field_source).toBe("object_meta");
    expect(s?.dynamic_field_post_meta).toBe("cena");
  });

  it("extracts JetEngine dynamic fields (title, meta, image, link, terms)", () => {
    const fields = extractJetDynamicFields(fixture, base);
    expect(fields.length).toBeGreaterThanOrEqual(4);
    expect(fields.some((f) => f.kind === "field" && f.source === "post_title")).toBe(
      true,
    );
    expect(
      fields.some(
        (f) => f.kind === "field" && (f.metaKey === "popis" || f.key === "popis"),
      ),
    ).toBe(true);
    expect(fields.some((f) => f.kind === "image")).toBe(true);
    expect(fields.some((f) => f.kind === "link")).toBe(true);
    expect(
      fields.some((f) => f.kind === "terms" && f.taxonomy === "kategoria"),
    ).toBe(true);
  });

  it("attaches dynamic fields to listing item template", () => {
    const grids = extractJetListingGrids(fixture, base);
    const dyn = grids[0]?.itemTemplate?.dynamicFields || [];
    expect(dyn.length).toBeGreaterThanOrEqual(3);
    expect(dyn.some((f) => f.context === "listing_item")).toBe(true);
  });

  it("maps Elementor sections with data-id and roles", () => {
    const sections = extractElementorSections(fixture);
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections.some((s) => s.dataId === "hero01")).toBe(true);
    expect(sections.some((s) => s.role === "hero" || s.headings.some((h) => /Hero/i.test(h)))).toBe(
      true,
    );
  });

  it("extracts nav and footer links", () => {
    const { navLinks, footerLinks } = extractNavFooterLinks(fixture, base);
    expect(navLinks.some((u) => u.includes("/aplikacie"))).toBe(true);
    expect(footerLinks.some((u) => u.includes("/privacy"))).toBe(true);
  });

  it("detects Elementor + JetEngine + WordPress tech", () => {
    const tech = detectTech({
      html: fixture,
      css: "",
      headers: {},
      scripts: [],
    }).map((t) => t.name);
    expect(tech).toContain("WordPress");
    expect(tech).toContain("Elementor");
    expect(tech).toContain("JetEngine");
  });

  it("scanToBlueprint fills dynamicFields + catalog", async () => {
    const bp = await scanToBlueprint({
      html: fixture,
      baseUrl: base,
      captureAssets: false,
      render: false,
      wayback: false,
      maxPages: 1,
      wpJetEngine: true,
    });
    expect(bp.wordpress).toBeTruthy();
    expect(bp.wordpress!.listingGrids.length).toBeGreaterThanOrEqual(1);
    expect(bp.wordpress!.dynamicFields.length).toBeGreaterThanOrEqual(3);
    expect(bp.wordpress!.dynamicFieldCatalog.length).toBeGreaterThanOrEqual(2);
    expect(
      bp.elementorTemplate &&
        JSON.stringify(bp.elementorTemplate).includes("jet-listing-dynamic"),
    ).toBe(true);
  });
});
