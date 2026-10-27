# K2 notes: W1-105 prop-merge

Branch `feature/m1-k2-prop-merge`. Code: `packages/core/src/merge/**`. Spec: PLAN-WAVE-1 row W1-105, ADR-004
(ARCHITECTURE.md lines 356-360: "One merge utility").

## API

`mergeProps(consumer, library, options?)` returns a new plain object; inputs are never mutated.
Options: `protect` (extra library-owned keys), `part` (name used in the warning), `warn` (sink, default
`console.warn`). Chain calls for more than two layers. Also exports `IDREF_KEYS`.

## Ambiguities resolved

| Question | Resolution | Basis |
|---|---|---|
| Which keys are "library wins"? | `role`, `id`, any `aria-*` key present in the library bag (covers state-derived values and IDREFs such as `aria-controls`), `for`/`htmlFor`/`form`/`list`/`headers`/`popovertarget`/`anchor`, plus `options.protect` | ADR-004 l.358-360 "role, ids, IDREFs, aria-* derived from state" |
| Consumer `aria-*`/`role` the library does not set | Kept (only keys the library owns are locked) | ADR-004 l.357 "library win" is about conflicts |
| Library sets an owned key to `undefined` | Library still wins and the key is removed (state "absent" cannot be spoofed) | "cannot be overridden by a spread" |
| Other attributes (`type`, `tabIndex`, `data-*`) | Consumer wins; callers lock extras via `protect` | ADR-004 only names ARIA/role/ids as library-owned |
| Handler detection | key matches `on[A-Z]*` and library value is a function | covers React/Vue props |
| `defaultPrevented` cancel | library handler skipped when `event.defaultPrevented === true` after the consumer ran (also when already true on entry) | ADR-004 l.358-359 |
| Consumer handler throws | Propagates; library handler does not run | no swallowing |
| class order | library first, consumer last; `class` and `className` are each concatenated within their own key | ADR-004 "concatenate" |
| style | objects shallow-merge (consumer wins per property); strings join with `;`; mixed string/object: consumer wins (no CSS parser in a 1 KiB-class kernel) | ADR-004 "concatenate" |
| Dev warning | emitted when a consumer value for an owned key is discarded and differs from the library value; `process.env.NODE_ENV !== 'production'` is written inline at both sites so bundlers fold it away | ADR-004 l.360 "development builds warn" |

## Verification

- `bunx vitest run src/merge`: table tests per rule (owned attrs, class, style, handlers, warning,
  purity) plus a fast-check property that no spread overrides owned keys.
- Tree-shake (esbuild 0.28.1, minify, `define NODE_ENV`): production 1207 B raw / 646 B gzip, warning text
  absent; development 1503 B raw / 823 B gzip. Well under the ADR-011 shared-kernel scale; `merge` has no
  own row in `budgets.json` (not edited, outside ownership).
- `bun run gate`: see the final report.

## Deviations and open items

- `core` is built with `lib: ["ES2022"]` and `types: []`, so `process` and `console` are declared locally
  in `merge.ts`. Unbundled browser use (no `NODE_ENV` replacement) would throw a ReferenceError on `process`;
  all adapters ship through bundlers per ADR-002. Open question for the owner: whether the `vanilla` CDN build
  should `define` `process.env.NODE_ENV`.
- The dev-warning tree-shake check is manual (esbuild is not a `core` devDependency; adding one touches
  `package.json`, not mine).
