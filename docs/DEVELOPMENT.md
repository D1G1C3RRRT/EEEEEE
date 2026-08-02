# Development

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | **22** (CI uses `node-version: "22"`) |
| npm | ships with Node 22 |
| Playwright Chromium | provided in CI/dev image when headless is used (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optional) |

No Docker required for core development.

## Setup

```bash
git clone https://github.com/NEXIFY-STUDIO/moon-berry-kind-cap.git
cd moon-berry-kind-cap
npm ci
npm run dev
```

Dev server binds **`0.0.0.0:8080`** (`package.json` → `vite dev --host 0.0.0.0 --port 8080`).

Optional quality gates locally:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:smoke   # needs Chromium + running app or embedded runner config
npm run build
```

## Environment variables

**None required for core public scan.**

| Variable | When |
|----------|------|
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Override headless shell path (`scanner/browser.ts`) |
| `CI=true` | Set during `npm run build` in GitHub Actions |

Do not commit `.env` files with secrets. Auth scaffolding under `src/lib/auth/` may use Better Auth patterns; product scan path does not require OAuth keys.

## Code layout conventions

| Area | Convention |
|------|------------|
| Language | TypeScript strict (`tsconfig.json`) |
| UI | React 19 function components · Tailwind v4 utilities · Radix/shadcn primitives in `components/ui` |
| Server | TanStack Start `createServerFn` in `lib/blueprint/server.ts` |
| Types | Canonical Blueprint types in `lib/blueprint/types.ts` |
| Hardening | Cross-cutting guards live under `lib/scanner/` |
| Tests | Colocate by domain under `tests/unit/*.test.ts` · UI under `tests/unit/ui/` |
| Naming | kebab-case files · PascalCase React components · camelCase functions |

## Adding a scanner module

1. Implement pure logic under `src/lib/blueprint/` or `src/lib/scanner/`.
2. Wire into `scanToBlueprint` (`scan.ts`) or pipeline only if needed on every scan.
3. Extend `Blueprint` / options in `types.ts` if the public schema changes.
4. Add unit tests with fixtures under `tests/fixtures/` or inline HTML strings.
5. Update `docs/API.md` + `CHANGELOG.md` if options or exports change.
6. Keep SSRF and size limits intact — never fetch user-controlled private hosts.

## Adding a UI control

1. Prefer existing `ScanForm` options + long-press `IconToggle` pattern.
2. Map UI state 1:1 to `ScanRequest` fields (`render`, `wayback`, `maxPages`, `captureAssets`, `wpJetEngine`).
3. Preserve smoke selectors: CTA **Vytvoriť blueprint**, `data-testid` on toggles (`opt-render`, `opt-wayback`, …).
4. Cover with `tests/unit/ui/scan-form.test.tsx` where behavior changes.

## Debug tips

| Symptom | Action |
|---------|--------|
| Empty SPA blueprint | Enable Headless; check `isThinHtml` / `thinHtmlReasons` |
| Flaky live URL test | Prefer HTML fixtures; integration hits `example.com` |
| Playwright hang | Confirm process cleanup in `browser.ts`; 30s page timeout |
| Vault full / quota | localStorage trims to 15 blueprints; oversized drops base64 |
| Smoke fail on text | Do not rename CTA / toggle aria labels without updating `tests/smoke/smoke-runner.mjs` |

Fixtures: `tests/fixtures/`. Helpers: `tests/helpers/render.tsx`.

## Useful scripts

| Script | Use |
|--------|-----|
| `scripts/browser-smoke.mjs` | Generic page screenshot + console check |
| `scripts/qa-scan.mjs` | Interactive QA against running app |
| `scripts/migrate.mjs` | DB migrations (`npm run db:migrate`) |
| `scripts/kill-dev.sh` / `kill-port-servers.sh` | Local process cleanup |

## Do not

- Rewrite `AGENTS.md` for product docs (sandbox agent instructions only).
- Commit `node_modules`, PAT, or real secrets.
- Promise backend cloning in UI copy or docs.
