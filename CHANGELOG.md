# Changelog

All notable changes to the RamosLabs Design System are documented here. The format is based
on Keep a Changelog, and the project follows Semantic Versioning. The publishable package
`@ramoslabs/tokens` shares the version numbers below.

## [Unreleased]

## [0.1.0] - 2026-07-08

Initial public release.

### Added

- `@ramoslabs/tokens`, the design token package. DTCG JSON source compiled by Style
  Dictionary v5 to CSS variables (`tokens.css`), a typed ES module (`tokens.js` plus
  `tokens.d.ts`), and a flat JSON map (`tokens.json`). 213 tokens across color, typography,
  spacing, radius, shadow, motion, z-index, breakpoints, and state. Mono-indigo: indigo 600
  (`#4f46e5`) is the single action accent; violet is a decorative accent only. Publishable
  to npm with a `prepack` build and public access.
- The doctrine book in Storybook: nine foundation pages plus an introduction, and nine
  pattern pages (interactive, accessibility, forms, tables, modals, mobile-first,
  persuasion, voice and tone, AI content). Device-frame standard renders illustrate the
  modal patterns on desktop and the table and mobile patterns on a phone.
- The agentic layer: `llms.txt`, `llms-full.txt`, `registry.json`, and `AGENTS.md`,
  generated from the tokens and the distilled content and served from the site root so AI
  coding agents can consume the whole system over HTTP.
- SEO and AI-SEO: `robots.txt` that welcomes AI crawlers, a `sitemap.xml`, Open Graph and
  Twitter metadata, a canonical link, and a real document title.
- Project docs and licensing: MIT license with attribution to RAMOS SOLUTIONS S.A.S., a
  global documentation footer, a professional README, a package README, and CONTRIBUTING.
- A release skill in `.claude/skills/release` that codifies SemVer, Conventional Commits,
  this changelog, tags, and the publish flow.

[Unreleased]: https://github.com/SrRamos/ramoslabs-ds/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SrRamos/ramoslabs-ds/releases/tag/v0.1.0
