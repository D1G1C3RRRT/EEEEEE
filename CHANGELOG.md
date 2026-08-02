# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).  
Versioning: project app version is tracked via Blueprint schema (`1.0.0`–`1.2.0`) and git history; package name remains private workspace.

## [Unreleased]

### Added

- Professional documentation set under `docs/` (Architecture, Development, Testing, Security, Deployment, Runbook, API)
- `CONTRIBUTING.md`, expanded root `README.md`, GitHub issue/PR templates

### Changed

- Root README rewritten for open-source / DevOps clarity (English)

## [1.2.x] — 2026-08

### Added

- AI Rebuild Studio prompts (`generateAiRebuildPrompt`) + Tailwind config fragment
- SPA-aware Architecture Compiler prompts
- Hardening: browser process shield, asset memory guards (10 MB / 50 MB / 40 files), fetch fallback chain, API `withApiGuard`, process error guards
- Partial crawl recovery (`scanStatus`, `partialStats`, `scanWarnings.failedUrls`)
- Transient HTTP retry with backoff
- Thin HTML / SPA shell detection + UI warning
- Absolute Open Graph / Twitter image URLs
- JSON-LD helpers; favicon / webmanifest assets in `public/`
- Cancel scan via AbortSignal + UI **Zrušiť**
- Premium 2×100dvh UI, neon border input, long-press icon toggles
- Elementor DOM→JSON compiler (template import schema v0.4)
- WordPress / JetEngine architecture extract (REST/CCT/listing signals)
- Design system extractor (Elementor globals, typography scale, full WP image URLs)
- Compare blueprints; local vault + ZIP export
- GitHub Actions CI (typecheck, unit tests, build)

### Security

- SSRF blocklist for localhost, RFC1918, link-local, cloud metadata hosts
- Safe JSON stringify (circular / depth guards)

### Fixed

- Production blank-page risk notes and build guard tests
- Import normalization for external Blueprint JSON

## [1.1.0] — 2026-07 / early 2026-08

### Added

- Multi-page same-origin crawl
- Headless render + Wayback fallback
- Tech detection, forms, assets, design tokens
- Blueprint vault (localStorage) and JSON export

## [1.0.0] — initial

### Added

- URL / HTML → frontend reverse-spec core
- Initial reverse-spec artifact workflow
