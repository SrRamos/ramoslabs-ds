# C11 notes (SJState)

## W1-C11.a: contract, core, live derivation

Branch `feature/m4-c11-state-core`. Owned: `packages/contracts/contracts/state.contract.json`, `packages/core/src/state/**`, regenerated `*/src/generated/**`. Shared file touched (live derivation, owned by C11.a only): `packages/contracts/scripts/codegen.mjs` and `packages/contracts/test/codegen.test.js`.

### Live derivation (AUDIT-G3A-R2, R2-SHOULD-2)

`codegen.mjs` exports `deriveLive(contract)` (`'eager'` when `a11y.liveRegions` is non-empty, else `'lazy'`) and emits `export const <camel>Live = '<eager|lazy>' as const` at the end of each `generated/<slug>/aria.ts`. Tests: shipped contracts (`stateLive` eager, `switchLive` lazy) and a seeded `liveRegions` entry flipping a copy of the switch contract. All existing components regenerate with a `lazy` constant (additive).

Not done here (outside C11.a ownership, still owed per the ruling): adapters (`useMachine`, `useSJStore`, vanilla `ComponentSpec`) must pass `<camel>Live` instead of a literal, and the contract-lint rule `contract/live-from-contract` (fails an adapter of a component with non-empty `liveRegions` that does not reference the generated constant, with a seeded failure). C11.c/d/e and C02's adapters must build on the constant; the lint rule needs an owner before the first announcing adapter merges.

### Surface (draft)

```ts
// @ramoslabs/core/state
createState(getProps: () => StateProps): { getRootProps, getIconProps, getTitleProps,
  getDescriptionProps, getActionsProps (consumer?) => Props; getAnnouncement(): { text, urgent } | undefined }
StateProps = { variant?, heading?, description?, announce?, interrupt? }
variant = 'first-use' | 'no-results' | 'cleared' | 'loading' | 'error'
```

### Decisions and ambiguities

- **Three empty kinds are distinct variants** (BRIEF, plan row 6.2): `first-use` (never had data), `no-results`, `cleared`; `loading` and `error` complete the set (ARCHITECTURE row 11). Every part carries `data-variant`, so CSS and copy can differ per kind. An unknown variant falls back to `first-use` with a dev warning, never to a "done" or "no results" message.
- **No live markup in SSR** (ADR-006 client-only registry): the root never carries `role`, `aria-live` or `aria-atomic`; they are set to `undefined`, which deletes a consumer value with the merge dev warning. `getAnnouncement()` is a pure value the adapter passes to the registry after mount.
- **Politeness** (ADR-006): loading, no-results and error announce `heading` (or `announce`) through polite `status`; first-use and cleared are static and silent unless `announce` is set. `urgent` (role `alert`) only for `variant: 'error'` with `interrupt: true`.
- **No color-only meaning** (AGENTS.md): text is always rendered; the icon part is `aria-hidden` and cannot be overridden by a spread. `aria-busy` on the root only while loading.
- **Prop `heading`, not `title`**: `title` is a global HTML attribute (tooltip) and the generated vanilla options type shares one namespace between props and slots (a `title` prop plus `title` slot was a duplicate identifier). Slots: `icon`, `title`, `default` (description), `actions`.
- **One state, no actions** (zero-actions amendment as SJIcon): `reducer.ts` exists for discovery only; `index.ts` does not re-export it (same as field/form).
- `pattern` uses the `live-region` evidence file for both `apg` and `evidence`; AT rows cite its recommended entries.
- Budget set to 1 KiB (a simple primitive; ADR-011 gives no State-specific figure).

- **Vanilla `.e` must not read `title` from attributes**: `title` is a global tooltip attribute; the copy comes from the `heading` option or the title slot only.
- **Validator** (`validate.mjs`): a slot named like a prop (`default` maps to `children`) is now a validation error, with a seeded test.

### Measured

`node packages/testing/size/cli.js`: state 0.671 KiB gzip (1263 B raw) vs 1 KiB budget.

### Gate

All gate steps pass. `@ramoslabs/icons` test `seeded failure: a stray or missing generated file...` timed out at the 5 s default on two of three full forced runs (it spawns generation four times under turbo parallel load); it passed on the third. Unrelated to this change; flake owned by the icons stream (PR #86 raises the icons test timeout).

### Follow-ups

- `contract/live-from-contract` lint lands in its own PR (owner: orchestrator, separate stream) before any C02/C11 `.c/.d/.e` opens.
- Adapters pass `<camel>Live` (above).
- `.b` CSS (variants, icon, no color-only), `.c/.d/.e` adapters, `.f` conformance incl. SSR no-live-markup and one-announcement specs.

## W1-C11.b: SJState CSS

Branch `feature/m4-c11-state-css`. Owned: `packages/css/src/state.css`, `packages/css/test/state.test.js`, this section. No shared file touched: component CSS is registered by the `src/**` glob in `scripts/build.mjs`, as checkbox.css and switch.css are.

### Decisions and ambiguities

- **Root selector names both classes.** Core emits `sj-state` on the root with no `__root` (`state/index.ts`). The root rule is `:is(.sj-state, .sj-state__root)`, as `icon.css` does, so the anatomy check sees `root`. Issue #88 tracks the convention; the class is not changed here.
- **Variant hooks.** Every part carries `data-variant` (core, C11.a). Each of the five variants (`first-use`, `no-results`, `cleared`, `loading`, `error`) has its own rule set in `sj.variant`, keyed on the icon and title parts. The three empty kinds stay distinct (contract `variant` description, ADR-006 onboarding vs. no-results vs. cleared).
- **No meaning by colour alone** (AGENTS.md, WCAG 1.4.1). Every variant renders its title text. The icon slot holds an SJIcon whose glyph differs by kind, and the colour only reinforces it. Under forced colours the text stays visible and the glyph shape carries the kind (test).
- **Colour choices use only tokens already checked on every surface.** The `sj.variant` rules carry no `data-tone`, so the shared matrix (`packages/testing/contrast/css.js`) does not read them. The test checks each colour token used here on `color-surface`, `color-surface-secondary` and `color-background` directly: text tokens at 4.5:1, icon tokens (`__icon` selectors) at 3:1. The matrix itself is unchanged and reports no `state` failure.
- **Reduced motion.** The loading spinner is an SJIcon with `data-spin`, animated by `icon.css`. `state.css` removes that animation under `prefers-reduced-motion` in `sj.state` itself, so the file does not depend on `icon.css` being loaded. The base motion net does not reach a spinner without `data-part`, which is why this rule is needed here.
- **Layout is symmetric and logical.** Flex column, centred text, logical padding and margin. Test: title and glyph stay centred in LTR and RTL.

### Measured

Built `dist/state.css`: 4259 B raw, 1591 B gzip (1.55 KiB). ADR-011 gives no CSS-specific ceiling, and `packages/testing/size/budgets.json` has no CSS entry, so there is no pass/fail figure. The `state` row of `node packages/testing/size/cli.js` (0.642 KiB gzip vs 1 KiB) is the core JS module, not this stylesheet.

### Tests

`packages/css/test/state.test.js` (16 tests): anatomy against the contract, stylelint, no raw values in source, contrast on every surface (with a seeded weak icon colour), per-variant colour and rendered text, forced colours (text and glyph visible, glyph shape differs), RTL centring, reduced motion (spinner static; seeded removal of the rule fails). The full css package suite passes (174 tests, 8 files), and lint and `format:check` are green.

### Follow-ups

- `.c/.d/.e` adapters must emit `data-variant` on every part and set the glyph via SJIcon with `data-spin` for loading. `.f` conformance should add the VoiceOver and NVDA evidence rows.
- Issue #88: root class convention. This file follows the current emit.

## W1-C11.c: SJState Vue adapter

Branch `feature/m4-c11-state-vue`. Owned: `packages/vue/src/state/**` (`SJState.ts`, `index.ts`, `state.test.ts`), `packages/vue/src/index.ts` and `index.test.ts` (barrel line, as icon/checkbox did), this section. `vite.config.ts` and `package.json` already list the `state` entry.

**Shared file touched:** `packages/core/src/state/index.ts` gains one line, `export { stateLive } from '../generated/state/aria'`. The generated constant is not reachable from any public core subpath, and adapters must pass it (`contract/live-from-contract`). Identical for `.d`/`.e`; keep one copy on rebase.

### Decisions

- **Flat, stateless; no `useSJStore`.** SJState has no actions, so the only runtime work is the announcement. The component reads `useSJContext()` and, after mount, calls `ctx.requireLive?.()` when `stateLive === 'eager'` (the status region exists, empty, before its first message) and hands `getAnnouncement()` to `ctx.live.announce(text, { urgent })`. No `live:` literal anywhere.
- **First announcement waits one `nextTick`.** Children mount before `SJProvider` attaches its host in its own `onMounted`, so an immediate announce would be dropped. Later changes use a `flush: 'post'` watcher keyed on `urgent+text`; the registry de-duplicates identical text.
- **Politeness** comes from core: loading, no-results, error and `announce` go to polite `status`; `alert` only for `variant: 'error'` with `interrupt`. First-use and cleared are silent.
- **No live markup in SSR**: the render function only uses core getters (role/aria-live/aria-atomic deleted); tested for all five variants, deterministic, no ids.
- **Prop-or-slot** for heading (`title` slot), description (default slot), icon, actions; slots win. Empty parts are not rendered. `heading` prop, never `title`. Per-part `classes`: root, icon, title, description, actions.
- **Outside a provider** `useSJContext` warns in development and the fallback registry is never attached, so the component stays silent (ADR-003).

### Tests and bytes

`state.test.ts` (13 tests): parts and data-variant on every part, three empty kinds distinct, unknown variant falls back to first-use, slots win, class merging, eager status region, polite loading and count (de-duplicated), silent first-use/cleared, alert only for interrupting error, no announce after unmount, SSR for five variants, source check (no literal, no innerHTML), 1,000 mount/destroy leaves no DOM and no host callbacks. Bytes: see the PR body (size harness row for adapters).
