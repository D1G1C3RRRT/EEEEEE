/**
 * Headless render via Playwright (SPA-friendly HTML snapshot).
 */

const HEADLESS_SHELL =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  "/opt/pw-browsers/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";

export type RenderResult = {
  html: string;
  finalUrl: string;
  statusCode: number | null;
  title: string;
};

export async function renderPageHtml(url: string): Promise<RenderResult> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    executablePath: HEADLESS_SHELL,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "BlueprintScanner/1.1 (+public frontend reconstruction; headless)",
    });
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 25_000,
    });
    // give late client paint a moment
    await page.waitForTimeout(400);
    const html = await page.content();
    return {
      html,
      finalUrl: page.url(),
      statusCode: response?.status() ?? null,
      title: await page.title(),
    };
  } finally {
    await browser.close();
  }
}
