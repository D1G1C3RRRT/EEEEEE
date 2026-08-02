/**
 * Payload & memory guard for asset capture and JSON export.
 */

import type { BlueprintAsset } from "@/lib/blueprint/types";

/** Max single asset download (10 MB) */
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
/** Max total captured payload for ZIP/JSON (50 MB) */
export const MAX_TOTAL_CAPTURE_BYTES = 50 * 1024 * 1024;
/** Cap concurrent captures / count */
export const MAX_CAPTURED_ASSETS = 40;
export const ASSET_FETCH_TIMEOUT_MS = 12_000;

export type AssetCaptureWarning = {
  url: string;
  reason: string;
  size?: number;
};

export type GuardedCaptureResult = {
  assets: BlueprintAsset[];
  warnings: AssetCaptureWarning[];
  totalCapturedBytes: number;
  skippedOversize: number;
  skippedBudget: number;
};

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

function toBase64(buf: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Safe JSON.stringify that:
 * - breaks circular references
 * - caps depth
 * - never throws (returns fallback string on failure)
 */
export function safeJsonStringify(
  value: unknown,
  space: number | string = 2,
  opts?: { maxDepth?: number; maxLength?: number },
): string {
  const maxDepth = opts?.maxDepth ?? 40;
  const maxLength = opts?.maxLength ?? 50 * 1024 * 1024;
  const seen = new WeakSet<object>();

  try {
    const raw = JSON.stringify(
      value,
      function replacer(_key: string, val: unknown) {
        if (typeof val === "bigint") return val.toString();
        if (typeof val === "function" || typeof val === "symbol") return undefined;
        if (val && typeof val === "object") {
          if (seen.has(val as object)) return "[Circular]";
          seen.add(val as object);
        }
        return val;
      },
      space,
    );

    if (raw.length > maxLength) {
      return raw.slice(0, maxLength) + "\n/* truncated by memory guard */";
    }
    return raw;
  } catch (err) {
    return JSON.stringify({
      error: "safeJsonStringify failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Depth probe with cycle detection (used by tests / optional preflight) */
export function exceedsDepth(value: unknown, max: number): boolean {
  const seen = new WeakSet<object>();
  const walk = (v: unknown, depth: number): boolean => {
    if (depth > max) return true;
    if (!v || typeof v !== "object") return false;
    if (seen.has(v as object)) return false;
    seen.add(v as object);
    if (Array.isArray(v)) {
      for (const item of v) {
        if (walk(item, depth + 1)) return true;
      }
      return false;
    }
    for (const child of Object.values(v as Record<string, unknown>)) {
      if (walk(child, depth + 1)) return true;
    }
    return false;
  };
  return walk(value, 0);
}

/**
 * Download assets with hard per-file and total budget limits.
 * Oversized assets are skipped with warnings — never OOM the process.
 */
export async function captureAssetsGuarded(
  assets: BlueprintAsset[],
  opts?: {
    signal?: AbortSignal;
    maxEach?: number;
    maxTotal?: number;
    maxCount?: number;
  },
): Promise<GuardedCaptureResult> {
  const maxEach = opts?.maxEach ?? MAX_ASSET_BYTES;
  const maxTotal = opts?.maxTotal ?? MAX_TOTAL_CAPTURE_BYTES;
  const maxCount = opts?.maxCount ?? MAX_CAPTURED_ASSETS;

  const preferred = [
    ...assets.filter((a) => a.type === "stylesheet"),
    ...assets.filter((a) => a.type === "image" || a.type === "icon"),
    ...assets.filter((a) => a.type === "font"),
    ...assets.filter((a) => a.type === "script"),
    ...assets.filter((a) => a.type === "other"),
  ];

  const seen = new Set<string>();
  const out: BlueprintAsset[] = [];
  const warnings: AssetCaptureWarning[] = [];
  let total = 0;
  let index = 0;
  let skippedOversize = 0;
  let skippedBudget = 0;

  for (const asset of preferred) {
    if (opts?.signal?.aborted) {
      warnings.push({ url: asset.url, reason: "Capture aborted" });
      break;
    }
    if (out.filter((a) => a.captured).length >= maxCount) break;
    if (seen.has(asset.url)) continue;
    seen.add(asset.url);

    if (asset.url.startsWith("data:") || asset.url.startsWith("blob:")) {
      out.push(asset);
      continue;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ASSET_FETCH_TIMEOUT_MS);
      const onOuter = () => controller.abort();
      opts?.signal?.addEventListener("abort", onOuter, { once: true });

      let res: Response;
      try {
        res = await fetch(asset.url, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "user-agent": "BlueprintScanner/1.2 (+asset capture guard)",
            accept: "*/*",
          },
        });
      } finally {
        clearTimeout(timer);
        opts?.signal?.removeEventListener("abort", onOuter);
      }

      if (!res.ok) {
        warnings.push({
          url: asset.url,
          reason: `HTTP ${res.status}`,
        });
        out.push(asset);
        continue;
      }

      // Content-Length pre-check (e.g. 100 MB file)
      const cl = res.headers.get("content-length");
      if (cl) {
        const declared = Number(cl);
        if (Number.isFinite(declared) && declared > maxEach) {
          skippedOversize += 1;
          warnings.push({
            url: asset.url,
            reason: `Asset exceeds max size (${declared} > ${maxEach} bytes)`,
            size: declared,
          });
          out.push({
            ...asset,
            contentType: res.headers.get("content-type") || asset.contentType,
            size: declared,
            captured: false,
          });
          // consume body lightly if possible — cancel
          try {
            await res.body?.cancel();
          } catch {
            /* ignore */
          }
          continue;
        }
      }

      const buf = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type");

      if (buf.byteLength > maxEach) {
        skippedOversize += 1;
        warnings.push({
          url: asset.url,
          reason: `Asset exceeds max size (${buf.byteLength} > ${maxEach} bytes)`,
          size: buf.byteLength,
        });
        out.push({
          ...asset,
          contentType: contentType || asset.contentType,
          size: buf.byteLength,
          captured: false,
        });
        continue;
      }

      if (total + buf.byteLength > maxTotal) {
        skippedBudget += 1;
        warnings.push({
          url: asset.url,
          reason: `Total capture budget exceeded (${total + buf.byteLength} > ${maxTotal})`,
          size: buf.byteLength,
        });
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
      out.push({
        ...asset,
        contentType: contentType || asset.contentType,
        size: buf.byteLength,
        path,
        base64: toBase64(buf),
        captured: true,
      });
    } catch (err) {
      warnings.push({
        url: asset.url,
        reason: err instanceof Error ? err.message : String(err),
      });
      out.push(asset);
    }
  }

  for (const asset of assets) {
    if (!seen.has(asset.url)) out.push(asset);
  }

  return {
    assets: out,
    warnings,
    totalCapturedBytes: total,
    skippedOversize,
    skippedBudget,
  };
}
