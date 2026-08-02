# Testing

## Pyramid

```text
        ┌────────────┐
        │   smoke    │  Playwright UI (optional in CI)
        ├────────────┤
        │ integration│  live public URL (example.com)
        ├────────────┤
        │ unit + UI  │  Vitest · happy-dom (bulk of suite)
        └────────────┘
```

**Current gate:** `npm run test:unit` → **234** tests · **31** files (as of docs overhaul).

## Commands

| Command | Scope |
|---------|--------|
| `npm test` | `vitest run` (default config) |
| `npm run test:unit` | `tests/unit` + `tests/integration` |
| `npm run test:smoke` | `node tests/smoke/smoke-runner.mjs` |
| `npm run test:all` | unit/integration then smoke |

Config: `vitest.config.ts`.

## Category matrix

| Category | Path | Covers |
|----------|------|--------|
| Utils | `tests/unit/utils.test.ts` | `cn`, `formatBytes`, helpers |
| Tech detect | `tests/unit/detect-tech.test.ts` | stack heuristics |
| HTML scan | `tests/unit/scan-html.test.ts` | parse, meta, design, forms, outline |
| Scan options | `tests/unit/scan-options.test.ts` | wpJetEngine, maxPages matrix |
| Security / SSRF | `tests/unit/scan-security.test.ts` | private hosts blocked |
| Storage / ZIP | `tests/unit/storage.test.ts` | vault + export |
| Compare | `tests/unit/compare.test.ts`, `compare-extended.test.ts` | blueprint diff |
| Design system | `tests/unit/design-system.test.ts`, `design-system-forms.test.ts` | tokens, forms |
| Meta URLs | `tests/unit/meta-urls.test.ts` | absolute OG/Twitter |
| Thin HTML | `tests/unit/thin-html.test.ts` | SPA shell detection |
| Retry | `tests/unit/retry.test.ts` | transient backoff |
| Partial crawl | `tests/unit/partial-crawl-recovery.test.ts` | fault isolation |
| Capture assets | `tests/unit/capture-assets.test.ts` | budgets / skip |
| Hardening | `tests/unit/hardening-stability.test.ts` | API guard, edge failures |
| WP / Jet | `tests/unit/wordpress-jetengine.test.ts`, `jet-dynamic-catalog.test.ts` | architecture extract |
| Elementor | `tests/unit/elementor-compiler.test.ts`, `elementor-dynamic-fields.test.ts` | template JSON |
| Parse settings | `tests/unit/parse-data-settings.test.ts` | data-settings HTML entities |
| JSON-LD | `tests/unit/json-ld.test.ts` | structured data |
| AI Rebuild | `tests/unit/ai-rebuild-prompter.test.ts` | prompt + Tailwind fragment |
| Architecture | `tests/unit/architecture-compiler.test.ts` | SPA-aware prompt |
| UI · form | `tests/unit/ui/scan-form.test.tsx` | toggles, CTA, cancel, modes |
| UI · view | `tests/unit/ui/blueprint-view.test.tsx` | tabs, exports, badges |
| UI · history | `tests/unit/ui/history-list.test.tsx` | vault list |
| UI · import | `tests/unit/ui/import-normalize.test.ts` | JSON import normalize |
| UI · e2e logic | `tests/unit/ui/e2e-flow-logic.test.ts` | flow glue without browser |
| UI · prod guard | `tests/unit/ui/production-build-guard.test.ts` | MIME / blank deploy guards |
| Integration | `tests/integration/scan-url.test.ts` | live `https://example.com` |
| Smoke | `tests/smoke/smoke-runner.mjs` | browser UI end-to-end |

## Fixtures & helpers

| Path | Role |
|------|------|
| `tests/fixtures/minimal-blueprint.ts` | Minimal Blueprint object |
| `tests/helpers/render.tsx` | UI test render helper |

Prefer **inline HTML strings** for deterministic unit scans over network.

## Smoke runner expectations

`tests/smoke/smoke-runner.mjs` exercises the real UI. Critical contracts:

- CTA accessible name matches `/Vytvoriť blueprint/i`
- Option toggles via `data-testid`: `opt-render`, `opt-wayback`, `opt-crawl`, `opt-assets`, `opt-wp`
- Long-press / keyboard toggle behavior remains available
- Scan flow does not crash the page

Update smoke selectors in the **same PR** as UI copy or testid changes.

## CI expectations

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) on `main` push/PR:

1. `npm ci`
2. `npm run typecheck`
3. `npm run test:unit`
4. `npm run build` (`CI=true`)

Smoke is **not** required on every CI run (heavier browser dependency). Run `test:all` locally before large UI merges.

**Merge rule:** typecheck + unit/integration green. No secrets in fixtures.

## Adding a test

1. Place under `tests/unit/<domain>.test.ts` or `tests/unit/ui/<component>.test.tsx`.
2. Name: `describe("area · behavior")` / `it("…")` matching existing style.
3. Mock network where possible; only integration should hit public internet.
4. Assert structured fields (`scanStatus`, `isThinHtml`, error `code`) not only snapshots of huge HTML.
5. Keep runtime low — avoid multi-megabyte base64 in fixtures.

## Known flakiness

| Source | Mitigation |
|--------|------------|
| Live DNS / example.com | Retry in CI; skip only if environment blocks egress |
| Headless binary missing | Unit path uses HTML mode; headless covered when binary present |
| localStorage in Node | Storage tests use happy-dom / guarded `window` |
