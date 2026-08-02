# Contributing

Thanks for improving Blueprint Scanner.

## Workflow

1. Fork / branch from `main`
2. Use a focused branch name: `feat/…`, `fix/…`, `docs/…`, `chore/…`
3. Implement + tests
4. Run local gates (below)
5. Open a PR against `main`

## Required checks

```bash
npm ci
npm run typecheck
npm run lint          # fix or justify
npm run test:unit     # must pass
npm run build         # must pass
```

For UI changes also:

```bash
npm run test:smoke    # when feasible
```

CI (`.github/workflows/ci.yml`) runs: **typecheck · test:unit · build** on Node 22.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: partial crawl recovery badge
fix: absolute og:image URLs
docs: add SECURITY runbook
test: cover thin-html SPA markers
chore: simplify CI workflow
```

## Code review checklist

- [ ] No secrets, PAT, API keys, or `.env` committed
- [ ] Public-fetch only; SSRF blocklist preserved
- [ ] New scan paths have unit tests
- [ ] UI copy/testid changes update smoke runner
- [ ] Docs updated when options, limits, or exports change (`docs/API.md`, `CHANGELOG.md`)
- [ ] Does not claim 1:1 backend clone capability
- [ ] `AGENTS.md` left alone unless sandbox agent contract intentionally changes

## Do not commit

- `node_modules/`
- `.env*` with credentials
- Large binary fixtures (>1 MB) without discussion
- Personal access tokens (even in README “setup” notes)

## Reporting bugs / features

Use GitHub issue templates:

- Bug report
- Feature request

Security issues: see [docs/SECURITY.md](docs/SECURITY.md) — private disclosure preferred.
