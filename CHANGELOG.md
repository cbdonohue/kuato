# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- MIT license, contributing guide, code of conduct, and security policy
- GitHub issue forms, pull request template, Dependabot, EditorConfig, and `.nvmrc`
- Architecture notes under `docs/`
- CI lint and TypeScript checks alongside the existing 80% coverage job

### Fixed

- ESLint issues that would fail the new CI lint step (`prefer-const`, unused import, React purity on AI triggers, localStorage hydration)

## [0.1.0] - 2026-08-30

### Added

- Password-gated Next.js app for Sleeper redraft rooms
- Username lookup and mock-draft ID entry
- Live room with a top-5 board, roster holes, remaining board filters, and a news strip
- Recommendation scoring from FFC ADP, roster need, upcoming demand, tier cliffs, stacks, injury, last-season nflverse stats, snap share, depth chart, and bye clusters
- Optional AI coach (Ask, Scout, Compare, roster review, news briefing, sleepers / fades)
- Vitest suite with an 80% coverage gate on GitHub Actions
