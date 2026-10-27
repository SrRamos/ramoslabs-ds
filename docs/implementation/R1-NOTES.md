# R1 notes: React runtime (W1-120)

Branch `feature/m1-r1-react-runtime`. Code: `packages/react/src/runtime/**`. Spec: ADR-003 bridge row (ARCHITECTURE.md l.263-267), K1/K1b notes.

## Design
- `SJProvider`: builds the runtime (`runtime` prop or `RuntimeConfig` fields), creates ONE `createLiveRegistry` per runtime
  (pure, in `useMemo`), and attaches the DOM live host in `useLayoutEffect` (client, post-commit); cleanup `detach()`es and
  disposes the nodes it made. No `document` read unless attached; with no DOM and no custom `liveHost` nothing attaches.
- `useMachine({ initial, reduce, props, fields, run?, exists? })`: one per component instance. Lazy pure creation of
  store + effect queue + controlled pipeline (a ref initialised once; StrictMode's discarded double render leaves no side
  effects). `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` with the store's stable functions; the
  controlled overlay (`view()`) is derived in render, with this render's props scoped only for that call (`getProps`
  falls back to the last committed props for event handlers, so a discarded concurrent render never leaks props).
- `dispatch/request/native/announce` and the machine's `runtime` are stable (`useCallback`/context); the machine object
  and `state` keep their reference while nothing changes.
- Layout effect (every commit): commit props, `mount()` once after the first commit, `reconcile()` and enqueue the
  corrective effects (version `last + 0.5`, so they supersede a same-batch native effect), then drain `layout` (open,
  close, geometry, focus in EFFECT_ORDER). Passive effect: drain `announce` into the shared registry.
- Outside a provider: per-component default runtime + a one-time dev `console.warn` (in an effect, not in render);
  announcements are no-ops (no host attached).

## Resolved ambiguities
- Who owns teardown: the store is NOT `destroy()`ed on effect cleanup, because StrictMode's simulated unmount keeps the
  instance. React's own `uSES` unsubscribe removes the listener; cleanup only clears the pending queue. Retention is
  proved by gc (see tests).
- Announce effects: reducers emit `{ type: 'announce', text, urgent?, activeDescendant? }` (`AnnounceEffect`); the hook
  routes them to the registry, so component `run` handlers only see layout-phase effects.
- Corrective effect version `last + 0.5` (K1b says the adapter enqueues; version is not specified).

## Tests (environment)
The react package uses vitest `environment: 'node'` (shared config), so there is no DOM. Tests use `react-test-renderer`
(deprecated in React 19, still functional; its warning is muted) plus `react-dom/server` for SSR. Covered: effect order,
passive announce, stable identities, controlled/uncontrolled incl. dev-throw on switch, stale effects, outside-provider
fallback, StrictMode (single run, single attached host), SSR (no markup, no `document`), and 1,000 StrictMode
mount/unmount cycles with real `gc()` (no retained stores via WeakRef; every created live host disposed; scheduler empty).
Mutation-checked: removing host dispose/detach, `mount()`, or stable `dispatch` each fails a test.
Not covered (needs a DOM): real hydration and the DOM live host nodes; left to W1-114 / L2.

## Bytes (min + gzip 9, esbuild, react external)
Whole `runtime` entry including the core modules it pulls (store, effects, controlled, live, runtime): 3,210 B gzip, 6,860 B raw.
No ADR-011 ceiling for this entry.

## Shared-file changes
- `packages/react/package.json`: dependency `@ramoslabs/core` (workspace), devDependencies `react`, `react-dom`,
  `react-test-renderer` 19.3.1 and their `@types`. `bun.lock` regenerated. OPEN: ARCHITECTURE lists the react package's
  runtime deps as "peer react" only; whether core is a dependency or bundled into the adapter is undecided.

## G1 fixes (audit AUDIT-G1, branch feature/g1-fix-adapters)
- MUST-1: `useMachine` bumps a `useReducer` tick from the store `onEffects`, so an effect-only dispatch (state reference unchanged) still commits and drains layout and passive effects. Seeded: effect-only `fx` event in `runtime.test.ts`.
- SHOULD-1: `SJProvider` and the outside-provider fallback create the runtime with `target: 'client'` (an explicit `target` still wins). The server render never reads the scheduler. Seeded: scheduler has no `advance`.
- SHOULD-5: the layout-effect corrective uses `correctiveVersion(inst.version)` from `@ramoslabs/core/effects` (was `version + 0.5`).
- MUST-3: `createDomLiveHost` applies `HIDDEN_STYLE` from `@ramoslabs/core/live` (now one string shared by all three hosts; it adds the `clip` fallback to the old React value).
- NICE-7: `dev.ts` removed; the dev guard is inline in `provider.ts` (K2 convention).
- Shared-file note: `packages/testing/{probe/adapters.test.js,text-safety/host/entry.ts,e2e/runner/host/entry.ts}` built a vanilla host on a server-default (fake) runtime; each now passes `target: 'client'` (needed by the SHOULD-1 dev throw, and it was the same latent bug).
- Core: `correctiveVersion(last) = last + 1` (strictly newer, so a corrective supersedes a same-batch reducer effect of the same type+target; seeded once in `effects.test.ts`).
