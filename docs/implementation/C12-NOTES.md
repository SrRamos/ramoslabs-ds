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
# C12 notes (SJIcon)

## W1-C12.a: contract, core, tokens

Branch `feature/c12-icon-core`. Owned: `packages/tokens/src/tokens/icon.json`, `packages/contracts/contracts/icon.contract.json`, `packages/core/src/icon/**`, the core `./icon` export, regenerated `*/src/generated/**`. `@ramoslabs/icons` is another stream and is untouched; core never imports it.

### Surface (draft, freezes to `beta` with the getters)

```ts
// @ramoslabs/core/icon
createIcon(getProps: () => IconProps): { getRootProps(consumer?): Props; getNodes(): IconNode[] }
IconProps = { icon?: IconData; size?: 'sm'|'md'|'lg'|'fit'; label?: string; dir?: 'ltr'|'rtl' }
IconData  = { name?: string; nodes: [tag, attrs][]; mirror?: boolean }
```

Root bag: `class sj-icon`, `data-part=root`, `data-size`, `data-mirror=true` (only when `icon.mirror` and `dir === 'rtl'`), `viewBox="0 0 24 24"`, `width/height="1em"`, `fill=none`, `stroke=currentColor`, round caps and joins; decorative: `aria-hidden=true`; labelled: `role=img` + `aria-label`. Every library key is protected (ADR-004), including `tabindex` and `tabIndex`, which are set to `undefined` so a spread's value is deleted with the merge dev warning. A consumer `on*` key warns in dev (the fix is SJButton) and still passes through. Nodes: tags `path circle ellipse rect line polyline polygon`, attributes `d cx cy r rx ry x y x1 y1 x2 y2 width height points`, string or number values; anything else is dropped with one dev warning (count only). Output nodes are fresh arrays and objects, never the input. Unknown `size` -> `md`; missing `icon` -> `[]` plus a dev warning.

### Decisions and ambiguities

- **`support: []`** (PLAN-ICONS decision, justified in the `icon` prop description): inline SVG with presentation attributes and a `1em` box needs no feature fallback above the ADR-001 floor; the only runtime input is `dir`.
- **No actions, no events** (ADR-010 G-ICON sentence): one `idle` state, `actions: []`, `events: []`, no `$comment`. `reducer.ts` exists only so codegen equivalence and the W1-308b harness discover it with no registration; it is not re-exported from the barrel (bytes).
- **`fit`** has no token: it is `100%` in `icon.css` (.b). Tokens added: `icon.size.sm|md|lg` (0.875, 1.25, 1.5 rem) and `icon.stroke.width` (2); they appear in the generated CSS, TS and JSON as `--icon-size-*` and `--icon-stroke-width`.
- **`focusable="false"` is not emitted.** The evidence variant mentions it for legacy IE/pre-Chromium Edge, which is below the ADR-001 floor, and the 0.75 KiB ceiling left no room. Protection against focus is `tabindex` removal plus `aria-hidden`.
- **Vocabulary exports.** The tag/attribute allowlists and the size set are module-private regexes (exports count toward the size row because the harness bundles `export *`). Tests repeat the allowlist independently.
- **Mirror** uses truthiness of `icon.mirror` (typed boolean) to save bytes.
- `dir` is a plain prop of the getter; adapters resolve it (C12.c/.d/.e) and read the runtime only for mirrored icons.

### Size (ADR-011, `node packages/testing/size/cli.js`)

Core `icon`: 0.750 KiB gzip, 1182 B raw, ceiling 0.75 KiB (shared `merge` excluded as for every component). The module is at the ceiling: dev warnings are counted because the harness does not define `NODE_ENV`. Any addition needs a deletion or an ADR-011 revision. Seeded violations: allowlist test (forbidden tags and attribute names), protected-key test, whitespace label, production silence.

### Follow-ups

- `status: draft` -> `beta` at getter freeze (after G-ICON).
- Warnings carry counts, not names, for dropped nodes (size). A richer message can move to the adapters or a dev-only build.

### Shared-file change (listed per the ownership rule)

- `packages/contracts/scripts/codegen.mjs`: an adapter type with no members (`SJIconEmits`, `SJIconSlots`, vanilla `EventDetail`) is now emitted as `Record<never, never>` instead of an empty `interface`, which `@typescript-eslint/no-empty-object-type` rejects. No output of an existing component changes.
- The `icon` prop type is `import('@ramoslabs/core/icon').IconData` so the generated adapter types resolve it without a new import line in codegen.

## W1-C12.b: `icon.css`

Branch `feature/c12-icon-css` (from main after `.a` merged). Owned: `packages/css/src/icon.css`, `packages/css/test/icon.test.js`, the `icon` rows in `packages/css/test/template.test.js`, this section.

### What landed

- `icon.css`: `sj.component` carries structure (`display: inline-block`, `flex: none`, `vertical-align: -0.125em`, `stroke-width: var(--sj-icon-stroke, var(--icon-stroke-width))`, box from `--icon-size-sm|md|lg`, `fit` = 100% both axes). The default (no `data-size`) is md. `sj.state` carries `data-mirror` (`transform: scaleX(-1)`) and `data-spin`.
- The 1em markup box (`width/height="1em"`) is overridden by the size tokens because CSS `inline-size`/`block-size` beat the presentation attributes. A CSS-less render keeps the `1em` box (tested without the stylesheet: 32 px text gives a 32 px glyph).
- Colour: none. The stroke stays `currentColor`, so forced colors maps it to the system text colour with no rule; no `forced-color-adjust`, `fill`, `stroke` colour or `filter` exists (tested on source, and computed `forced-color-adjust` is not `none`).
- Spin uses the `rotate` property (not `transform`) so it composes with the mirror flip. Duration is `calc(var(--sj-duration-slow) * 3)` (0.9 s; no 1 s token) with `--easing-linear`. Under `prefers-reduced-motion` the animation is `none` (static). Decided as the row says: static, not an opacity pulse. A stopped loader can read as finished, so a spinning icon should sit next to a text status or carry `label`; revisit at the human visual review if a pulse is wanted.
- Mirror is driven only by `data-mirror`; the stylesheet never reads `dir` (core sets it, `dir=rtl` alone does not mirror: tested).

### Ambiguities resolved

- Core emits the root class `sj-icon`, not `sj-icon__root`. The selector is `:is(.sj-icon, .sj-icon__root)` so the anatomy check (`.sj-<c>__<part>`) sees `root` and a future class rename needs no CSS change. Not a bug in `.a`; do not rename the class (adapters, fixtures depend on it).
- 1.4.11: the extractor reads `sj.variant` fills of component parts, and the icon has none, so it adds no pair (tested: no `icon/` pair, none failing). The documented recipes (stroke `slate-900/700/500` and `primary` on background, surface, surface-secondary) are checked at 3:1 directly with `contrastRatio`, with a seeded `slate-300` that fails. The L3 composition check for SJButton stays in `.f`.
- Baseline: sm in 16px / 1.5 text leaves the line box at 24 px. md (20 px) can grow a 24 px line by 1 px because it is taller than the strut; the glyph bottom sits exactly 0.125em under the baseline, so the text baseline never moves.

### Registration

`icon` added to the real-contract rows of `template.test.js` (generated names equal anatomy, seeded extra/missing part fails). `build.test.js`, `base.css` and the contract source lint list name no component, and the stylesheet is picked up by the `src` listing (generated full file) with no shared-file edit.

### Seeded breakages that fail

Raw `20px` size and raw `900ms` duration (stylelint), `forced-color-adjust: none` (computed value check), a `dir`-driven mirror, a fill on the icon part, `slate-300` recipe (3:1), a part added or renamed in the contract (template tests), removal of the `rotate` or reduced-motion rule (spin and static-pixel tests).

### Follow-ups

- `.f`: no-stylesheet fixture across engines, composition with SJButton `icon` slot, visual baselines, optional pulse decision.
## W1-C12.e: vanilla adapter
Branch `feature/c12-icon-vanilla`. Owned: `packages/vanilla/src/icon/**`.

### Surface
- `mountIcon(host, container, props) -> { update, destroy, element }` (golden `mountButton` layout). One `<svg>` built with `createElementNS` and `setAttribute`; root attributes come from core `getRootProps(attrs)` with stale ones removed on update; children from `getNodes()`, so the tag and attribute allowlist is the core one.
- Children are rebuilt only when `props.icon` changes by reference (the `<svg>` itself is stable); `destroy` removes the `<svg>` and is idempotent; later `update` is a no-op.
- `defineSJIcon({ icons, name?, registry?, host? })` returns `false` when the name is taken; no import-time registration. `icons` is a record (aliases as extra keys) or a list of `IconData` with `name`; the map is built inside the call (no module-scope state). The adapter never imports `@ramoslabs/icons` (`no-icons-import`): the consumer passes `{ search, ... }` or `by-name` data. `<sj-icon icon="search" label size dir>` in light DOM; the `.icon` property takes `IconData` and wins until the `icon` attribute changes. Unknown name: empty svg plus the core dev warning.

### Decisions
- RTL (PLAN-ICONS decision 11): `dir` prop, else `host.runtime.dir`, read only when `icon.mirror` is true. A vanilla host always owns a runtime, so there is no "outside a provider" case and no warning.
- A mount consumes one id from the host `idFactory` (host contract) but renders none; the svg has no `id`.
- Shared-file edit (listed per the ownership rule): `packages/vanilla/package.json` gains the `./icon` export (not pre-stubbed on main).

### Size
`adapter:vanilla` row (barrel, `node packages/testing/size/cli.js`) is unchanged at 1.405 KiB: no ADR-011 row covers the icon adapter and the barrel stays empty. Unminified `dist/icon/index.js` (comments included): 5228 B raw, 1945 B gzip. Core `icon` stays 0.750 KiB (untouched).
## W1-C12.d: React adapter

Branch `feature/c12-icon-react`. Owned: `packages/react/src/icon/**`. Shared-file edits (minimal): `packages/react/package.json` gains the `./icon` export (like every other adapter entry), `packages/react/src/index.ts` re-exports the module, and the barrel test lists `SJIcon` and `SJIconRoot`. `packages/core/src/icon` is untouched.

### Decisions

- **Stateless like SJButton**: a fresh `createIcon` per render, no `useMachine`, no store, no listener, works outside `SJProvider`. `SJIcon.Root` (= flat `SJIconRoot`) is the primitive; `SJIcon` is the preset built only from it. Both `forwardRef` to the `<svg>`.
- **Created elements only**: the root and each node are `createElement` calls, keyed by index; no ids, no `innerHTML`; a source test forbids `innerHTML`, `outerHTML`, `insertAdjacentHTML` and any `@ramoslabs/icons` import (boundary rule `no-icons-import` also covers it). Consumers pass `IconData` via `icon`.
- **Prop names**: getter keys are converted for React (`class` -> `className`, `stroke-linecap` -> `strokeLinecap`, any `kebab-case` -> camelCase); `aria-*`, `data-*` and `viewBox` keep their spelling. Node attributes pass through the same conversion (`stroke-width` -> `strokeWidth`).
- **`dir`**: `useOptionalRuntime()` (no fallback, no warning) is called unconditionally but its value is used only for a mirrored icon without a `dir` prop. A non-mirrored icon outside a provider never warns (1,000 renders tested). A mirrored icon outside a provider renders `ltr` and, per the row ("warns once"), warns once per instance in dev from an effect guarded by a `useRef` (no module-scope state; StrictMode's double effect still warns once). Passing `dir` or being inside `SJProvider` silences it.
- **Classes/merge**: `classes.root` and `className` merge after the library class; other attributes go through the core merge (protected keys win, `tabIndex` is deleted with the core warning, `on*` warns pointing to SJButton).
- **SSR**: no ids and no runtime-dependent output beyond `dir`, so `renderToString` is identical across calls and across providers with different `idPrefix`; server attributes equal the client props (tested).

### Size

Adapter bytes are measured by the W1-308b harness, not gated here; see the gate output. Core `icon` stays 0.75 KiB.
