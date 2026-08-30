# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Deploy notes under `docs/deploy.md`
- `AI_MODEL` override for the coach (documented in `.env.example` and honored in `src/lib/llm.ts`)
- GitHub-ready release notes at `docs/releases/0.1.1.md`

### Removed

- Unused Next.js starter SVGs from `public/`

## [0.1.1] - 2026-08-30

### Added

- Cursor project rules under `.cursor/rules` for agents working in this repo
- "Open in GitHub Codespaces" badge and a Node 20 `.devcontainer` that installs, starts `npm run dev`, and forwards port 3000
- Server Actions login through the Codespaces forwarded host (`*.app.github.dev` vs `localhost:3000`)
- README CI, MIT license, and Node.js 20+ badges restored next to Codespaces
- Injury analysis coach action from Sleeper roster and remaining-board flags
- MIT license, contributing guide, code of conduct, and security policy
- GitHub issue forms, pull request template, Dependabot, EditorConfig, and `.nvmrc`
- Architecture notes under `docs/`
- CI lint and TypeScript checks alongside the existing 80% coverage job

### Changed

- README lists the live room, scoring inputs, and every coach action (Ask, Scout, Compare, Review roster, News briefing, Sleepers & fades, Injury analysis)
- README uses an animated WebP walkthrough (GitHub will not play a repo-hosted `<video>`)

### Fixed

- ESLint issues that would fail the new CI lint step (`prefer-const`, unused import, React purity on AI triggers, localStorage hydration)
- Mock-draft roster panel and need scoring when Sleeper leaves `roster_id` empty (attribute picks by `draft_slot`)

## [0.1.0] - 2026-08-30

### Added

- Password-gated Next.js app for Sleeper redraft rooms
- Username lookup and mock-draft ID entry
- Live room with a top-5 board, roster holes, remaining board filters, and a news strip
- Recommendation scoring from FFC ADP, roster need, upcoming demand, tier cliffs, stacks, injury, last-season nflverse stats, snap share, depth chart, and bye clusters
- Optional AI coach (Ask, Scout, Compare, roster review, news briefing, sleepers / fades)
- Vitest suite with an 80% coverage gate on GitHub Actions
