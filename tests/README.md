# Blueprint test suite (v1.1)

## Categories

| Category | Path | What it covers |
| --- | --- | --- |
| Unit · utils | `tests/unit/utils.test.ts` | `cn`, `formatBytes`, `shortId` |
| Unit · tech detect | `tests/unit/detect-tech.test.ts` | stack heuristics |
| Unit · HTML scan | `tests/unit/scan-html.test.ts` | parse, meta, design, forms |
| Unit · security | `tests/unit/scan-security.test.ts` | SSRF blocklist |
| Unit · storage | `tests/unit/storage.test.ts` | localStorage + ZIP w/ assets |
| Unit · compare | `tests/unit/compare.test.ts` | blueprint diff |
| Integration · URL | `tests/integration/scan-url.test.ts` | live example.com (+ headless) |
| Smoke · browser | `tests/smoke/smoke-runner.mjs` | UI end-to-end |

## Commands

```bash
npm run test:unit
npm run test:smoke
npm run test:all
```
