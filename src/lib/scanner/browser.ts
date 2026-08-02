/**
 * Playwright / browser process shield.
 * Every launch is try/finally force-closed; hard per-page timeout; abort-aware.
 */

export const PAGE_TIMEOUT_MS = 30_000;
export const BROWSER_LAUNCH_TIMEOUT_MS = 15_000;

const HEADLESS_SHELL =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  "/opt/pw-browsers/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";

export type HardenedRenderResult = {
  html: string;
  finalUrl: string;
  statusCode: number | null;
  title: string;
  timedOut: boolean;
  aborted: boolean;
};

type BrowserLike = {
  close: () => Promise<void>;
  newPage: (opts?: Record<string, unknown>) => Promise<PageLike>;
};

type PageLike = {
  goto: (
    url: string,
    opts?: { waitUntil?: string; timeout?: number },
  ) => Promise<{ status: () => number } | null>;
  waitForTimeout: (ms: number) => Promise<void>;
  content: () => Promise<string>;
  url: () => string;
  title: () => Promise<string>;
  close?: () => Promise<void>;
};

function abortError(message = "Browser render aborted"): Error {
  const e = new Error(message);
  e.name = "AbortError";
  return e;
}

async function forceCloseBrowser(
  browser: BrowserLike | null | undefined,
): Promise<void> {
  if (!browser) return;
  try {
    await Promise.race([
      browser.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
    ]);
  } catch {
    /* never throw from cleanup */
  }
}

/**
 * Race a promise against a hard wall-clock timeout and optional AbortSignal.
 * Does not cancel the underlying work by itself — caller must close browser.
 */
export async function withHardTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
  label = "operation",
): Promise<T> {
  if (signal?.aborted) throw abortError();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(abortError());
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      const err = new Error(
        `${label} timed out after ${timeoutMs}ms (hard limit)`,
      );
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    work.then(
      (v) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(v);
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      },
    );
  });
}

/**
 * Headless HTML capture with mandatory browser.close() in finally.
 * Never leaves Chromium processes orphaned on timeout / abort / throw.
 */
export async function renderWithBrowserShield(
  url: string,
  opts?: {
    signal?: AbortSignal;
    /** Hard wall clock for entire browser session (default 30s) */
    timeoutMs?: number;
    userAgent?: string;
  },
): Promise<HardenedRenderResult> {
  const timeoutMs = opts?.timeoutMs ?? PAGE_TIMEOUT_MS;
  if (opts?.signal?.aborted) {
    return {
      html: "",
      finalUrl: url,
      statusCode: null,
      title: "",
      timedOut: false,
      aborted: true,
    };
  }

  let browser: BrowserLike | null = null;
  let timedOut = false;
  let aborted = false;

  try {
    const result = await withHardTimeout(
      (async () => {
        const { chromium } = await import("playwright");
        browser = (await chromium.launch({
          executablePath: HEADLESS_SHELL,
          headless: true,
          timeout: BROWSER_LAUNCH_TIMEOUT_MS,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-extensions",
            "--disable-background-networking",
          ],
        })) as BrowserLike;

        if (opts?.signal?.aborted) throw abortError();

        const page = await browser.newPage({
          viewport: { width: 1280, height: 800 },
          userAgent:
            opts?.userAgent ||
            "BlueprintScanner/1.2 (+public frontend reconstruction; headless shield)",
        });

        try {
          if (opts?.signal?.aborted) throw abortError();
          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: Math.min(25_000, timeoutMs - 2_000),
          });
          // short settle — never long enough to outlive hard timeout
          await page.waitForTimeout(300);
          const html = await page.content();
          return {
            html,
            finalUrl: page.url(),
            statusCode: response?.status() ?? null,
            title: await page.title(),
            timedOut: false,
            aborted: false,
          } satisfies HardenedRenderResult;
        } finally {
          try {
            await page.close?.();
          } catch {
            /* ignore */
          }
        }
      })(),
      timeoutMs,
      opts?.signal,
      "Playwright page render",
    );
    return result;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") aborted = true;
      if (err.name === "TimeoutError" || /timed out/i.test(err.message)) {
        timedOut = true;
      }
    }
    if (aborted) {
      return {
        html: "",
        finalUrl: url,
        statusCode: null,
        title: "",
        timedOut: false,
        aborted: true,
      };
    }
    if (timedOut) {
      // surface as throw so pipeline can fall back to HTTP
      const e = new Error(`Headless render timeout (${timeoutMs}ms) for ${url}`);
      e.name = "TimeoutError";
      throw e;
    }
    throw err;
  } finally {
    // HARD GUARANTEE: browser process always closed
    await forceCloseBrowser(browser);
    browser = null;
  }
}
