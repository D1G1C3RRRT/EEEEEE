# API (internal)

Internal server functions and client helpers — **not** a public multi-tenant SaaS API.

Primary module: `src/lib/blueprint/server.ts`  
Core engine: `src/lib/blueprint/scan.ts` → `scanToBlueprint`

## `scanBlueprint` (server function · POST)

Zod-validated input (`scanSchema`):

| Field | Type | Default / range | Description |
|-------|------|-----------------|-------------|
| `url` | string? | — | Public page URL |
| `html` | string? | — | Raw HTML paste (requires one of url/html) |
| `baseUrl` | string? | — | Origin for relative URLs in HTML mode |
| `maxPages` | int | 1–20 | Same-origin crawl size |
| `render` | boolean | typically true (URL) | Headless DOM |
| `wayback` | boolean | typically true (URL) | archive.org fallback |
| `captureAssets` | boolean | typically true | Download binaries into blueprint |
| `wpJetEngine` | boolean | typically true | WP/Jet/Elementor extract |
| `signal` | AbortSignal? | — | Cancel (passed from client when supported) |

HTML mode in UI forces `maxPages: 1`, `render: false`, `wayback: false`.

### Success

```ts
{ ok: true, blueprint: Blueprint }
```

### Failure

```ts
{ ok: false, error: string, code?: string }
```

Common `code` values: `ABORTED`, `TIMEOUT`, `DNS_FAILURE`, `HTTP_ERROR`, `ERROR`.

Side effects: in-memory map (≤40), best-effort `saveBlueprintDb`.

## `scanToBlueprint` (library)

```ts
async function scanToBlueprint(req: ScanRequest): Promise<Blueprint>
```

`ScanRequest` mirrors the table above (`types.ts`). Throws on hard validation errors (invalid URL); pipeline prefers partial results for soft failures.

## Other server functions

| Function | Method | Purpose |
|----------|--------|---------|
| `getBlueprint` | GET | `{ id }` → memory then DB |
| `listBlueprints` | GET | Recent DB/memory summaries |
| (compare helpers) | — | See `compareBlueprints` in `compare.ts` |

Exact exports beyond scan may grow; check `server.ts`.

## Client storage (`storage.ts`)

| Function | Description |
|----------|-------------|
| `saveBlueprintLocal(bp)` | Upsert into `localStorage` key `blueprint.vault.v1` (max 15) |
| `listLocalBlueprints()` | Summaries for history UI |
| `loadLocalBlueprint(id)` | Full blueprint or null |
| `deleteLocalBlueprint(id)` | Remove one |
| `exportBlueprintJson(bp)` | Safe pretty JSON string |
| `downloadText(name, content, mime)` | Browser download helper |
| `downloadElementorTemplate(bp)` | Writes `elementor-template-import.json` |
| `exportBlueprintZip(bp)` | Async ZIP with assets + JSON |

## Export formats

| Format | Content |
|--------|---------|
| JSON | Full Blueprint (base64 assets may be large; safe stringify) |
| ZIP | JSON + captured files under `assets/…` |
| Elementor | Schema `version: "0.4"`, `type: "page"`, containers/widgets |
| AI Rebuild | `{ systemPrompt, userPrompt, fullPrompt, tailwindConfigJs, meta }` from `generateAiRebuildPrompt` |
| Architecture | `{ systemPrompt, userPrompt, fullPrompt, evidence, meta }` from `generateArchitectureCompilerPrompt` |

## Compare

`compareBlueprints(left, right)` → `BlueprintCompareResult`:

- `identical`
- `summary`: title/hash deltas, tech added/removed, asset/link/page count deltas
- `changes[]`: `{ path, kind: added|removed|changed, left?, right? }`

## Abort semantics

1. Client creates `AbortController` and passes `signal` into the scan call path.
2. Fetch, headless, and crawl honor abort.
3. User-facing copy: **Sken bol zrušený.** / `code: "ABORTED"`.

## Error envelope (scanner)

```ts
type ApiErrorBody = {
  ok: false;
  error: string;
  code?: string;
  details?: string | number | boolean | null | Record<string, ...>;
};
```

Produced by `toApiError` / `withApiGuard` in `src/lib/scanner/errors.ts`.
