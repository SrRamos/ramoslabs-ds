# 02 — Headless engine design

**Research date:** 2026-10-27. This evaluates an owned, dependency-free behavior core shared by Vue 3, React, and vanilla DOM. Framework APIs below are cited from their current official documentation; source dates are retrieval dates where the documentation does not publish a revision date.

## Core question: state machine, reducer, or signals?

### Pure reducer

A reducer maps `(state, event) -> nextState` and can be framework-independent, serializable, and exhaustively tested without a DOM. React’s own guidance identifies reducer purity, action-level debugging, and isolated testing as benefits, while noting additional code and indirection compared with direct state writes ([React reducer guide, retrieved 2026-10-27](https://react.dev/learn/extracting-state-logic-into-a-reducer)). Those properties fit component behavior: pointer, keyboard, native toggle, controlled-prop, and programmatic events all enter one transition pipeline.

A plain reducer does not inherently model legal transitions, nested states, entry/exit effects, or guarded alternatives. Those must be represented explicitly through state shape and transition branches. A full generalized statechart runtime would add concepts and bytes that simple disclosure, selection, and pagination components do not need.

### Explicit state machine

W3C SCXML formalizes states, event-driven transitions, guards, and executable actions; it is a useful semantic reference, not a runtime dependency ([W3C SCXML Recommendation, 2015-09-01](https://www.w3.org/TR/scxml/)). An explicit machine is valuable where illegal combinations are likely: combobox open/active/selected states, dialog close requests, date-range selection, and multi-step focus restoration. For these, named states and guarded transition tables make the contract inspectable and can generate part of the machine-readable registry.

The trade-off is runtime and authoring overhead. The engine should not implement parallel hierarchy, history states, or an interpreter merely because a formal model supports them. A reducer with an explicit finite-state transition table captures the useful subset while retaining small JavaScript functions.

### Signals

The TC39 Signals proposal describes automatically tracked state/computed graphs intended primarily as framework infrastructure. It remains **Stage 1**, with an explicitly unstable API and substantial prototyping still required ([TC39 Signals proposal, retrieved 2026-10-27](https://github.com/tc39/proposal-signals)). Therefore native signals are not a portable 2026 foundation. Framework-specific signal-like APIs would also either leak into the core or require semantic adapters, defeating the goal of one behavioral specification.

Fine-grained updates are a rendering optimization, not proof of a better transition model. A snapshot store can expose the same deterministic transitions while each adapter chooses its supported rendering strategy.

### Decision

Use a **pure reducer core with explicit finite-state metadata where the component needs it**, wrapped in a tiny subscription store. Do not build or import a generalized statechart/signals runtime. Effects such as focus, scrolling, native dialog methods, and announcements run after transitions through adapter-owned effect commands; reducers never touch DOM, clocks, random values, or globals.

## One core, three adapters

### Minimal store contract

Each component instance owns a store with:

- a cached immutable snapshot;
- stable `getSnapshot()` and `subscribe(listener)` functions;
- `dispatch(event)` that returns the same snapshot for no-op transitions and a new snapshot for actual changes;
- per-instance controlled/uncontrolled configuration and item registration;
- `destroy()` for subscriptions, observers, listeners, timers, and registrations.

Cached identity is not optional for React: `useSyncExternalStore` requires repeated unchanged `getSnapshot()` calls to return the same value, compares snapshots with `Object.is`, and warns that fresh objects can loop ([React `useSyncExternalStore`, retrieved 2026-10-27](https://react.dev/reference/react/useSyncExternalStore)). Selector results must likewise be cached or derived from stable snapshot slices.

No store belongs at module scope. Vue documents that module singletons reused by SSR can leak request-specific state across users and recommends constructing application/store instances per request ([Vue SSR guide, retrieved 2026-10-27](https://vuejs.org/guide/scaling-up/ssr.html)). The same isolation rule applies to every adapter and prevents cross-request and cross-root IDs/listeners.

### React adapter

Use `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` rather than a hand-written effect plus local state. React uses the server snapshot during SSR and initial hydration, requires it to match exactly, and performs consistency checks around concurrent updates; external-store mutation during a non-blocking Transition may force a blocking restart ([React `useSyncExternalStore`, retrieved 2026-10-27](https://react.dev/reference/react/useSyncExternalStore)). This is the supported integration boundary for tearing/concurrent safety, not a performance shortcut.

`subscribe` and snapshot functions must have stable identities to avoid repeated resubscription. DOM reads/writes, focus, observers, and listeners belong in layout/effect lifecycles after committed state, never during render. Avoid suspending from component-store values: React documents that external mutations cannot be non-blocking Transition updates and can trigger disruptive fallbacks.

### Vue adapter

Expose the immutable snapshot through a `shallowRef`, replace `.value` only after a changed dispatch, and clean the subscription with an owning effect scope/component unmount. Vue’s SSR guide states that reactivity is disabled during SSR, browser globals must be deferred to client lifecycles, and side effects needing cleanup must not be left in setup ([Vue SSR guide, retrieved 2026-10-27](https://vuejs.org/guide/scaling-up/ssr.html)). Thus construction is deterministic on server; native effects activate only after mount.

Do not deeply proxy the core snapshot or DOM/item registries. Immutable replacement already provides the notification boundary; deep conversion adds another ownership model without improving transition correctness.

### Vanilla DOM adapter

The adapter applies returned attributes/listeners to real elements, subscribes once, batches DOM writes, and provides `mount`, `update`, and `destroy`. `addEventListener` accepts an `AbortSignal` that removes listeners on abort, giving one native cleanup mechanism per mounted component ([MDN `addEventListener`, updated 2026-09-30](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)). Browser APIs are invoked only after mount.

The vanilla adapter must not auto-register custom elements or modify globals at import time. Explicit construction preserves tree-shaking, multiple roots, SSR isolation, and future Svelte/Angular adapters.

## Prop getters, directives, or attribute spreading?

### Comparison

| API | Strengths | Costs / failure modes |
|---|---|---|
| Prop getters (`getTriggerProps`, `getItemProps`) | Framework-neutral values; explicit per-part composition; SSR-renderable attributes; typed handlers; straightforward contract generation | Merge order must be specified; careless spreading can overwrite required ARIA/ref handlers |
| Attribute spreading | Natural React/Vue/vanilla output and simple HTML serialization; no directive runtime | Same overwrite risk; nested listeners/classes/styles need custom merge semantics; user attributes can violate invariants |
| Framework directives | Ergonomic DOM attachment in templates | DOM-centric and framework-specific; Vue directives are ignored during SSR unless `getSSRProps` supplies attributes ([Vue SSR guide, retrieved 2026-10-27](https://vuejs.org/guide/scaling-up/ssr.html)) |

Choose **prop getters as the canonical API**. Compile them to adapter-specific attribute objects and event maps. Directives may be optional sugar later, never the sole contract.

Merge rules must be explicit:

1. Required semantic attributes are computed last from current state; consumer attributes cannot remove required roles, names, relationships, or disabled semantics.
2. Consumer classes/styles append to internal presentation values under documented precedence; behavior classes are not overloaded as state storage.
3. IDs generated by the component win, while explicit consumer IDs are accepted through a defined prop and used consistently in every relationship.
4. For a component event, call the consumer callback first; if it calls `preventDefault()` and the event is cancelable, skip internal behavior. `preventDefault()` cancels the default action but does not stop propagation ([MDN `preventDefault`, updated 2025-09-18](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)).
5. Internal behavior must not depend on `stopPropagation()`, which prevents later capture/bubble propagation and can break surrounding applications ([MDN `stopPropagation`, updated 2025-10-13](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation)). Any unavoidable exception is component-specific and documented.
6. Refs compose so consumer and engine both receive the real element. Disabled controls reject behavior before dispatch; event notifications are emitted once per accepted intent, not once per adapter.

Consumer-first cancellation gives an escape hatch but can let application code break required keyboard behavior. Reserve cancellation for documented events; invariant ARIA state still reflects the actual resulting state.

## Controlled and uncontrolled state

Each controllable value has one owner at a time: controlled props are authoritative, while uncontrolled state lives in the store. A request event computes a candidate transition and emits intent; a controlled component does not commit the candidate unless the owner accepts it. Switching ownership after mount should be rejected in development because it changes synchronization semantics.

Native state is authoritative where the platform owns it: native `toggle`, `close`, `cancel`, `input`, `change`, and `invalid` events dispatch facts into the core. This avoids a React/Vue “open” value drifting from an open native dialog/popover.

## SSR- and hydration-safe IDs

React `useId` derives IDs from component position, avoids global-counter hydration-order problems, requires matching server/client trees, and supports `identifierPrefix` for multiple roots ([React `useId`, retrieved 2026-10-27](https://react.dev/reference/react/useId)). Vue 3.5 added `useId`, guaranteed stable across server/client renders, with `app.config.idPrefix` for multiple apps ([Vue 3.5 announcement, 2024-09-01](https://blog.vuejs.org/posts/vue-3-5); [Vue `useId` API, retrieved 2026-10-27](https://vuejs.org/api/composition-api-helpers.html#useid)).

The architecture should therefore:

- acquire one base ID at the adapter root (`useId` in React/Vue), then append stable anatomy suffixes such as `label`, `hint`, `error`, `trigger`, and `panel`;
- permit an explicit consumer base ID and use it deterministically;
- never use module counters, random values, time, mount order, or array indexes as SSR IDs;
- require an injected SSR ID factory or explicit IDs in vanilla SSR, because plain DOM has no hydration tree from which to derive identity;
- configure unique prefixes for multiple framework roots on one page;
- keep item IDs based on stable consumer item keys, not filtered/sorted positions.

Random values and mismatched trees are documented hydration-mismatch sources in Vue; recovery discards/recreates nodes and costs performance ([Vue SSR guide, retrieved 2026-10-27](https://vuejs.org/guide/scaling-up/ssr.html)). Hydration tests must compare full IDREF relationships, not merely absence of console errors.

## Tree-shaking and bundle budget

Rollup statically removes unused ESM exports; this is more effective when modules have explicit imports/exports and no import-time behavior ([Rollup tree-shaking documentation, retrieved 2026-10-27](https://rollupjs.org/introduction/#tree-shaking)). Publish unbundled ESM modules with component-level entry points, pure module initialization, no global registration, and accurate `sideEffects` metadata that preserves CSS assets. A barrel may re-export modules, but CI must prove that importing one preset does not include unrelated engines.

Bytes are not performance by themselves, but a budget prevents a “tiny shared core” from becoming an unmanaged runtime. Establish these **provisional minified+gzip CI ceilings**, measured per published artifact and revisable only with a written ADR:

- snapshot/subscription utility shared by all components: **1 KiB**;
- simple headless primitive core excluding framework and styles: **3 KiB per component**;
- complex combobox/calendar/grid engine: **8 KiB per component**, with optional submodules split;
- unused component after tree-shaking: **0 KiB JavaScript** in a fixture importing only another component;
- framework adapters: report separately, never count peer framework code as library bytes.

These are engineering limits, not claims of measured current size. CI must also record minified raw bytes and gzip, module import graphs, and fixture execution. Compression can hide parse/compile cost, so byte checks complement—not replace—the interaction benchmarks in research question 05.

## Recommendations for ARCHITECTURE.md

1. **Standardize on pure reducers plus explicit finite-state tables for complex interactions.** Return effect descriptors for adapters to execute after commit. *Trade-off:* effect handling is more verbose than direct method calls, but transitions are deterministic, SSR-safe, and testable once across frameworks.
2. **Define a tiny per-instance immutable snapshot store; do not adopt signals or a statechart interpreter.** *Trade-off:* coarse snapshot notifications may render more than fine-grained graphs, but portable semantics and React concurrency support are worth it until profiling proves a bottleneck.
3. **Use `useSyncExternalStore` in React and shallow snapshot refs in Vue; vanilla subscribes directly and owns an abortable listener scope.** *Trade-off:* three rendering integrations remain necessary, while behavior and tests stay shared.
4. **Make prop getters canonical, with a single merge/composition utility.** Consumer callbacks run first and documented cancellation uses `defaultPrevented`; semantic invariants cannot be spread away. *Trade-off:* less “anything goes” flexibility in exchange for predictable accessibility and cross-framework behavior.
5. **Support controlled and uncontrolled values through one request/commit pipeline, with native events treated as facts.** *Trade-off:* adapters cannot take shortcut state writes, but there is only one transition and notification path to certify.
6. **Generate IDs in the adapter root using framework SSR APIs; require explicit/injected IDs for vanilla SSR.** *Trade-off:* vanilla SSR integration is less automatic than client-only mounting, but duplicate IDs and hydration mismatches are designed out.
7. **Keep modules side-effect free and component-entry based; enforce provisional per-component gzip budgets and zero-byte unused-component fixtures.** *Trade-off:* CI and package exports require maintenance, while consumers do not pay for an ever-present engine registry.
8. **Keep the core free of Vue/React/DOM imports and expose only serializable contracts/events.** *Trade-off:* some adapter code is duplicated, but future Svelte/Angular support does not require rewriting component behavior.

STATUS: DRAFT-COMPLETE