#!/usr/bin/env node
/**
 * Blueprint smoke suite v1.1
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:8080/";
const OUT_DIR = "/workspace/screenshots/smoke";
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS || 90_000);

mkdirSync(OUT_DIR, { recursive: true });

/** @type {{ name: string; ok: boolean; detail?: string; ms: number }[]} */
const results = [];

function record(name, ok, detail, started) {
  results.push({ name, ok, detail, ms: Date.now() - started });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""} (${Date.now() - started}ms)`);
}

async function withPage(browser, fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e?.message || e)));
  try {
    return await fn(page, { consoleErrors, pageErrors });
  } finally {
    await page.close();
  }
}

/** Fast scan: uncheck headless, set pages=1, keep wayback off speed */
async function configureFastScan(page) {
  // uncheck headless render (first checkbox)
  const checks = page.locator('label:has-text("Headless render") input[type="checkbox"]');
  if (await checks.count()) {
    if (await checks.first().isChecked()) await checks.first().uncheck();
  }
  const wayback = page.locator('label:has-text("Wayback") input[type="checkbox"]');
  if (await wayback.count()) {
    if (await wayback.first().isChecked()) await wayback.first().uncheck();
  }
  const assets = page.locator('label:has-text("Stiahnuť assety") input[type="checkbox"]');
  if (await assets.count()) {
    if (await assets.first().isChecked()) await assets.first().uncheck();
  }
  const pagesInput = page.locator('label:has-text("Crawl") input[type="number"]');
  if (await pagesInput.count()) {
    await pagesInput.first().fill("1");
  }
}

async function main() {
  console.log(`\n=== Blueprint smoke suite @ ${BASE} ===\n`);

  {
    const t = Date.now();
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(8000) });
      record("preflight.http", res.ok, `status ${res.status}`, t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      record("preflight.http", false, String(e?.message || e), t);
      printSummary();
      process.exit(1);
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    await withPage(browser, async (page, errs) => {
      const t = Date.now();
      await page.goto(BASE, { waitUntil: "networkidle", timeout: TIMEOUT });
      const title = await page.title();
      const hasHero = await page.getByRole("heading", { name: /Frontend blueprint|Zadaj URL/i }).count();
      const hasScan = await page.getByRole("button", { name: /Vytvoriť blueprint/i }).count();
      const hasCompare = await page.getByText(/Porovnať blueprinty/i).count();
      await page.screenshot({ path: `${OUT_DIR}/01-home.png`, fullPage: true });
      record(
        "smoke.home",
        /Blueprint/i.test(title) && hasHero > 0 && hasScan > 0 && hasCompare > 0 && errs.pageErrors.length === 0,
        `hero=${hasHero} compare=${hasCompare}`,
        t,
      );
    });

    await withPage(browser, async (page, errs) => {
      const t = Date.now();
      await page.goto(BASE, { waitUntil: "networkidle", timeout: TIMEOUT });
      await configureFastScan(page);
      await page.getByPlaceholder("https://moja-appka.com").fill("https://example.com");
      await page.getByRole("button", { name: /Vytvoriť blueprint/i }).click();
      await page.waitForSelector("text=BLUEPRINT_", { timeout: TIMEOUT });
      const body = await page.locator("body").innerText();
      const idMatch = body.match(/BLUEPRINT_[A-Z0-9_]+/i);
      await page.screenshot({ path: `${OUT_DIR}/02-url-scan.png`, fullPage: true });
      record(
        "smoke.url_scan",
        Boolean(idMatch && /Example Domain|example/i.test(body) && errs.pageErrors.length === 0),
        `id=${idMatch?.[0]}`,
        t,
      );
    });

    await withPage(browser, async (page, errs) => {
      const t = Date.now();
      await page.goto(BASE, { waitUntil: "networkidle", timeout: TIMEOUT });
      await page.getByRole("tab", { name: /Vložiť HTML/i }).click();
      await page.getByPlaceholder("https://povodna-domena.sk").fill("https://offline.example");
      const html = `<!DOCTYPE html><html lang="sk"><head><title>Offline Restore</title>
        <meta name="description" content="paste test"/><style>:root{--c:#111}</style>
        </head><body><h1 id="main">Obnovená appka</h1>
        <a href="/home">Domov</a>
        <form action="/login" method="post"><input name="user" required/></form>
        </body></html>`;
      await page.locator("textarea").fill(html);
      await page.getByRole("button", { name: /Vytvoriť blueprint/i }).click();
      await page.waitForSelector("text=Offline Restore", { timeout: TIMEOUT });
      const body = await page.locator("body").innerText();
      await page.screenshot({ path: `${OUT_DIR}/03-html-scan.png`, fullPage: true });
      record(
        "smoke.html_scan",
        body.includes("Offline Restore") && errs.pageErrors.length === 0,
        "paste ok",
        t,
      );
    });

    await withPage(browser, async (page, errs) => {
      const t = Date.now();
      await page.goto(BASE, { waitUntil: "networkidle", timeout: TIMEOUT });
      await configureFastScan(page);
      await page.getByPlaceholder("https://moja-appka.com").fill("https://example.com");
      await page.getByRole("button", { name: /Vytvoriť blueprint/i }).click();
      await page.waitForSelector("text=BLUEPRINT_", { timeout: TIMEOUT });

      const tabs = [
        { name: /Prehľad/i, expect: /Tech stack|SEO|Obmedzenia/i },
        { name: /Dizajn/i, expect: /Farby|Fonty|CSS/i },
        { name: /Štruktúra/i, expect: /DOM outline|Nadpisy|Odkazy/i },
        { name: /Stránky/i, expect: /Crawl mapa|Primary/i },
        { name: /Assety/i, expect: /Assety|captured/i },
        { name: /Náhľad 1:1/i, expect: /Náhľad zachyteného/i },
        { name: /^JSON$/i, expect: /Blueprint JSON|version/i },
      ];
      let pass = 0;
      for (const tab of tabs) {
        await page.getByRole("tab", { name: tab.name }).click();
        await page.waitForTimeout(200);
        const text = await page.locator("body").innerText();
        if (tab.expect.test(text)) pass += 1;
      }
      await page.screenshot({ path: `${OUT_DIR}/04-tabs.png`, fullPage: true });
      record("smoke.tabs", pass === tabs.length && errs.pageErrors.length === 0, `${pass}/${tabs.length}`, t);
    });

    await withPage(browser, async (page, errs) => {
      const t = Date.now();
      await page.goto(BASE, { waitUntil: "networkidle", timeout: TIMEOUT });
      await configureFastScan(page);
      await page.getByPlaceholder("https://moja-appka.com").fill("https://example.com");
      await page.getByRole("button", { name: /Vytvoriť blueprint/i }).click();
      await page.waitForSelector("text=BLUEPRINT_", { timeout: TIMEOUT });
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      const jsonBtn = page.getByRole("button", { name: /^JSON$/i });
      const dlJson = page.getByRole("button", { name: /Stiahnuť JSON/i });
      const zipBtn = page.getByRole("button", { name: /Export ZIP/i });
      const ok =
        (await jsonBtn.count()) > 0 &&
        (await dlJson.count()) > 0 &&
        (await zipBtn.count()) > 0 &&
        errs.pageErrors.length === 0;
      await page.screenshot({ path: `${OUT_DIR}/05-export.png` });
      record("smoke.export", ok, "export buttons", t);
    });

    await withPage(browser, async (page, errs) => {
      const t = Date.now();
      await page.goto(BASE, { waitUntil: "networkidle", timeout: TIMEOUT });
      await configureFastScan(page);
      await page.getByPlaceholder("https://moja-appka.com").fill("https://example.com");
      await page.getByRole("button", { name: /Vytvoriť blueprint/i }).click();
      await page.waitForSelector("text=BLUEPRINT_", { timeout: TIMEOUT });
      // second scan slightly different path for history variety - just reload check
      await page.reload({ waitUntil: "networkidle" });
      const body = await page.locator("body").innerText();
      const hasHistory = /História \(\d+\)/i.test(body);
      const hasCompare = /Porovnať blueprinty/i.test(body);
      await page.screenshot({ path: `${OUT_DIR}/06-history.png`, fullPage: true });
      record(
        "smoke.history_compare",
        hasHistory && hasCompare && errs.pageErrors.length === 0,
        `history=${hasHistory}`,
        t,
      );
    });

    await withPage(browser, async (page, errs) => {
      const t = Date.now();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(BASE, { waitUntil: "networkidle", timeout: TIMEOUT });
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const noHOverflow = overflow.scrollWidth <= overflow.clientWidth + 2;
      const scanVisible = await page.getByRole("button", { name: /Vytvoriť blueprint/i }).isVisible();
      await page.screenshot({ path: `${OUT_DIR}/07-mobile.png`, fullPage: true });
      record(
        "smoke.mobile",
        noHOverflow && scanVisible && errs.pageErrors.length === 0,
        `scrollW=${overflow.scrollWidth}`,
        t,
      );
    });

    await withPage(browser, async (page, errs) => {
      const t = Date.now();
      await page.goto(BASE, { waitUntil: "networkidle", timeout: TIMEOUT });
      await page.waitForTimeout(600);
      const realConsole = errs.consoleErrors.filter(
        (e) => !/favicon|Download the React DevTools/i.test(e),
      );
      record(
        "smoke.console_clean",
        realConsole.length === 0 && errs.pageErrors.length === 0,
        realConsole.slice(0, 2).join(" | ") || "clean",
        t,
      );
    });
  } finally {
    await browser.close();
  }

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  writeFileSync(
    `${OUT_DIR}/report.json`,
    JSON.stringify({ base: BASE, passed, total: results.length, results }, null, 2),
  );
  console.log(`\n=== Summary ===\nPassed: ${passed}/${results.length}`);
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  FAIL ${r.name}: ${r.detail}`);
  }
  console.log(`Report: ${OUT_DIR}/report.json\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
