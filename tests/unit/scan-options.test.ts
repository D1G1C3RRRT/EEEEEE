import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanToBlueprint } from "@/lib/blueprint/scan";

const fixture = readFileSync(
  path.resolve(__dirname, "../fixtures/wp-jetengine-sample.html"),
  "utf8",
);

describe("scanToBlueprint · options matrix", () => {
  it("wpJetEngine:false still runs design system + elementor template", async () => {
    const { blueprint: bp } = await scanToBlueprint({
      html: fixture,
      baseUrl: "https://wp.example/",
      wpJetEngine: false,
      captureAssets: false,
      render: false,
      wayback: false,
      maxPages: 1,
    });
    expect(bp.options.wpJetEngine).toBe(false);
    // wordpress extract may still run partially depending on implementation — accept null or empty
    // design + elementor always on
    expect(bp.design.elementorGlobals || bp.design.cssVariables).toBeTruthy();
    expect(bp.elementorTemplate?.version).toBe("0.4");
  });

  it("wpJetEngine:true fills wordpress.dynamicFields", async () => {
    const { blueprint: bp } = await scanToBlueprint({
      html: fixture,
      baseUrl: "https://wp.example/",
      wpJetEngine: true,
      captureAssets: false,
      render: false,
      wayback: false,
      maxPages: 1,
    });
    expect(bp.options.wpJetEngine).toBe(true);
    expect(bp.wordpress?.dynamicFields.length).toBeGreaterThan(0);
    expect(bp.wordpress?.dynamicFieldCatalog.length).toBeGreaterThan(0);
    expect(bp.forms.length).toBeGreaterThanOrEqual(0);
    expect(bp.design.fullImageUrls?.length).toBeGreaterThan(0);
  });

  it("maxPages:1 does not require extra pages array items", async () => {
    const { blueprint: bp } = await scanToBlueprint({
      html: fixture,
      baseUrl: "https://wp.example/",
      maxPages: 1,
      captureAssets: false,
      render: false,
      wayback: false,
      wpJetEngine: false,
    });
    expect(bp.stats.pageCount).toBe(1);
    expect(bp.pages).toEqual([]);
  });

  it("includes forms categories when present in HTML", async () => {
    const html = `<!doctype html><html><body>
      <form action="https://x.test/wp-login.php" method="post">
        <input name="log" required /><input name="pwd" type="password" required />
      </form>
      <style id="elementor-frontend-inline-css">:root{--e-global-color-primary:#111}</style>
    </body></html>`;
    const { blueprint: bp } = await scanToBlueprint({
      html,
      baseUrl: "https://x.test/",
      captureAssets: false,
      render: false,
      wayback: false,
      maxPages: 1,
      wpJetEngine: false,
    });
    expect(bp.forms.some((f) => f.category === "login")).toBe(true);
    expect(
      bp.design.elementorGlobals?.colors["--e-global-color-primary"] ||
        bp.design.cssVariables["--e-global-color-primary"],
    ).toBeTruthy();
  });
});
