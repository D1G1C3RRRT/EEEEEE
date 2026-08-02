import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compileElementorFromBlueprint,
  compileElementorTemplate,
  exportElementorTemplateJson,
} from "@/lib/blueprint/elementor-compiler";
import { scanToBlueprint } from "@/lib/blueprint/scan";

const wpFixture = readFileSync(
  path.resolve(__dirname, "../fixtures/wp-jetengine-sample.html"),
  "utf8",
);

describe("Elementor DOM-to-JSON compiler", () => {
  it("maps containers, heading, image, jet-listing-grid", () => {
    const tpl = compileElementorTemplate({
      html: wpFixture,
      baseUrl: "https://wp.example/",
      title: "Gruppa Demo",
      design: {
        colors: ["#0F0E0C"],
        fonts: ["Geist"],
        cssVariables: {
          "--e-global-color-primary": "#0F0E0C",
          "--e-global-color-secondary": "#C8A16E",
        },
        borderRadii: [],
        shadows: [],
        spacingHints: [],
        elementorGlobals: {
          colors: {
            "--e-global-color-primary": "#0F0E0C",
            "--e-global-color-secondary": "#C8A16E",
          },
          typography: {
            "--e-global-typography-primary-font-size": "40px",
          },
          raw: {},
          inlineCssBytes: 100,
          styleIds: ["elementor-frontend-inline-css"],
        },
        typography: [
          {
            selector: "h1",
            fontFamily: "Geist",
            fontSize: "40px",
            fontWeight: "700",
            lineHeight: "1.2",
            letterSpacing: null,
            source: "css-rule",
          },
        ],
      },
    });

    expect(tpl.version).toBe("0.4");
    expect(tpl.type).toBe("page");
    expect(tpl.content.length).toBeGreaterThan(0);
    expect(tpl._blueprint?.widgetCount).toBeGreaterThan(0);

    const json = JSON.stringify(tpl);
    expect(json).toMatch(/"elType":"container"/);
    expect(json).toMatch(/"widgetType":"heading"/);
    expect(json).toMatch(/"widgetType":"jet-listing-grid"/);
    // full image without size suffix
    expect(json).toMatch(/cover\.jpg/);
    expect(json).not.toMatch(/cover-1024x576/);
  });

  it("export strips _blueprint for clean Elementor import file", () => {
    const tpl = compileElementorTemplate({
      html: "<div class='elementor'><h1 class='elementor-heading-title'>Hi</h1></div>",
      baseUrl: "https://x.test/",
      title: "T",
    });
    const clean = JSON.parse(exportElementorTemplateJson(tpl));
    expect(clean.version).toBe("0.4");
    expect(clean._blueprint).toBeUndefined();
    expect(Array.isArray(clean.content)).toBe(true);
  });

  it("scanToBlueprint attaches elementorTemplate", async () => {
    const bp = await scanToBlueprint({
      html: wpFixture,
      baseUrl: "https://wp.example/",
      captureAssets: false,
      render: false,
      wayback: false,
      maxPages: 1,
      wpJetEngine: true,
    });
    expect(bp.elementorTemplate).toBeTruthy();
    expect(bp.elementorTemplate!.version).toBe("0.4");
    expect(bp.elementorTemplate!.content.length).toBeGreaterThan(0);
    const fromBp = compileElementorFromBlueprint(bp);
    expect(fromBp.title).toBeTruthy();
  });

  it("assigns 7-char hex ids", () => {
    const tpl = compileElementorTemplate({
      html: `<div class="elementor"><section class="elementor-section e-con" data-id="x">
        <div class="elementor-widget-heading"><h2 class="elementor-heading-title">Title</h2></div>
        <div class="elementor-widget-button"><a class="elementor-button" href="/x">Go</a></div>
      </section></div>`,
      baseUrl: "https://x.test/",
    });
    const walk = (nodes: typeof tpl.content) => {
      for (const n of nodes) {
        expect(n.id).toMatch(/^[0-9a-f]{7}$/);
        if (n.elements?.length) walk(n.elements);
      }
    };
    walk(tpl.content);
  });
});
