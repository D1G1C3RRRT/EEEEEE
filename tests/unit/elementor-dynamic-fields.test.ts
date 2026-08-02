import { describe, expect, it } from "vitest";
import {
  compileElementorTemplate,
  exportElementorTemplateJson,
  exportElementorTemplateJsonWithMeta,
} from "@/lib/blueprint/elementor-compiler";

const html = `<!DOCTYPE html>
<html><body>
<div class="elementor" data-elementor-type="wp-page">
  <section class="elementor-section e-con e-con-boxed" data-id="sec1"
    data-settings='{"content_width":"boxed","flex_direction":"column"}'>
    <div class="elementor-widget elementor-widget-heading">
      <h1 class="elementor-heading-title">Title</h1>
    </div>
    <div class="elementor-widget elementor-widget-text-editor">
      <div class="elementor-widget-container"><p>Body copy</p></div>
    </div>
    <div class="elementor-widget elementor-widget-button">
      <a class="elementor-button" href="https://ex.test/go">Click</a>
    </div>
    <div class="elementor-widget elementor-widget-jet-listing-dynamic-field"
      data-id="df1"
      data-settings='{"dynamic_field_source":"object_meta","dynamic_field_post_meta":"cena"}'>
      <div class="jet-listing-dynamic-field">12 €</div>
    </div>
    <div class="elementor-widget elementor-widget-jet-listing-dynamic-link"
      data-settings='{"dynamic_link_source":"permalink"}'>
      <a class="jet-listing-dynamic-link" href="https://ex.test/item/1">Detail</a>
    </div>
    <div class="elementor-widget elementor-widget-jet-listing-dynamic-image"
      data-settings='{"dynamic_image_source":"post_thumbnail"}'>
      <div class="jet-listing-dynamic-image">
        <img src="https://ex.test/wp-content/uploads/2024/a-150x150.jpg" alt="thumb" />
      </div>
    </div>
    <div class="elementor-widget elementor-widget-jet-listing-dynamic-terms"
      data-settings='{"dynamic_terms_taxonomy":"kategoria"}'>
      <div class="jet-listing-dynamic-terms">AI, SaaS</div>
    </div>
    <div class="elementor-widget elementor-widget-jet-listing-grid jet-listing-grid--9"
      data-listing-id="9"
      data-settings='{"post_type":"apps"}'>
      <div class="jet-listing-grid__item">
        <div class="jet-listing-dynamic-field"
          data-settings='{"dynamic_field_source":"object_title"}'>Alpha</div>
      </div>
    </div>
  </section>
</div>
</body></html>`;

function walk(nodes: { widgetType?: string; settings: Record<string, unknown>; elements: unknown[] }[]): typeof nodes {
  const all: typeof nodes = [];
  for (const n of nodes) {
    all.push(n as never);
    if (Array.isArray(n.elements) && n.elements.length) {
      all.push(...walk(n.elements as typeof nodes));
    }
  }
  return all;
}

describe("Elementor compiler · dynamic fields + widgets", () => {
  it("compiles dynamic-field / link / image / terms widgetTypes", () => {
    const tpl = compileElementorTemplate({
      html,
      baseUrl: "https://ex.test/",
      title: "Dyn page",
    });
    const widgets = walk(tpl.content as never[]).filter((n) => n.widgetType);
    const types = widgets.map((w) => w.widgetType);

    expect(types).toEqual(
      expect.arrayContaining([
        "heading",
        "text-editor",
        "button",
        "jet-listing-dynamic-field",
        "jet-listing-dynamic-link",
        "jet-listing-dynamic-image",
        "jet-listing-dynamic-terms",
        "jet-listing-grid",
      ]),
    );

    const field = widgets.find((w) => w.widgetType === "jet-listing-dynamic-field");
    expect(field?.settings.dynamic_field_source).toBe("object_meta");
    expect(field?.settings.dynamic_field_post_meta).toBe("cena");
    expect(String(field?.settings._sample || "")).toMatch(/12/);

    const link = widgets.find((w) => w.widgetType === "jet-listing-dynamic-link");
    expect(link?.settings.dynamic_link_source).toBe("permalink");
    expect(String(link?.settings._sample_url || "")).toContain("/item/1");

    const image = widgets.find((w) => w.widgetType === "jet-listing-dynamic-image");
    expect(image?.settings.dynamic_image_source).toBe("post_thumbnail");
    // full-size WP URL preferred when rewritten on image widget path
    expect(String(image?.settings._sample_url || "")).toMatch(/\/a\.jpg|a-150x150/);

    const terms = widgets.find((w) => w.widgetType === "jet-listing-dynamic-terms");
    expect(terms?.settings.dynamic_terms_taxonomy).toBe("kategoria");

    const grid = widgets.find((w) => w.widgetType === "jet-listing-grid");
    expect(grid?.settings.listing_id).toBe("9");
    expect(grid?.settings.post_type).toBe("apps");
    expect(Array.isArray(grid?.settings._dynamic_fields)).toBe(true);
  });

  it("maps container boxed content_width from class/settings", () => {
    const tpl = compileElementorTemplate({
      html,
      baseUrl: "https://ex.test/",
    });
    const json = JSON.stringify(tpl);
    expect(json).toMatch(/"content_width":"boxed"/);
  });

  it("export with meta keeps _blueprint; clean export strips it", () => {
    const tpl = compileElementorTemplate({
      html: `<div class="elementor"><h2 class="elementor-heading-title">X</h2></div>`,
      baseUrl: "https://ex.test/",
      title: "Meta",
      blueprintId: "BP_TEST",
      sourceUrl: "https://ex.test/",
    });
    const clean = JSON.parse(exportElementorTemplateJson(tpl));
    const withMeta = JSON.parse(exportElementorTemplateJsonWithMeta(tpl));
    expect(clean._blueprint).toBeUndefined();
    expect(withMeta._blueprint?.sourceId).toBe("BP_TEST");
    expect(withMeta._blueprint?.widgetCount).toBeGreaterThan(0);
  });

  it("fallback container when no Elementor markers", () => {
    const tpl = compileElementorTemplate({
      html: "<html><body><p>plain</p></body></html>",
      baseUrl: "https://ex.test/",
      title: "Fallback",
    });
    expect(tpl.content.length).toBeGreaterThan(0);
    // either fallback note or generic container compile of body
    expect(tpl.version).toBe("0.4");
    expect(tpl._blueprint?.nodeCount).toBeGreaterThan(0);
  });
});
