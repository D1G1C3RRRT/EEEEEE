import type { BlueprintAsset } from "./types";

const MAX_ASSETS = 40;
const MAX_BYTES_EACH = 400_000;
const MAX_TOTAL_BYTES = 4_000_000;

function extFromUrl(url: string, contentType: string | null): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-zA-Z0-9]{1,8})$/);
    if (m) return m[1].toLowerCase();
  } catch {
    /* ignore */
  }
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("svg")) return "svg";
  if (contentType?.includes("woff2")) return "woff2";
  if (contentType?.includes("woff")) return "woff";
  if (contentType?.includes("css")) return "css";
  if (contentType?.includes("javascript")) return "js";
  return "bin";
}

function folderFor(type: BlueprintAsset["type"]): string {
  switch (type) {
    case "image":
    case "icon":
      return "assets/images";
    case "font":
      return "assets/fonts";
    case "script":
      return "assets/js";
    case "stylesheet":
      return "assets/css";
    default:
      return "assets/other";
  }
}

/**
 * Download a subset of listed assets as base64 for offline ZIP export.
 * Skips data: URLs and huge files.
 */
export async function captureAssets(
  assets: BlueprintAsset[],
): Promise<BlueprintAsset[]> {
  const preferred = [
    ...assets.filter((a) => a.type === "stylesheet"),
    ...assets.filter((a) => a.type === "image" || a.type === "icon"),
    ...assets.filter((a) => a.type === "font"),
    ...assets.filter((a) => a.type === "script"),
    ...assets.filter((a) => a.type === "other"),
  ];

  const seen = new Set<string>();
  const out: BlueprintAsset[] = [];
  let total = 0;
  let index = 0;

  for (const asset of preferred) {
    if (out.filter((a) => a.captured).length >= MAX_ASSETS) break;
    if (seen.has(asset.url)) continue;
    seen.add(asset.url);
    if (asset.url.startsWith("data:") || asset.url.startsWith("blob:")) {
      out.push(asset);
      continue;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(asset.url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": "BlueprintScanner/1.1 (+asset capture)",
          accept: "*/*",
        },
      });
      clearTimeout(timer);
      if (!res.ok) {
        out.push(asset);
        continue;
      }
      const contentType = res.headers.get("content-type");
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_BYTES_EACH || total + buf.byteLength > MAX_TOTAL_BYTES) {
        out.push({
          ...asset,
          contentType: contentType || asset.contentType,
          size: buf.byteLength,
          captured: false,
        });
        continue;
      }
      total += buf.byteLength;
      index += 1;
      const ext = extFromUrl(asset.url, contentType);
      const path = `${folderFor(asset.type)}/${String(index).padStart(3, "0")}.${ext}`;
      // base64 without Buffer dependency issues in edge
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      out.push({
        ...asset,
        contentType: contentType || asset.contentType,
        size: buf.byteLength,
        path,
        base64,
        captured: true,
      });
    } catch {
      out.push(asset);
    }
  }

  // append remaining uncaptured urls not visited
  for (const asset of assets) {
    if (!seen.has(asset.url)) out.push(asset);
  }
  return out;
}
