# Runbook

Operational guide for failed or degraded scans.

## Quick triage

| Symptom | Likely cause | First action |
|---------|--------------|--------------|
| Immediate error on submit | Invalid URL / SSRF block | Check host not private; use HTML mode for local files |
| DNS / ENOTFOUND | Domain dead or typo | Verify URL in browser; try Wayback on |
| HTTP 403 / 429 | Bot protection / rate limit | Retry later; disable aggressive crawl; Wayback |
| Empty content | Thin SPA shell | Enable **Headless render**; read `isThinHtml` |
| Partial pages | Crawl URL failures | Expand Failed URLs; lower `maxPages` |
| Stuck “Skenujem…” | Client hang / network | **Zrušiť** (AbortSignal); refresh |
| Playwright timeout | Slow site / no binary | 30s page limit; fall back to HTTP |
| ZIP incomplete | Asset budget | Check skipped oversize (10 MB / 50 MB total) |

## Cancel scan

1. UI shows **Zrušiť** while busy.
2. Client aborts `AbortController`; server sees `signal.aborted`.
3. Response may be `{ ok: false, code: "ABORTED" }` or partial blueprint with `scanStatus: "aborted"`.
4. UI returns to idle without process crash.

## Interpreting blueprint flags

| Field | Values / meaning |
|-------|------------------|
| `scanStatus: complete` | All attempted crawl URLs succeeded (or single page) |
| `scanStatus: partial` | Some crawl URLs failed; `partialStats` + `scanWarnings.failedUrls` filled |
| `scanStatus: aborted` | User/system cancel mid-flight; harvested pages may still exist |
| `isThinHtml: true` | Body looks like SPA shell; trust less text/structure |
| `thinHtmlReasons[]` | Human reasons (minimal text, framework markers, …) |
| `rendered: true` | Headless DOM used |
| `waybackUrl` | Snapshot URL if archive stage used |
| `partialErrors[]` | Non-fatal stage messages (`headless` / `http` / `wayback` / `assets` / …) |
| `limitations[]` | Always present caveats (frontend-only, etc.) |

## Recovery playbooks

### DNS failure
1. Confirm public DNS resolution.
2. Retry once.
3. If historical site: enable Wayback.

### 403 / 429
1. Reduce crawl (`maxPages` → 1).
2. Disable asset capture temporarily.
3. Retry with backoff (built-in transient retry helps 429/5xx).
4. Wayback fallback if enabled.

### Thin HTML / SPA
1. Ensure **Headless render** on.
2. If headless unavailable in runtime, document limitation; use Architecture Compiler prompt from tech + links heuristics.
3. Do not claim full visual clone.

### Partial crawl
1. Read Failed URLs list in UI.
2. Re-scan with lower concurrency pressure (`maxPages` smaller).
3. Accept partial blueprint for pages that succeeded.

### Browser / process issues
1. Confirm no orphaned Chromium (server logs).
2. Shield always force-closes; if launch fails, pipeline should degrade to HTTP.
3. Check `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` on custom images.

### API / 500 from server fn
1. Inspect structured `{ ok: false, error, code }`.
2. `DNS_FAILURE` / `TIMEOUT` / `ABORTED` are expected classes.
3. Unexpected: check server logs for `[api-guard]`, `[unhandledRejection]`.

## Logs & console checklist

| Location | What to look for |
|----------|------------------|
| Browser console | Failed module load, MIME text/html on `/assets/*` |
| Server logs | `[api-guard]`, `[blueprint] DB save failed`, `[unhandledRejection]` |
| Blueprint `notes` / `limitations` | User-facing explanations |
| `partialErrors` | Stage-level degradation |

## Escalation

1. Repro with **HTML mode** fixture (eliminates network).
2. Repro with `https://example.com` (known public target).
3. Capture blueprint `id`, `scanStatus`, `partialStats`, error `code`.
4. File issue with [bug template](../.github/ISSUE_TEMPLATE/bug_report.md) — **no secrets**.
