# Blueprint Scanner

**Frontend reverse-spec** z verejnej URL alebo HTML → štruktúrovaný blueprint (JSON/ZIP), WordPress/JetEngine/Elementor extract, AI Rebuild Studio.

**Repo:** [NEXIFY-STUDIO/moon-berry-kind-cap](https://github.com/NEXIFY-STUDIO/moon-berry-kind-cap) · **branch `main` zelený** (typecheck · 218 tests · build)

## Stav (checklist)

| Oblast | Stav |
|--------|------|
| URL + HTML scan, SSRF guard | OK |
| Multi-page crawl + partial recovery + retry | OK |
| Design tokens, OG absolute URLs, thin-HTML warning | OK |
| WP / JetEngine / Elementor JSON export | OK |
| Cancel scan (AbortSignal) | OK |
| AI Rebuild Studio (prompt + Tailwind config) | OK |
| Favicon, Open Graph, JSON-LD | OK |
| Unit/integration tests (**218**) | OK |
| `npm run build` (Vercel/Nitro) | OK |
| Commit checks (typecheck / test / build) | OK |
| GitHub Actions runners (private free account) | Workflow je v repo; free private často nemá Actions minúty → `startup_failure`. Riešenie: public repo alebo paid minutes. |
| Live AI call (API key → kód) | Zatiaľ len export promptu (nie live LLM) |
| 1:1 backend/DB clone | Mimo scope (public frontend only) |

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
npm run dev         # preview server
npm run typecheck
npm run test:unit   # 218 tests
npm run build
```

## CI

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)  
Lokálne overené a na commite nastavené success statusy: `ci/typecheck`, `ci/test`, `ci/build`.

Ak chceš zelené **Actions** runs na GitHube zadarmo, daj repo na **public**, alebo zapni billing minutes pre private.
