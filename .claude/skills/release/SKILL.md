---
name: release
description: Versioning and release ritual for the RamosLabs Design System monorepo. Use on every change that affects the tokens, the docs, or the site, and when cutting or publishing a version. Enforces SemVer, Conventional Commits, a Keep a Changelog CHANGELOG, version bumps, git tags, and the npm publish flow so versioning is never lost. Triggers: "release", "version", "bump", "changelog", "publish tokens", "cut a version", "tag".
---

# Release and versioning: RamosLabs Design System

Every change is versioned and recorded, so the history stays transparent. Follow this on
every change and when cutting a release. The publishable artifact is `@ramoslabs/tokens`.
For now the repo root and that package share one version number; split them only if they
ever diverge.

## On every change (during development)

1. Write a Conventional Commit: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`,
   `perf:`, `style:`. Mark a breaking change with `!` after the type or a `BREAKING CHANGE:`
   footer.
2. Add a line to the `## [Unreleased]` section of `CHANGELOG.md`, under the right group:
   Added, Changed, Fixed, Removed, Deprecated, or Security. Write it for a human reader, not
   as a commit dump.

Pure internal changes with no effect on the tokens, the docs, or the deployed site (editing
this skill, CI config, a scratch file) still get a Conventional Commit, but do not need a
CHANGELOG entry or a version bump.

## Choose the SemVer bump (from the Unreleased entries)

- MAJOR (`X.0.0`): a breaking change to the tokens (a renamed or removed token, a changed
  value contract) or a breaking public API change.
- MINOR (`0.X.0`): new tokens, a new pattern or doctrine, any backward-compatible addition
  (`feat:`).
- PATCH (`0.0.X`): fixes, doc corrections, non-breaking tweaks (`fix:`, `docs:`).

While at `0.x`, a breaking change bumps MINOR, not MAJOR.

## Cut a release

1. Decide the new version from the Unreleased entries.
2. Bump `version` in `package.json` (root) and `packages/tokens/package.json` to the same
   number.
3. In `CHANGELOG.md`, rename the `## [Unreleased]` block to `## [X.Y.Z] - YYYY-MM-DD` and
   leave a fresh empty `## [Unreleased]` on top.
4. If a change altered doctrine or a token, sync the distilled agentic content so
   `llms-full.txt` and `registry.json` match the release: edit
   `apps/site/agentic/content/**.md`, then `bun run --filter site build` (the Astro build
   integration regenerates the agentic artifacts).
5. Commit: `chore(release): vX.Y.Z`.
6. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`, and push with `--tags`. Tag on `main` after the
   release branch is merged, so the tag points at the released commit.

## Publish `@ramoslabs/tokens` to npm

Prerequisites: the CHANGELOG entry and the version bump are in, the release is tagged, and
the publisher is authenticated (an npm token lives in the publisher's `~/.npmrc`). Never
commit or paste the token. The package builds its `dist/` in `prepack` (dist is git-ignored)
and `publishConfig.access` is `public`.

1. Dry run: `npm publish ./packages/tokens --dry-run`. Confirm the version and that the
   tarball carries `dist/tokens.css`, `dist/tokens.js`, `dist/tokens.d.ts`,
   `dist/tokens.json`, `README.md`, and `LICENSE`.
2. Publish: `npm publish ./packages/tokens`.
3. Verify: `npm view @ramoslabs/tokens version`.

Publishing is irreversible: a version cannot be truly unpublished after 72 hours, and the
name stays claimed. Confirm with the owner before the real publish.
