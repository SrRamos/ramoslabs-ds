# @ramoslabs/icons

Icon data for the RamosLabs design system: 78 stroke glyphs from [Lucide](https://lucide.dev)
(`lucide-static`, ISC), one ESM module per icon. No dependencies, no framework, no DOM
(ADR-016). `@ramoslabs/core` and the adapters never import this package; you pass icon data in.

```ts
import { Search } from '@ramoslabs/icons'; // barrel, tree-shakes
import { ChevronRightIcon } from '@ramoslabs/icons/chevron-right'; // one module
```

Every icon is exported twice, `Search` and the twin `SearchIcon` (use the twin in SFCs and JSX:
`Image`, `Link`, `List`, `Menu` and `Settings` shadow DOM globals and router components). An icon
is `{ name, nodes, mirror? }`; `mirror: true` marks the nine glyphs that flip in right-to-left
layouts (chevrons, arrows, `send`, `log-in`, `log-out`, `undo-2`, `redo-2`).

## Migration from a name-based component

`@ramoslabs/icons/by-name` exports `getIcon(name)` over the whole set, including legacy aliases
(`home`, `trash-2`, `alert-circle`, ...). It is **not tree-shakeable** (about 4.5 KiB gzip as one
module); use it only to migrate dynamic names. `check-circle` and `edit-2` are not aliases: upstream
maps them to different glyphs than the ones in this set.

## Codegen and provenance

Generated modules under `src/generated/**` are committed. `bun run icons:check` (part of the gate)
regenerates in memory from the exact-pinned `lucide-static` devDependency and fails on any byte
that is not derived from it. To change the set edit `src/icons.list.json` and run
`bun run --filter @ramoslabs/icons generate`. Aliases are validated against the pinned package's own
re-export table.

## Bumping lucide-static

Lucide publishes almost daily. Bump deliberately, at most once per release worth taking, in its own
PR reviewed as a path-data diff: change the exact version in `package.json`, `bun install`,
`generate`, read the diff. No auto-bumper. Renamed canonical names need an alias plus a changeset
note.

## Licence

MIT (see `LICENSE`). The glyph data is ISC (Lucide) with some icons MIT (Feather); the notice text
is in `THIRD-PARTY-NOTICES.md`, shipped in the package, and every module carries a
`/** @license */` banner that survives minification. No glyph from any in-house or prior brand
component is used (clean-room note: `docs/architecture/evidence/clean-room/`).
