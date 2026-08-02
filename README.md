# Blueprint Scanner

**Frontend reverse-spec** z verejnej URL alebo HTML → štruktúrovaný blueprint (JSON/ZIP), WordPress/JetEngine/Elementor extract, AI Rebuild Studio.

[![CI](https://github.com/NEXIFY-STUDIO/moon-berry-kind-cap/actions/workflows/ci.yml/badge.svg)](https://github.com/NEXIFY-STUDIO/moon-berry-kind-cap/actions/workflows/ci.yml)

## Stav (checklist)

| Oblast | Stav |
|--------|------|
| URL + HTML scan, SSRF guard | ✅ |
| Multi-page crawl + partial recovery + retry | ✅ |
| Design tokens, OG absolute URLs, thin-HTML warning | ✅ |
| WP / JetEngine / Elementor JSON export | ✅ |
| Cancel scan (AbortSignal) | ✅ |
| AI Rebuild Studio (prompt + Tailwind config) | ✅ |
| Favicon, Open Graph, JSON-LD | ✅ |
| Unit/integration tests (218) | ✅ |
| `npm run build` (Vercel/Nitro) | ✅ |
| GitHub Actions CI | ✅ |
| Live AI generation (API key) | ❌ ešte nie (export promptu) |
| 1:1 backend/DB clone | ❌ mimo scope (public frontend only) |

## Features

- Sken verejnej URL alebo vložené HTML
- Same-origin crawl, headless render, Wayback fallback
- Partial crawl recovery + transient HTTP retry
- Tech detection, design tokens, forms, assets
- WordPress REST / JetEngine listings / Elementor → import JSON
- **AI Rebuild** tab — prompt pre Claude/ChatGPT + Tailwind config fragment
- Compare blueprints, vault history, JSON/ZIP export
- SEO: favicon, OG, JSON-LD

## Stack

TanStack Start · React 19 · Vite · Tailwind v4 · PGLite vault · Vitest

## Scripts

```bash
npm ci
npm run dev         # 0.0.0.0:8080
npm run typecheck
npm run test:unit   # 218 tests
npm run build
```

## Repo

```
https://github.com/NEXIFY-STUDIO/moon-berry-kind-cap
```

## CI

Push na `main` spustí: `typecheck` → `test:unit` → `build`.
