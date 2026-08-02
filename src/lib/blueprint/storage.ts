import type { Blueprint } from "./types";
import {
  compileElementorFromBlueprint,
  exportElementorTemplateJson,
  exportElementorTemplateJsonWithMeta,
} from "./elementor-compiler";

const KEY = "blueprint.vault.v1";

export type BlueprintSummary = {
  id: string;
  title: string;
  sourceUrl: string | null;
  createdAt: string;
  tech: string[];
  contentHash: string;
};

function readAll(): Blueprint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Blueprint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: Blueprint[]) {
  if (typeof window === "undefined") return;
  const trimmed = items.slice(0, 15);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    try {
      const slim = trimmed.slice(0, 5).map((bp) => ({
        ...bp,
        assets: bp.assets.map(({ base64, ...rest }) => rest),
      }));
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* ignore */
    }
  }
}

export function saveBlueprintLocal(bp: Blueprint) {
  const all = readAll().filter((b) => b.id !== bp.id);
  all.unshift(bp);
  writeAll(all);
}

export function listLocalBlueprints(): BlueprintSummary[] {
  return readAll().map((b) => ({
    id: b.id,
    title: b.meta.title || b.sourceUrl || "Bez názvu",
    sourceUrl: b.sourceUrl,
    createdAt: b.createdAt,
    tech: b.tech.map((t) => t.name),
    contentHash: b.contentHash,
  }));
}

export function loadLocalBlueprint(id: string): Blueprint | null {
  return readAll().find((b) => b.id === id) ?? null;
}

export function deleteLocalBlueprint(id: string) {
  writeAll(readAll().filter((b) => b.id !== id));
}

export function exportBlueprintJson(bp: Blueprint): string {
  return JSON.stringify(bp, null, 2);
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function downloadElementorTemplate(bp: Blueprint) {
  const tpl = bp.elementorTemplate || compileElementorFromBlueprint(bp);
  downloadText(
    "elementor-template-import.json",
    exportElementorTemplateJson(tpl),
    "application/json",
  );
  return tpl;
}

export async function exportBlueprintZip(bp: Blueprint) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const slimAssets = bp.assets.map(({ base64, ...rest }) => rest);
  zip.file(
    "blueprint.json",
    JSON.stringify({ ...bp, assets: slimAssets }, null, 2),
  );
  zip.file("index.html", bp.html);
  zip.file(
    "README.md",
    [
      `# ${bp.meta.title || bp.id}`,
      "",
      `- ID: \`${bp.id}\``,
      `- Source: ${bp.sourceUrl ?? "HTML paste"}`,
      `- Version: ${bp.version}`,
      `- Created: ${bp.createdAt}`,
      `- Content hash: \`${bp.contentHash}\``,
      `- Pages: ${bp.stats?.pageCount ?? 1}`,
      `- Rendered: ${bp.rendered ? "yes" : "no"}`,
      bp.waybackUrl ? `- Wayback: ${bp.waybackUrl}` : "",
      "",
      "## Elementor",
      "- Import file: `elementor-template-import.json`",
      "- WP: Templates → Saved Templates → Import Templates",
      "",
      "## Limitations",
      ...(bp.limitations || []).map((l) => `- ${l}`),
      "",
      "## Tech",
      ...bp.tech.map((t) => `- ${t.name} (${t.confidence}): ${t.evidence}`),
      "",
      "## Pages",
      `- primary: ${bp.finalUrl || bp.sourceUrl || "—"}`,
      ...(bp.pages || []).map((p) => `- ${p.url} — ${p.title || "(no title)"}`),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const cssDir = zip.folder("css");
  bp.cssBundles.forEach((b, i) => {
    const name = b.url.startsWith("inline:")
      ? `inline-${i + 1}.css`
      : `sheet-${i + 1}.css`;
    cssDir?.file(name, b.css);
  });

  for (const a of bp.assets) {
    if (!a.captured || !a.base64 || !a.path) continue;
    try {
      zip.file(a.path, base64ToUint8(a.base64));
    } catch {
      /* skip */
    }
  }

  if (bp.pages?.length) {
    zip.file("pages.json", JSON.stringify(bp.pages, null, 2));
  }

  try {
    const tpl = bp.elementorTemplate || compileElementorFromBlueprint(bp);
    zip.file(
      "elementor-template-import.json",
      exportElementorTemplateJson(tpl),
    );
    zip.file(
      "elementor-template-with-meta.json",
      exportElementorTemplateJsonWithMeta(tpl),
    );
  } catch {
    /* skip */
  }

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        id: bp.id,
        title: bp.meta.title,
        sourceUrl: bp.sourceUrl,
        version: bp.version,
        options: bp.options,
        assets: slimAssets,
        design: bp.design,
        tech: bp.tech,
        pages: bp.pages,
        hasElementorTemplate: Boolean(bp.elementorTemplate),
      },
      null,
      2,
    ),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bp.id}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
