# R2 notes: Vue runtime (W1-121)

Branch `feature/m1-r2-vue-runtime`. Code: `packages/vue/src/runtime/{context,store,dom,index}.ts`. Spec: PLAN row W1-121, ADR-003 Vue bridge row.

## Design
- `SJProvider` (props `runtime` | `config`, optional `liveHost`) `provide`s a `markRaw` `{ runtime, live }`. One live-region registry (W1-111) per runtime;
  `attach` happens in `onMounted` (default host: hidden DOM nodes via `createDomLiveHost`), `detach` + node removal in `onBeforeUnmount`. SSR emits nothing (ADR-006).
- `useSJContext()/useSJRuntime()`: outside a provider the fallback is `createRuntime()` defaults plus a dev `console.warn`. The fallback is parked on
  `appContext.provides`, so it is one per app and there is no module-scope state.
- `useSJStore({ initial, reduce, host, props?, fields? })`: `shallowRef` snapshot (markRaw when extensible) replaced only from the store listener, i.e. only on a
  changed dispatch (K1: no-op and effect-only dispatches do not notify). Subscription, store/queue teardown and the post watcher all live in one
  `effectScope()` attached to the component scope; unmount stops it (`scope.active === false`, listener removed, store destroyed, queue cleared).
- Drain: `watch(() => [snapshot, tick], commit, { flush: 'post' })`. `tick` bumps on every `onEffects`, so an effect-only dispatch (no snapshot change) still drains.
  `commit()` = `controlled.reconcile()` -> enqueue corrective descriptors -> `drain('layout')` -> `drain('passive')`. It is a no-op until `onMounted`, which
  calls `controlled.mount()` then `commit()` (flushes effects queued during setup). `onUpdated(commit)` covers prop-only changes (controlled `open`).
- Corrective effects get version `++version` (one past the last store version) so they are never superseded by older effects of the same type+target.

## Resolved ambiguities
- ADR-003 says "native effects only after mount" without a hook for early dispatches: they stay queued and drain at mount.
- Layout and passive phases both run in the single post watcher (Vue has no layout/passive split); layout first, so native open precedes dependent focus and announce.
- `makeStore` option is a test seam (counting listeners / destroy calls); default is core `createStore`.

## Deviations / shared-file changes
- `packages/vue/package.json`: `@ramoslabs/core: workspace:*` in `dependencies` (coordinator decision, same as React/vanilla); `vite.config.ts` marks `^@ramoslabs/core(/.*)?$` external, so core is never bundled.
- Visually-hidden live nodes use inline style (adapters never import CSS, ADR-002); the px values are not design tokens. G1 question: keep inline or move to a css class.
- The Vue vitest env is `node`; tests use `createRenderer` from `vue` with a no-DOM renderer.

## Bytes
`dist/runtime/index.js` 9.26 kB raw, 3.64 kB gzip including bundled core store/effects/controlled/live/runtime (adapter:vue size row still reports 0 B: its
fixture is not wired, budgets.json is not mine). No ADR-011 row for the adapter runtime.

## Proofs (runtime.test.ts)
Scope disposed on unmount; 1,000 mount/unmount cycles leave 0 live stores and 0 listeners; fast-check sequences leave nothing subscribed; snapshot identity
stable on no-op/effect-only dispatch; no effect before mount; corrective effect from `reconcile()` runs once; single live registry shared; fallback warns once per app.

## G1 fixes (audit AUDIT-G1)
- Vue: `createDomLiveHost` uses the shared `HIDDEN_STYLE` (MUST-3, via `setAttribute('style')`); `SJProvider` config and the outside-provider fallback default to `target: 'client'` (SHOULD-1); `commit()` stamps correctives with `correctiveVersion(version)` (SHOULD-5, no longer mutates `version`). MUST-1 needed no change (the `tick` already drains effect-only dispatches). This answers the open question on hiding: inline, not a class.
