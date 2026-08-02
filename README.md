# EEEEEE — Frontend Blueprint Scanner

URL/HTML → structured frontend reverse-spec (blueprint).

## Features
- Scan public URLs or paste HTML
- Same-origin crawl, headless render, Wayback fallback
- Tech stack detection, design tokens, forms, assets
- Compare two blueprints
- Export JSON + reverse-spec v2

## Stack
TanStack Start · React 19 · Vite · Tailwind v4 · PGLite vault

## Scripts
```bash
npm install
npm run dev      # 0.0.0.0:8080
npm run build
npm run typecheck
npm test
```

## Artifact
- `artifacts/REVERSPEC_code_h4ck3d_me_20260802.json` — reverse-spec for code.h4ck3d.me

## Repo
https://github.com/D1G1C3RRRT/EEEEEE

## Git remotes

Primary push target (connected GitHub account):

```
https://github.com/NEXIFY-STUDIO/EEEEEE
```

User-requested target (needs collaborator write for NEXIFY-STUDIO):

```
https://github.com/D1G1C3RRRT/EEEEEE
```

To enable push to D1G1C3RRRT/EEEEEE: Settings → Collaborators → invite `NEXIFY-STUDIO` with Write, then:

```bash
git remote set-url origin https://github.com/D1G1C3RRRT/EEEEEE.git
git push -u origin main
```
