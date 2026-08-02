import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMinimalBlueprint } from "../fixtures/minimal-blueprint";

// @vitest-environment happy-dom

describe("blueprint local storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("saves, lists, loads and deletes blueprints", async () => {
    const {
      saveBlueprintLocal,
      listLocalBlueprints,
      loadLocalBlueprint,
      deleteLocalBlueprint,
    } = await import("@/lib/blueprint/storage");

    const bp = makeMinimalBlueprint({ id: "BLUEPRINT_one" });
    saveBlueprintLocal(bp);

    const list = listLocalBlueprints();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("BLUEPRINT_one");
    expect(list[0].title).toBe("Sample Blueprint App");
    expect(list[0].tech).toContain("React");

    const loaded = loadLocalBlueprint("BLUEPRINT_one");
    expect(loaded?.contentHash).toBe("abc123");

    deleteLocalBlueprint("BLUEPRINT_one");
    expect(listLocalBlueprints()).toHaveLength(0);
    expect(loadLocalBlueprint("BLUEPRINT_one")).toBeNull();
  });

  it("dedupes by id and keeps newest first", async () => {
    const { saveBlueprintLocal, listLocalBlueprints } = await import(
      "@/lib/blueprint/storage"
    );

    saveBlueprintLocal(
      makeMinimalBlueprint({
        id: "A",
        meta: { ...makeMinimalBlueprint().meta, title: "First" },
      }),
    );
    saveBlueprintLocal(
      makeMinimalBlueprint({
        id: "B",
        meta: { ...makeMinimalBlueprint().meta, title: "Second" },
      }),
    );
    saveBlueprintLocal(
      makeMinimalBlueprint({
        id: "A",
        meta: { ...makeMinimalBlueprint().meta, title: "First updated" },
      }),
    );

    const list = listLocalBlueprints();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("A");
    expect(list[0].title).toBe("First updated");
  });

  it("exports valid JSON string", async () => {
    const { exportBlueprintJson } = await import("@/lib/blueprint/storage");
    const bp = makeMinimalBlueprint();
    const json = exportBlueprintJson(bp);
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe(bp.id);
    expect(parsed.version).toBe("1.1.0");
  });

  it("builds ZIP with expected files including captured assets", async () => {
    const { exportBlueprintZip } = await import("@/lib/blueprint/storage");
    const JSZip = (await import("jszip")).default;
    const bp = makeMinimalBlueprint();

    const clicks: string[] = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        el.click = () => {
          clicks.push((el as HTMLAnchorElement).download);
        };
      }
      return el;
    });

    const blobs: Blob[] = [];
    const orig = URL.createObjectURL.bind(URL);
    vi.spyOn(URL, "createObjectURL").mockImplementation((b: Blob | MediaSource) => {
      if (b instanceof Blob) blobs.push(b);
      return orig(b as Blob);
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    await exportBlueprintZip(bp);
    expect(clicks[0]).toBe(`${bp.id}.zip`);
    expect(blobs.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(blobs[0]);
    expect(zip.file("blueprint.json")).toBeTruthy();
    expect(zip.file("index.html")).toBeTruthy();
    expect(zip.file("README.md")).toBeTruthy();
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file("css/inline-1.css")).toBeTruthy();
    expect(zip.file("assets/images/001.png")).toBeTruthy();
  });
});
