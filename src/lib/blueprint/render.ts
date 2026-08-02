/**
 * Headless render via Playwright (SPA-friendly HTML snapshot).
 * Delegates to browser process shield — always closes Chromium.
 */

import {
  renderWithBrowserShield,
  type HardenedRenderResult,
} from "@/lib/scanner/browser";

export type RenderResult = {
  html: string;
  finalUrl: string;
  statusCode: number | null;
  title: string;
};

export async function renderPageHtml(
  url: string,
  opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<RenderResult> {
  const r: HardenedRenderResult = await renderWithBrowserShield(url, {
    signal: opts?.signal,
    timeoutMs: opts?.timeoutMs ?? 30_000,
  });
  if (r.aborted) {
    const e = new Error("Headless render aborted");
    e.name = "AbortError";
    throw e;
  }
  return {
    html: r.html,
    finalUrl: r.finalUrl,
    statusCode: r.statusCode,
    title: r.title,
  };
}
