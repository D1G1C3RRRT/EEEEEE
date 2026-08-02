import type { BlueprintAsset } from "./types";
import {
  captureAssetsGuarded,
  type AssetCaptureWarning,
} from "@/lib/scanner/assets";

export type { AssetCaptureWarning };

/**
 * Download a subset of listed assets as base64 for offline ZIP export.
 * Uses payload memory guard (10 MB / file, 50 MB total).
 */
export async function captureAssets(
  assets: BlueprintAsset[],
  opts?: { signal?: AbortSignal },
): Promise<BlueprintAsset[]> {
  const result = await captureAssetsGuarded(assets, {
    signal: opts?.signal,
  });
  return result.assets;
}

/** Full guarded capture with warnings (preferred for scan pipeline). */
export async function captureAssetsWithWarnings(
  assets: BlueprintAsset[],
  opts?: { signal?: AbortSignal },
) {
  return captureAssetsGuarded(assets, { signal: opts?.signal });
}
