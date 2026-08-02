import { describe, expect, it, vi, beforeEach } from "vitest";
import { scanToBlueprint } from "@/lib/blueprint/scan";
import {
  compileElementorFromBlueprint,
  exportElementorTemplateJson,
} from "@/lib/blueprint/elementor-compiler";
import {
  exportBlueprintJson,
  saveBlueprintLocal,
  listLocalBlueprints,
  loadLocalBlueprint,
  deleteLocalBlueprint,
} from "@/lib/blueprint/storage";
import { normalizeImportedBlueprint } from "@/lib/blueprint/import-normalize";
import { makeMinimalBlueprint } from "../../fixtures/minimal-blueprint";

/**
 * Logic-level E2E: HTML scan → vault → Elementor JSON export
 * (no live browser; covers the product flow used by UI).
 */
describe("E2E flow · scan → vault → Elementor JSON", () => {
  beforeEach(() => {
    // happy-dom localStorage when environment is node — polyfill
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    });
    // download helpers need document in storage zip — skip zip here
  });

  it("full pipeline from HTML fixture", async () => {
    const html = `<!DOCTYPE html><html><head>
      <style id="elementor-frontend-inline-css">
        :root { --e-global-color-primary: #111; }
      </style>
    </head><body class="elementor">
      <h1 class="elementor-heading-title">E2E App</h1>
      <div class="jet-listing-dynamic-field"
        data-settings='{"dynamic_field_source":"object_title"}'>Hello</div>
      <form action="/wp-login.php" method="post">
        <input name="log" /><input name="pwd" type="password" />
      </form>
    </body></html>`;

    const bp = await scanToBlueprint({
      html,
      baseUrl: "https://e2e.test/",
      captureAssets: false,
      render: false,
      wayback: false,
      maxPages: 1,
      wpJetEngine: true,
    });

    expect(bp.meta.title || bp.html).toBeTruthy();
    expect(bp.elementorTemplate?.version).toBe("0.4");
    expect(bp.forms.some((f) => f.category === "login")).toBe(true);

    // vault
    saveBlueprintLocal(bp);
    expect(listLocalBlueprints().some((x) => x.id === bp.id)).toBe(true);
    const loaded = loadLocalBlueprint(bp.id);
    expect(loaded?.id).toBe(bp.id);

    // export elementor
    const tpl = bp.elementorTemplate || compileElementorFromBlueprint(bp);
    const json = exportElementorTemplateJson(tpl);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe("0.4");
    expect(parsed._blueprint).toBeUndefined();
    expect(Array.isArray(parsed.content)).toBe(true);

    // re-import blueprint JSON
    const roundtrip = normalizeImportedBlueprint(JSON.parse(exportBlueprintJson(bp)));
    expect(roundtrip.id).toBe(bp.id);

    deleteLocalBlueprint(bp.id);
    expect(loadLocalBlueprint(bp.id)).toBeNull();
  });

  it("rejects broken import then accepts minimal", () => {
    expect(() => normalizeImportedBlueprint({ foo: 1 })).toThrow();
    const ok = normalizeImportedBlueprint(makeMinimalBlueprint({ id: "IMP_1" }));
    expect(ok.id).toBe("IMP_1");
  });

  it("Elementor export is stable JSON", () => {
    const bp = makeMinimalBlueprint({
      html: `<div class="elementor"><h2 class="elementor-heading-title">Z</h2></div>`,
    });
    const a = exportElementorTemplateJson(compileElementorFromBlueprint(bp));
    const b = exportElementorTemplateJson(compileElementorFromBlueprint(bp));
    // ids are random — structure keys stable
    expect(JSON.parse(a).type).toBe(JSON.parse(b).type);
    expect(JSON.parse(a).version).toBe("0.4");
  });
});
