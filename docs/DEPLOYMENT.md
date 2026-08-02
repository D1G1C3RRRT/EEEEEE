# Deployment

## Target

| Item | Value |
|------|--------|
| Platform | **Vercel** (Nitro preset) |
| Framework | TanStack Start + Vite 8 |
| Node | **22** |
| Build command | `npm run build` → `vite build && npm run db:migrate` |
| Config | `vite.config.ts` — `nitro({ preset: "vercel" })` **only when `command === "build"`** |

Dev must **not** enable Nitro’s second server (breaks single-port preview).

## Build locally

```bash
npm ci
npm run typecheck
npm run test:unit
npm run build
npm run preview   # 0.0.0.0:8080
```

Verify production assets: open preview, confirm no console error  
`Failed to load module script … MIME type "text/html"` (usually wrong base path or SPA fallback swallowing `/assets/*`).

## Runtime expectations

| Concern | Guidance |
|---------|----------|
| Serverless duration | Keep scans short; crawl ≤20 pages; timeouts enforced |
| Playwright / headless | Requires Chromium binary; may be **unavailable** on default Vercel serverless — prefer static HTTP + Wayback there, or dedicated worker with browsers |
| PGLite | Client/server embedded DB; `db:migrate` runs at build |
| Memory | Asset budgets prevent huge ZIPs; still avoid capturing media-heavy sites at max settings in tiny functions |
| Env | Core scan needs no secrets |

## Health / startup

- Dev/preview: HTTP 200 on `/`
- Optional agent helper: `startup.sh` probes `http://127.0.0.1:8080/` then starts `npm run dev` if down
- CI build success ≠ runtime headless success — validate fetch chain without Playwright when binary missing

## Preview vs production

| Mode | Command | Notes |
|------|---------|--------|
| Dev | `npm run dev` | HMR · PGLite bootstrap plugin · auth popup middleware |
| Preview | `npm run preview` | Serves production build |
| Prod (Vercel) | Git push → platform build | Nitro Vercel output |

## Rollback

1. `git revert` / redeploy previous successful commit on `main`
2. Confirm CI green on the rolled-back SHA
3. If vault schema changed, document migration — localStorage key `blueprint.vault.v1`

## GitHub Actions

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

```text
push/PR → main → ubuntu-latest → npm ci → typecheck → test:unit → build
```

Private free GitHub accounts may lack Actions minutes (`startup_failure`). Options: public repo, paid minutes, or rely on local/commit status checks.

## Checklist before release

- [ ] `typecheck` + `test:unit` green
- [ ] `build` + manual preview of home + one HTML-mode scan
- [ ] Smoke locally if UI changed
- [ ] CHANGELOG updated
- [ ] No secrets in client bundle
