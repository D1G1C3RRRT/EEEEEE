# Security

## Threat model

| Asset | Risk | Control |
|-------|------|---------|
| Server-side fetch | SSRF to cloud metadata / internal nets | `assertPublicUrl` blocklist |
| HTML / assets | Memory exhaustion | Byte caps, asset budgets |
| Headless browser | Process leak / hang | try/finally close, hard timeouts |
| API surface | Unhandled rejection crash | `withApiGuard`, process guards |
| Blueprint JSON | Accidental secret storage | Never send cookies/auth headers; user paste only |
| Vault (localStorage) | XSS on same origin | Standard web XSS hygiene; no HttpOnly secrets stored |

**In scope:** public HTTP(S) page reconstruction.  
**Out of scope:** authenticated scraping, credential stuffing, bypassing access control of target sites.

## SSRF protections

`assertPublicUrl` in `src/lib/blueprint/scan.ts`:

- Protocols: **http** and **https** only
- Blocked hostnames: `localhost`, `metadata.google.internal`, `metadata.google`
- Private / special IPs: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `0.0.0.0`
- Host suffixes: `.local`, `.internal`

Local HTML must be submitted via **Vložiť HTML** mode, not `http://127.0.0.1`.

## What is never captured

- Request `Cookie` / `Authorization` headers to targets
- Target `.env`, private REST with auth, WebSocket payloads behind login
- Server-side secrets of Blueprint Scanner itself (none required for core scan)

Scanned **public** HTML may still contain emails or tokens the target site exposed — treat blueprints as sensitive if targets are sensitive.

## Payload & memory limits

| Limit | Value | Module |
|-------|------:|--------|
| HTML body | 2.5 MB | `scan.ts` / `pipeline.ts` |
| CSS files / bytes | 12 files · 800 KB | `scan.ts` |
| Single asset | **10 MB** | `scanner/assets.ts` `MAX_ASSET_BYTES` |
| Total capture | **50 MB** | `MAX_TOTAL_CAPTURE_BYTES` |
| Captured asset count | **40** | `MAX_CAPTURED_ASSETS` |
| Asset fetch timeout | 12 s | `ASSET_FETCH_TIMEOUT_MS` |
| Crawl pages | 1–20 | Zod + `MAX_CRAWL_PAGES` |
| Vault entries (local) | 15 | `storage.ts` |
| Server memory map | ~40 blueprints | `server.ts` |
| Safe JSON | Circular-safe stringify | `safeJsonStringify` |

Oversize assets are **skipped** with warnings — scan continues.

## Browser process shield

`src/lib/scanner/browser.ts`:

- Launch timeout **15 s**
- Per-page timeout **30 s**
- AbortSignal aborts render
- `forceCloseBrowser` in finally (never throws from cleanup)

## API error boundaries

- `withApiGuard` wraps server handlers → always JSON-shaped error, no connection drop
- Codes include: `ABORTED`, `TIMEOUT`, `DNS_FAILURE`, `HTTP_ERROR`, `ERROR`
- `installProcessErrorGuards` logs `unhandledRejection` / `uncaughtException` without killing the process

## Dependency hygiene

```bash
npm audit
```

Recommended in CI periodically. Pin critical deps via lockfile (`npm ci` in CI).

## Responsible disclosure

If you find a vulnerability in this project:

1. **Do not** open a public issue with exploit details.
2. Contact the repository owners via GitHub Security Advisories (preferred) or a private channel listed in the org profile.
3. Allow reasonable time for a fix before public disclosure.

## Operator checklist

- [ ] No PAT / API keys in repo or docs
- [ ] Production logs scrub query strings with tokens
- [ ] Headless only on trusted infra (resource cost + abuse)
- [ ] Rate-limit public scan endpoints if exposed to the internet (application-level; not built-in)
