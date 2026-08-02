# Tests

Canonical documentation: **[docs/TESTING.md](../docs/TESTING.md)**.

## Quick commands

```bash
npm run test:unit   # unit + integration (CI gate)
npm run test:smoke  # Playwright UI
npm run test:all    # both
```

## Layout

| Path | Role |
|------|------|
| `unit/` | Pure + UI unit tests (Vitest) |
| `unit/ui/` | Component tests |
| `integration/` | Live public URL |
| `smoke/` | Browser E2E runner |
| `fixtures/` | Shared Blueprint fixtures |
| `helpers/` | Render helpers |

**234** unit/integration tests expected green before merge.
