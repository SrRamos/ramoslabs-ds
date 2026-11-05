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
- **One state, no actions** (zero-actions amendment as SJIcon): `reducer.ts` exists for discovery only; `index.ts` re-exports `reduce` and `reducerEvents` (a few bytes).
- `pattern` uses the `live-region` evidence file for both `apg` and `evidence`; AT rows cite its recommended entries.
- Budget set to 1 KiB (a simple primitive; ADR-011 gives no State-specific figure).

### Measured

`node packages/testing/size/cli.js`: state 0.671 KiB gzip (1263 B raw) vs 1 KiB budget.

### Gate

All gate steps pass. `@ramoslabs/icons` test `seeded failure: a stray or missing generated file...` timed out at the 5 s default on two of three full forced runs (it spawns generation four times under turbo parallel load); it passed on the third. Unrelated to this change; flake owned by the icons stream (suggest a larger per-test timeout).

### Follow-ups

- Adapters and `contract/live-from-contract` lint (above).
- `.b` CSS (variants, icon, no color-only), `.c/.d/.e` adapters, `.f` conformance incl. SSR no-live-markup and one-announcement specs.
