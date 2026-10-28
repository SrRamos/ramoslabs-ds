# C12 notes: SJIcon and the common icon set

## .g: `@ramoslabs/icons` data package

Branch `feature/c12-icons-package`. Plan row W1-C12.g, ADR-016, `PLAN-ICONS.md` decisions 1-3, 14, 15.

### What landed

- `packages/icons`: `src/icons.list.json` (78 names, 9 mirror flags, alias table, `$source`),
  `scripts/generate.mjs` (+ `--check`), committed `src/generated/**` (78 modules, barrel, `all.ts`
  name tables), `src/by-name.ts` (`getIcon`), `LICENSE`, generated `THIRD-PARTY-NOTICES.md`, README.
  Built with `tsc` to `dist` (same shape as core). Glyph data comes only from the pinned
  `lucide-static@1.63.0` devDependency.
- Provenance: `--check` rebuilds every output (modules, barrel, tables, notices) from the pinned
  package and fails on a differing, missing or stray file. `test/generate.test.js` also reads the
  pinned `icon-nodes.json` directly and asserts `nodes` equality for all 78 icons. Seeded failures:
  one edited path byte, a stray and a missing file, a tampered notice.
- Aliases are validated against the upstream `dist/esm/lucide-static.mjs` re-export table (name
  to canonical file). Seeded: `check-circle -> circle-check` and `edit-2 -> pencil` fail with the
  pair; unknown upstream alias and non-exact pin fail too.
- Boundary: `sj-boundaries/no-icons-import` (core, vue, react, vanilla `src/**`) plus a manifest
  test over the four `package.json` files; both with seeded failures.
- Size harness: new `testing/size/icons.js` (read by `runSize`, no `budgets.json` edit), exceptions
  file `testing/size/icons-exceptions.json` (empty), fixture `fixtures/unused-icon`.

### Measured (ADR-011 method, minified + gzip, banner included)

| Row | gzip | Ceiling |
|---|---|---|
| largest icon (`star`) | 0.354 KiB | 0.4 (0.75 reviewed exception) |
| one icon through the barrel | 0.223 KiB | 0.4 |
| unused icon next to a used one | 0 KiB | 0 |
| `by-name` (whole set, one module) | 4.466 KiB | reported, not gated |
| every icon through the barrel | 4.461 KiB | reported |

The plan estimated about 3.4 KiB for `by-name`; the real figure with the banner on every module is
4.47 KiB, recorded here and in the README. `star` has about 0.05 KiB headroom, the banner costs
roughly 0.1 KiB per icon; a Lucide bump that grows `star` needs the exceptions file.

### Decisions and deviations

- Shared-file edits (plan "Shared-file changes" 1 and 3, not pre-stubbed on main): root
  `package.json` `icons:check` script added to `gate` (after `contracts:check`), and
  `@ramoslabs/icons` added to the `.changeset/config.json` `fixed` group. Nothing in turbo or
  `budgets.json`; the workspace glob already covers the package.
- Generated source is `.ts` (compiled by `tsc`, like core); banner placement: the `import type`
  line is elided at build, so the banner is the first line of the emitted JS (checked by the dist
  scan test).
- Root `.prettierignore` gains `packages/icons/src/generated` and the generated notices file (shared file; the pre-commit hook reads only the root ignore, and `icons:check` is the byte guard instead).
- `getIcon` warns for a legacy alias in development only (decision 3), with the inline dev guard.
- The type test restates the core `IconData` shape locally; the packages never import each other.
  When `.a` lands, check the real `IconData` against `src/types.ts` (the test is where it breaks).

### Follow-ups

- `.f`: the one-icon plus SJIcon-core fixture and the composition specs.
- G-ICON re-audit of `.a` and `.g`.
