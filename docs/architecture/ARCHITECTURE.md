# RamosLabs component library: architecture

Status: revision 3 for audit (round 1 corrections, owner decision D2, combined audit R1; see CHANGELOG-ARCH-R1.md). Inputs: [BRIEF.md](BRIEF.md), research [01](research/01-platform-primitives.md)
to [07](research/07-testing-certification.md) (audit round 2: 7/7 PASS) and
[audits/AUDIT-research-R2.md](audits/AUDIT-research-R2.md). No component code is written until this
document is certified.

Source notation: `01 §name` points to a section of `research/01-platform-primitives.md`, `02` to
`02-headless-engine.md`, and so on. Where two research files disagree, the ADR says so under
"Conflicts resolved" and picks one side.

---

## 1. Summary

### 1.1 The layered model

```
  @ramoslabs/tokens        DTCG JSON -> CSS variables, TS values, JSON (exists)
          |
  @ramoslabs/css           component CSS: cascade layers, per-part classes, data-attribute axes
          |
  @ramoslabs/core          headless core: reducers, snapshot store, a11y kernel, overlay,
          |                field kinds, geometry, contracts runtime. No Vue/React/DOM imports.
          |
  adapters                 @ramoslabs/vue   @ramoslabs/react   @ramoslabs/vanilla
                           (SJ-prefixed compound primitives + presets built from them)

  @ramoslabs/contracts     machine-readable component contracts (JSON + JSON Schema).
                           Feeds core, adapters, tests, registry.json, MCP server, lint.
```

`@ramoslabs/contracts` is a **build-time input** (code generation, schema validation, test and registry generation) to core, adapters and tests, not a runtime dependency; the arrow from contracts is "generates", not "imports". At runtime each layer depends only on the layers above it in the layered diagram. Tokens know nothing of components.
CSS knows tokens and the DOM contract (parts, `data-*` states), not any framework. The core knows
neither CSS nor frameworks. Adapters translate the core's immutable snapshots and effect descriptors
into framework rendering and DOM side effects, and nothing more.

### 1.2 Principles

1. **Native-first.** Use `<dialog>`, `popover`, `<details>`, `<select>`, `<input>` and native
   constraint validation wherever they solve the problem. Custom UI needs a written capability
   statement. On touch, native wins by default (ADR-008).
2. **Intent-based fields.** A field declares the data it holds (`kind="phone"`); the system sets
   `type`, `inputmode`, `autocomplete`, `enterkeyhint`, `autocapitalize` and the rest. A phone field
   showing the text keyboard is a defect (ADR-007).
3. **Zero runtime dependencies for behavior.** We build the engine. Other libraries are studied,
   never imported (ADR-004). Test-only tools (Playwright, axe, fast-check, Guidepup) are
   devDependencies and never ship.
4. **WCAG 2.2 AA floor, APG patterns, visible focus, full keyboard.** Several internal floors sit above
   AA: 44 CSS px touch targets, the 2.4.13 focus appearance area, 16 CSS px control text on touch.
5. **Composition.** Two levels per component: compound primitives (`SJSelect.Root`, `.Trigger`,
   `.Content`, `.Item`) and a batteries-included preset built from those same primitives, with no
   private back door (ADR-004).
6. **Agent-native contracts.** Each component ships a machine-readable contract that is the single
   source for registry data, shared tests, ARIA snapshots, lint rules and MCP tools (ADR-010).
7. **Determinism where accessibility depends on it.** Focus, selection, typeahead, placement,
   live-region text and virtual ranges are pure functions of inputs. No ML, no runtime inference
   (ADR-012).
8. **Evidence over folklore.** Performance and AT claims need dated, reproducible evidence (ADR-011,
   ADR-013).

### 1.3 Defects designed out

Every known defect in BRIEF "Known defects to design out" maps to a mechanism: shared default ids
(adapter-root `useId` plus suffixes, ADR-003); missing keyboard navigation (shared a11y kernel,
ADR-006); no focus trap or return (native `showModal()` plus explicit opener stack, ADR-005/006);
hover-only tooltips (focus, hover, Escape, touch policy, ADR-006); hand-duplicated colors and
hardcoded px (tokens only, build-time lint, ADR-009); remote font imports (no remote assets in the
packages, ADR-009).

---

## 2. Browser and assistive-technology support floor

The floor is a single decision (ADR-001); this section is the reference table other ADRs cite.

| Engine | Floor | Why this version |
|---|---|---|
| Chromium / Edge | 114 | Popover API, `<dialog>`, `inert`, FACE, native non-modal top layer |
| Firefox | 125 | Popover API |
| Safari / iOS | 17 | Popover API |

In every table cell, versions are ordered Chromium / Firefox / Safari-iOS; "none" means no stable support; a cell never uses a dash. Feature availability relative to the floor (from [01 §Decision summary](research/01-platform-primitives.md#decision-summary),
[01 §Proposed browser floor](research/01-platform-primitives.md#proposed-browser-floor), BCD retrieved 2026-10-27):

| Feature | Chromium / Firefox / Safari-iOS | Tier on the floor |
|---|---|---|
| Popover `auto` / `manual`, `<dialog>`, `inert`, FACE | at or below floor | Native, required |
| `:user-invalid` | 119 / 88 / 16.5 | Native above Chromium 118; touched-state fallback on Chromium 114-118 |
| CSS anchor positioning (core) | 125 / 147 / 26 | **Geometry fallback** on Chromium 114-124, Firefox 125-146, Safari 17-25 |
| `position-area` name | 129 (`inset-area` 125-130, removed 131) / 147 / 26 | Compile the exact subset; never infer from core Baseline |
| `position-try-order` | 125 / 148 / 26 | Same |
| `position-visibility` | 125 / 147 / 26.2 | Same |
| `dialog.requestClose()` | 134 / 139 / 18.4 | Safari 17-18.3: cancelable `cancel` event + `close()` tier |
| Invoker Commands (`command`/`commandfor`) | enhancement | Classic handlers carry the floor |
| `request-close` command | 139 / 144 / 26.2 | Enhancement |
| `popover="hint"` | full 151 / 153 / none | Enhancement; tooltips use `popover="manual"` |
| Customizable `<select>` (`base-select`) | 135 / 149 behind flags / 27 | Disabled on the floor; classic `<select>` is the preset |
| `interestfor` | Chromium 142 only | Enhancement, never a contract dependency |
| View Transitions, same-document | 111 / 144 / 18 | Enhancement outside behavior; skipped below support and for reduced motion |
| View Transitions, cross-document (`@view-transition`) | 126 / none / 18.2 | Enhancement only |
| `<details name>` (exclusive accordion) | 120 / 130 / 17.2 | Owned exclusive-open fallback on Chromium 114-119, Firefox 125-129, Safari 17.0-17.1 |
| `Intl.Segmenter` | 87 / 125 / 14.1 | At or below floor |
| `Intl.Locale.getWeekInfo()` | 130 / 153 / 17 | Missing on Chromium 114-129 and Firefox 125-152: owned fallback |
| `scheduler.yield()` | 129 / 142 / none | `setTimeout(0)` or `MessageChannel` fallback |
| `focus({ focusVisible })` | 145 / 104 / 18.4 | Below floor in places: independent `data-active` indicator |
| `interactive-widget` viewport meta | Chrome Android 108 / Firefox Android 133 / iOS none | VisualViewport residual |

**Assistive-technology floor** ([03 §Required AT test matrix](research/03-a11y-engine.md#required-at-test-matrix)).
The **support matrix** (what we design for) is: NVDA current + Chrome and Firefox; JAWS current +
Chrome or Edge; VoiceOver current + Safari on macOS and on iPhone/iPad; TalkBack current + Chrome on
Android. Secondary: Narrator + Edge; VoiceOver + Chrome; JAWS + Firefox. What differs is the
**evidence level** per AT, defined by ADR-015: only VoiceOver (macOS + Safari, iOS + Safari) is in
the real-test lane, and its entries are `pending-real-test` until a logged run exists (then `tested-real`);
NVDA, JAWS and TalkBack are `evidence-only` (implemented from documented evidence,
not hands-on tested) and are never labelled tested or certified. The matrix is "current stable plus
previous major where lab access permits", with exact builds recorded.
Also required: keyboard-only, 200%/400% zoom and reflow, forced colors, reduced motion, RTL, and
switch/voice activation where available.

*Evidence note for the floor table.* Hands-on verification exists only for desktop Chromium 114 and
Firefox 125 (real floor lane) and, once logged, the owner's iPhone. Rows for iOS 17 and the Android
floor are verified by forced-false path parity and are labelled `not hands-on verified` in the
manifest and docs until a device exists (ADR-013).

---

## 3. Architecture decision records

### ADR-001: Support floor

**Context.** Platform primitives are uneven. Baseline-2026 equals Safari/iOS 26 / Chromium 125 /
Firefox 147 for anchor positioning, which excludes roughly two iOS generations. A floor is needed so
that tree-shaking, fallbacks and the test matrix share one set of numbers.

**Options considered.**
A. Baseline-2026 floor (Safari/iOS 26, Chromium 125, Firefox 147): no geometry fallback, smallest
bundle, excludes a large installed base.
B. Popover floor (Chromium 114, Firefox 125, Safari/iOS 17): oldest coherent set with native
non-modal top layer, dialog, `inert`, FACE.
C. Pre-popover floor (ES2020 plus polyfills): needs own focus trap, top-layer emulation, inert
emulation; contradicts native-first.

**Decision.** Option B. Newer features are enhancements detected independently and never
prerequisites. Every component contract records `nativeFrom` and `fallbackUntil` per feature
(browser version tuples), which drives tree-shaking entry points and the floor test lane
([01 §Proposed browser floor](research/01-platform-primitives.md#proposed-browser-floor), rec. 9).
Support claims are regenerated against the BCD dataset version recorded in the release manifest.

**Consequences.**
- The geometry fallback, the dialog close tiers, and a `:user-invalid` touched-state fallback stay
  in the bundle and the test matrix.
- A real floor test lane is mandatory for desktop Chromium 114 and Firefox 125; the iOS 17 and
  Android floor rows are verified by forced-false path parity and labelled `not hands-on verified` in
  the manifest and docs until a device exists (ADR-013).
- The floor is reviewed at each major release; raising it to Option A is the single biggest
  simplification available and needs an ADR with installed-base evidence.
- `Intl.Locale.getWeekInfo()` is absent on parts of the floor (see [06 audit note](audits/AUDIT-research-R2.md)),
  so calendar presets take an explicit `firstDayOfWeek` and otherwise use an owned data table
  (open question Q5).

**Sources.** [01 §Proposed browser floor](research/01-platform-primitives.md#proposed-browser-floor),
[01 §Decision summary](research/01-platform-primitives.md#decision-summary),
[07 §Test the capability and the real floor](research/07-testing-certification.md#test-the-capability-and-the-real-floor).

---

### ADR-002: Package topology and naming

**Context.** The brief requires Vue 3, React and vanilla now; Svelte and Angular must not be
precluded. The repo is a Bun/Turbo monorepo with `packages/tokens` and an empty `packages/vue`
scaffold. Research requires the core to be free of Vue/React/DOM imports and side-effect-free
([02 rec. 7-8](research/02-headless-engine.md#recommendations-for-architecturemd)).

**Options considered.**
A. One package with subpath exports per framework. Simple publishing; peer-dependency noise and
accidental cross-imports; harder to guarantee zero-byte unused code.
B. One package per layer and per framework (below). More packages; hard dependency boundaries
enforceable by lint and `exports`.
C. Web components only, wrapped by frameworks. Single implementation, but it forces shadow-DOM and
custom-element lifecycle onto SSR/hydration in React and Vue, and couples IDREF-based ARIA to
shadow-root boundaries (`commandfor`/`popovertarget` resolve only within one tree,
[01 §Invoker and Popover composition details](research/01-platform-primitives.md#invoker-and-popover-composition-details)).

**Decision.** Option B.

| Package | Role | Runtime deps | Notes |
|---|---|---|---|
| `@ramoslabs/tokens` | DTCG source, CSS vars, TS, JSON | none | exists |
| `@ramoslabs/css` | component CSS, `@layer` order, per-part classes | tokens (CSS import) | no JS |
| `@ramoslabs/core` | reducers, store, a11y kernel, overlay, geometry, field kinds, parsers | none | no framework/DOM-global imports at module scope |
| `@ramoslabs/contracts` | contract JSON files + JSON Schema | none | consumed by CI, MCP, lint, registry; no JS behavior |
| `@ramoslabs/vue` | Vue 3 adapter, `SJ*` components | peer `vue >=3.5`; `@ramoslabs/core` (regular dependency, never bundled: builds mark it external) (G1 ruling, 2026-10-27) | 3.5 for `useId` |
| `@ramoslabs/react` | React adapter, `SJ*` components | peer `react >=18`; `@ramoslabs/core` (regular dependency, never bundled: builds mark it external) (G1 ruling, 2026-10-27) | `useId`, `useSyncExternalStore` exist in 18 |
| `@ramoslabs/vanilla` | DOM adapter plus opt-in custom elements | `@ramoslabs/core` (regular dependency, never bundled: builds mark it external) (G1 ruling, 2026-10-27) | explicit `define()`; no import-time registration |
| `@ramoslabs/testing` | spec runner, fixtures, lint rules, size and contrast tooling (private, unpublished) | dev only | Playwright, axe, fast-check |

Naming rules (the contract's `anatomy[].part` is the single name source): **React** exports a
namespace object (`SJSelect.Root`, `.Trigger`, `.Content`, `.Item`) plus flat named exports
(`SJSelectRoot`); **Vue** exports flat components (`SJSelectRoot`, `SJSelectTrigger`, since Vue
templates have no namespace components) and the preset `SJSelect`; **vanilla** custom elements are
`sj-select`, `sj-select-trigger`, and so on. CSS classes use the `sj-` prefix and hooks use `data-sj-*`. Core exports are unprefixed (`createSelect`). The existing `packages/vue` scaffold
(0.0.0, unpublished, devDependency already `^3.5.0`) stays; its peer range is raised from `^3.4.0` to `>=3.5.0` (decided; no consumer exists on 3.4) ([02 §SSR- and hydration-safe IDs](research/02-headless-engine.md#ssr--and-hydration-safe-ids)).
Svelte and Angular adapters later consume the same core and contracts with no core changes; the
core's only framework-facing surface is the store contract and effect descriptors (ADR-003).

Entry points: one ESM entry per component per package, a barrel that CI proves does not pull
unrelated engines
([02 §Tree-shaking and bundle budget](research/02-headless-engine.md#tree-shaking-and-bundle-budget)).

*CSS delivery.* Adapters **never import CSS**. Consumers import `@ramoslabs/css` (the full file or
per-component files); `sideEffects` metadata that preserves CSS is set only in `@ramoslabs/css`, and
the required `@layer` declaration order is documented there. This keeps vanilla and SSR parity and
leaves layer order under consumer control.

*Vanilla custom elements render in light DOM, with no shadow root.* A shadow root breaks IDREF ARIA
(`aria-activedescendant`, `aria-controls`, `commandfor`) and `@layer` styling at the boundary, the
reason Option C was rejected. FACE is used via `attachInternals()` only (ADR-014).

*Text safety.* The vanilla adapter (and every adapter) writes consumer strings as text nodes only,
never via `innerHTML`; rich content is supplied as elements. Tested in ADR-013 layer 2.

**Consequences.** More publishing surface; version lockstep across adapters (single version number,
changesets). Dependency direction is enforced by lint (`core` may not import `vue`, `react`, or
`window`/`document` at module scope). Vanilla users get custom elements (needed for FACE) without
the other adapters carrying them.

*Dev-only guard convention* (G1 ruling, 2026-10-27). Development-only code (warnings, throws) is guarded inline with
`typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production'`, with no shared
helper: the inline form does not throw unbundled and folds away under a bundler `NODE_ENV` define,
whereas a helper function (`isDev()`) prevents the message strings from being stripped. This is a
packaging rule, so it applies to every package.

**Sources.** [02 recs. 7-8](research/02-headless-engine.md#recommendations-for-architecturemd),
[01 rec. 6](research/01-platform-primitives.md#recommendations-for-architecturemd),
[02 §Vanilla DOM adapter](research/02-headless-engine.md#vanilla-dom-adapter).

---

### ADR-003: Headless core model

**Context.** One core must bind to Vue reactivity, React concurrent rendering and plain DOM, be
SSR-safe, and be deterministic enough for accessibility.

**Options considered.**
A. Signals as the core primitive: fine-grained, but semantics differ per framework and do not map
to React's concurrent snapshot contract.
B. Explicit state-machine interpreter (statechart): clear transitions, but an interpreter runtime
costs bytes and effect timing is hard to align with post-commit DOM.
C. Pure reducers plus finite-state metadata tables, with a tiny per-instance immutable snapshot
store ([02 §Decision](research/02-headless-engine.md#decision)).

**Decision.** Option C.

*State, events, effects.*
- Each interactive component defines `(state, event, context) -> { state, effects }` as a pure
  reducer. A finite-state table (state names, allowed events) is declared as data for tests and for
  the contract; the reducer is the only implementation.
- Effects are **versioned descriptors** (`{ type: 'focus', target, version }`), never executed in the
  reducer. Adapters drain them **after the committed DOM**: React `useLayoutEffect` (native open,
  focus, geometry) and `useEffect` (announcements), Vue `watch(..., { flush: 'post' })`, vanilla a
  post-patch microtask. Superseded effects (stale version) and effects with a missing target are
  dropped. No synchronous re-dispatch from an effect. Native open precedes dependent focus.
- Per-instance store: cached immutable snapshot, stable `getSnapshot()`/`subscribe()`,
  `dispatch(event)` returning the same snapshot for no-ops, `destroy()` (idempotent), deduped
  `subscribe()`, lazy creation and reversible cleanup so React StrictMode double-invocation is safe.
  **No module-scope stores** (cross-request leakage in SSR).

*Reactivity bridge per framework.*

| Framework | Bridge |
|---|---|
| React | `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`; stable function identities; no DOM reads/writes in render; effects in layout/effect lifecycles |
| Vue 3 | `shallowRef` holding the snapshot, replaced only on a changed dispatch; `markRaw` on snapshot and item registries; subscription owned by an effect scope; native effects only after mount |
| Vanilla | direct `subscribe`; one `AbortController` per mounted instance for every listener; `mount`/`update`/`destroy`; browser APIs only after mount |

*Controlled/uncontrolled.* One request/commit pipeline. Adapters supply a stable `getProps()`
accessor read at derive time and at transition time; controlled props are overlaid on the snapshot
in the derived view and never copied into reducer state. Native events (`toggle`, `close`, `cancel`,
`input`, `change`, `invalid`) report *actual native state*, kept separately from desired controlled
state. If a controlled `open` stays `true` after native Escape, the controlled value wins and a
corrective post-commit native effect reopens the element without redispatching Escape. Switching
ownership after mount throws in development. A controlled owner must accept a change synchronously
inside the change callback (update the prop in the same task): the runtime allows the owner one
microtask, then forces the corrective commit, so an owner that accepts later (a transition, I/O)
sees the native control snap back to the controlled value until its own render commits. An
accepting owner costs no extra render (G3A NICE-2).

*SSR-safe ids.* One base id is acquired at the adapter root (`useId` in React and Vue 3.5) and
anatomy suffixes are appended (`-label`, `-hint`, `-error`, `-trigger`, `-panel`). Consumers may pass
an explicit base id. Never counters, randoms, time, mount order or array indexes. Vanilla SSR
requires an injected id factory or explicit ids. Multiple framework roots on one page set unique
prefixes (`identifierPrefix`, `app.config.idPrefix`). Item ids derive from stable consumer item keys,
not filtered or sorted positions. IDREF attributes use raw ids; `anchor-name` and
`view-transition-name` use a separate sanitized id map; selectors use `CSS.escape`.

*Compound registration.* Data-first: the consumer supplies an ordered collection (or the preset
builds it); a key-to-id map is the source of truth; mounted items register their elements;
`compareDocumentPosition` is post-mount reconciliation only, never SSR truth. Virtual items mount
before `aria-activedescendant` is written.

*Side effects.* Modules have no import-time behavior. The core imports no Vue, React or DOM globals
at module scope, exposes only serializable contracts/events, and receives all ambient inputs
through the runtime object below.

*Runtime configuration (single injection surface).* Everything ambient is supplied through one
**runtime object**, created once per app or per request by `createRuntime(config)` in the core:

```ts
interface SJRuntime {
  locale: string            // BCP 47; drives parsers, case folding, Intl.Segmenter, week data
  dir: 'ltr' | 'rtl'
  idPrefix: string          // unique per framework root; mirrors identifierPrefix / app.config.idPrefix
  idFactory?: () => string  // required for vanilla SSR; otherwise adapter useId
  density: 'touch' | 'compact'
  supports: SupportsMap     // capability map (ADR-013)
  scheduler: Scheduler      // platform timers in production; deterministic fake in SSR/tests
}
```

React and Vue expose it through `SJProvider` (context / `provide`); vanilla passes it to
`mount(el, runtime)`. The live-region registry hangs off the runtime's document. **Defaults are
deterministic across server and client:** `locale` and `dir` are read from `<html lang dir>` of the
server render input and the same values are serialized to the client (never `navigator.language`);
`supports` is real detection on the client and all-false on the server, applied after hydration so
markup matches; `scheduler` uses platform timers. A component used outside a provider falls back to
these defaults and a development warning; the contract lists `runtime` in `props` provenance so lint
can flag it. Components never read `document.documentElement` or `navigator` for these values.

**Consequences.** Coarse snapshot notifications can over-render versus fine-grained graphs;
accepted until profiling shows a bottleneck. Effect handling is more verbose than direct method
calls. In return: transitions are deterministic and shared by all adapters, focus never targets
uncommitted DOM, and Svelte/Angular need only a store bridge.

**Conflicts resolved.** None between files. One tension is recorded: 02's 3 KiB per-component ceiling
(ADR-011) must hold alongside 01's mandatory geometry/close fallbacks. Resolution in ADR-011: shared
kernel modules carry their own ceilings. The injection surface is an architectural addition (no
research file specifies it) justified by 02's SSR-determinism and per-instance-isolation rules.

**Sources.** [02 §Decision](research/02-headless-engine.md#decision),
[02 §One core, three adapters](research/02-headless-engine.md#one-core-three-adapters),
[02 §Revision 1](research/02-headless-engine.md#revision-1-commit-registration-and-lifecycle-contracts),
[02 §Controlled and uncontrolled state](research/02-headless-engine.md#controlled-and-uncontrolled-state),
[02 §SSR- and hydration-safe IDs](research/02-headless-engine.md#ssr--and-hydration-safe-ids).

---

### ADR-004: API shape (prop getters, attributes, compound registration)

**Context.** The adapters must expose the same behavior with idiomatic APIs, and consumers must not
be able to spread away accessibility invariants. AUDIT-R2 02 SHOULD 7 asks for a studied-reference
comparison with licences and measured sizes.

**Options considered.**
A. Prop getters returning attribute/handler bags (`getTriggerProps()`), merged by one utility.
B. Directives/actions (Vue directives, Svelte actions, Melt-style builders). Idiomatic in two
frameworks, nonexistent in React, awkward for SSR attributes.
C. Render props / component-only API (Headless UI style). Hides attributes from vanilla and
contracts.
D. Attribute spreading of a fixed shape generated from the contract.

**Decision.** Option A as canonical, rendered as D in framework components.
- Core exposes `parts` as prop getters: `getRootProps()`, `getTriggerProps()`,
  `getItemProps(key)` returning a plain object of attributes and event handlers. Getters are pure
  functions of the snapshot and `getProps()`.
- **One merge utility** composes consumer and library props: attributes merge with documented
  precedence (ARIA/role/ids from the library win; `class`/`style` concatenate), and event handlers
  run **consumer first, then library**; a consumer calling `preventDefault()` cancels the library
  handler (documented cancellation via `defaultPrevented`). Semantic invariants (role, ids, IDREFs,
  `aria-*` derived from state) cannot be overridden by a spread; development builds warn.
- Framework components are thin: Vue SFC/render functions and React components call getters and
  spread results; the vanilla adapter applies attributes and listeners to real elements and offers
  optional custom elements (`sj-select`) with FACE only where native form participation adds value
  (ADR-014).
- Compound primitives (`SJSelect.Root/.Trigger/.Content/.Item`) are the API; each preset
  (`SJSelect`, one prop-driven component) is implemented **only** from the exported primitives.
  A CI check fails if a preset imports a non-public internal.
- Prop-or-slot for label, hint, content; controlled per-part class overrides (`classes={{ trigger: '...' }}`);
  one types file per component documents props, events, slots (generated from the contract where
  possible).

*Studied references (concepts only, never imported).* Licences verified 2026-10-27 against each project's repository.

| Reference | Licence | Concept studied | What we do differently |
|---|---|---|---|
| React Aria / React Stately (Adobe) | Apache-2.0 | Hook-per-pattern, collections, interaction normalization, i18n | Core is framework-free; no hook API |
| Radix UI Primitives | MIT | Compound parts, `asChild`, controlled/uncontrolled | Reducer + contract rather than component-embedded logic |
| Zag.js / Ark UI | MIT | Framework-agnostic machines, normalized props per framework | Pure reducers, not an interpreter; effects drained post-commit |
| Headless UI (Tailwind Labs) | MIT | Render-prop composition, transitions | Attributes are public, so vanilla and agents can use them |
| Melt UI | MIT | Builders/actions, stores | Snapshot store with React-safe identity, not Svelte stores |
| Floating UI | MIT | Flip/shift/size middleware | Placement policy is the CSS anchor vocabulary itself (ADR-005) |

*Sizes.* The ceilings of ADR-011 are **our** engineering limits, not derived from these libraries,
and nothing in this architecture depends on the reference numbers. We make no size-superiority
claim. Reference-library sizes (comparable select, dialog and tabs builds, minified+gzip,
tree-shaken, same bundler, versions recorded) are measured during wave 1 and recorded in
`docs/architecture/evidence/`; they may revise ADR-011 ceilings only through an ADR.

**Consequences.** Less "anything goes" flexibility than a bare render prop. Predictable ARIA across
frameworks. The three rendering integrations stay hand-written; behavior and tests are shared.

**Conflicts resolved.** 02 recommends prop getters as canonical while BRIEF cites
"attribute-spreading APIs" as an alternative; both are the same mechanism at different layers.

**Sources.** [02 §Prop getters, directives, or attribute spreading?](research/02-headless-engine.md#prop-getters-directives-or-attribute-spreading),
[02 rec. 4](research/02-headless-engine.md#recommendations-for-architecturemd),
[AUDIT-R2 02 SHOULD 7](audits/AUDIT-research-R2.md), [AUDIT-architecture MUST 1](audits/AUDIT-architecture.md), BRIEF constraints 2 and 6.

---

### ADR-005: Overlay and positioning

**Context.** Overlays (dialog, popover, menu, tooltip, listbox) need top-layer rendering, light
dismiss, Escape order, focus handling and placement. The floor lacks anchor positioning (ADR-001).

**Options considered.**
A. A generic custom overlay layer (portal, z-index stack, own outside-click and focus trap).
B. Native-first: `<dialog>.showModal()` for modal, Popover API for non-modal; CSS anchor positioning
for placement; deterministic geometry fallback below each property's floor.
C. Import a positioning library. Forbidden by BRIEF constraint 2.

**Decision.** Option B.
1. **Two paths, never blurred.** Modal components use `showModal()`; non-modal top-layer components
use Popover `auto`; tooltips use `popover="manual"` with an engine-controlled stack. `dialog.show()`
is never used as a modal substitute. `popover="hint"` and `interestfor` are optional detected
enhancements; no semantics depend on them.
2. **Placement vocabulary lives in the contract.** `position-area`, ordered `position-try-fallbacks`
(including `flip-block`, `flip-inline`, named `@position-try`), `position-try-order` and
`position-visibility`. The CSS compiler emits those declarations; the geometry fallback parses the
same contract and evaluates candidates in declaration order. One placement policy, two executors.
Parity tests feed identical rectangles to both and assert identical candidate, offset and
visibility.
3. **CSS-only placement above each property's floor; the scheduler-driven geometry fallback on the
floor** (property-level, per [01 §Anchor property floors](research/01-platform-primitives.md#anchor-property-floors-used-by-the-contract)).
This is the wording required by AUDIT-R2 for 05 rec. 1; the research text "CSS-only on the floor"
is superseded.
4. **Scheduler is fallback-only and commit-ordered.** The read-compute-write scheduler exists for the
geometry fallback, variable-height virtualization and keyboard-viewport reactions. It drains through
the ADR-003 post-commit queue; no independent `requestAnimationFrame` racing the framework. Native
CSS placement never enters JavaScript.
5. **Nesting and Escape order follow the HTML algorithms**, not a parallel global stack: an `auto`
popover above a modal closes first on Escape; nested `auto` popovers preserve only ancestor chains;
a modal opened from a popover enters the top layer above it; a `hint` never closes an `auto`. The
engine keeps an explicit opener reference and nested-overlay stack synced from native `toggle`/`close`
events. These five rules are fixture dimensions for select-in-dialog and menu-in-popover tests.
6. **Dismissal.** Native light dismiss where it exists; otherwise capture-phase `pointerdown` on
`document` with `composedPath()` exclusion, installed only when native light dismiss is absent.
Dialogs always render an explicit close control; popovers are never a modal substitute.
7. **Close requests.** `closedby` is detected independently; `requestClose()` from Safari/iOS 18.4,
cancelable `cancel` + `close()` below; both route to the same internal close operation.
8. **Listbox mounting is a static contract flag, not runtime detection.** AUDIT-R2 notes that
"inline listbox when top-layer navigation fails" cannot be detected at runtime. Contract field
`overlay.listboxMount` is keyed on a capability class, not user-agent sniffing. The class is `any-pointer: coarse`
(touch-capable), not the primary pointer, because an iPad with a trackpad reports a fine primary
pointer while the cited evidence is VoiceOver on iOS. It is explicitly a proxy for the AT populations
in the evidence; Q4 is the revision path:
```json
"listboxMount": { "default": "top-layer",
                  "byAnyPointer": { "fine": "top-layer", "coarse": "inline" },
                  "evidence": ["WebKit 289338", "APG 2855"] }
```
Both values are defined by DOM placement: `top-layer` is DOM-adjacent to the trigger and promoted
via `popover`; `inline` is DOM-adjacent and not promoted; **portal-to-body is forbidden in both**
(WebKit 289338 concerns a listbox mounted outside the combobox container, not top-layer rendering
as such). The mapping flips
for a platform class only by an ADR citing dated evidence-registry entries (ADR-015) or VoiceOver real-test logs. The evidence (research 03):
VoiceOver iOS does not move into a listbox mounted at the end of `<body>` (WebKit 289338, NEW,
2025-03-07); TalkBack/Chrome shows a selection failure for select-only combobox, with
active-descendant suspected and not confirmed (APG issue 2855). These are leads, not permanent
claims. No user-agent detection and no `aria-owns` workaround is shipped.
9. **Keyboard viewport.** `svh`/`dvh` and `interactive-widget` first; `visualViewport` resize
handling for residual overlay geometry; `navigator.virtualKeyboard` never a prerequisite.

**Consequences.** Two behavioral paths and two placement executors must be certified in parity. The
geometry fallback bundle is paid by popover-family components (ADR-011 ceiling). Raising the floor
removes it. Modal and non-modal semantics stay comprehensible and native.

**Conflicts resolved.** (i) 05 rec. 1 "CSS-only on the floor" vs 01's floor (Safari 17 has no
anchor positioning): 01 wins, wording fixed in step 3. (ii) 03 "inline popup fallback where required"
vs "cannot be detected at runtime": resolved as the static flag in step 8.

**Sources.** [01 recs. 2-4](research/01-platform-primitives.md#recommendations-for-architecturemd),
[01 §Top-layer nesting and Escape order](research/01-platform-primitives.md#top-layer-nesting-and-escape-order),
[06 §One placement policy](research/06-math-ml.md#one-placement-policy-for-css-and-fallback-geometry),
[05 §Scheduler is fallback-only](research/05-performance.md#scheduler-is-fallback-only-and-commit-ordered),
[03 §Select-only combobox and top-layer relationships](research/03-a11y-engine.md#select-only-combobox-and-top-layer-relationships),
[04 §Virtual keyboard and viewport](research/04-mobile-input-ux.md#virtual-keyboard-and-viewport),
[AUDIT-R2](audits/AUDIT-research-R2.md) (03 follow-up, 05 correction).

---

### ADR-006: Focus and keyboard engine (the accessibility kernel)

**Context.** The brief names missing keyboard navigation in listbox, combobox, menu and tabs, and
missing focus trap/return, as defects. APG contracts differ per pattern; forcing one focus policy on
all would violate APG ([03 rec. 1](research/03-a11y-engine.md#recommendations-for-architecturemd)).

**Options considered.**
A. Per-component ad hoc keyboard code.
B. A shared kernel with explicit per-pattern options, with keyboard maps and ARIA contracts generated
from component definitions.
C. Rely on ARIA structure alone and native behavior.

**Decision.** Option B. The kernel (inside `@ramoslabs/core`) provides:
- **ID relationships** (label, description, error, controls, owns) derived from the base id.
- **Collection registration** (ADR-003) with deterministic successor on item removal; focus never
falls to `<body>`.
- **Focus strategy, one per composite**, never both at once:

| Pattern | Strategy |
|---|---|
| Tabs, radio group, menu, standalone listbox, grid | Roving DOM focus (tabindex 0/-1, `.focus()`) |
| Editable combobox | `aria-activedescendant`, DOM focus stays in input |
| Custom select-only combobox | DOM focus on trigger + `aria-activedescendant` (APG select-only) |
| Disclosure, switch, dialog, tooltip | Native focus; no composite strategy |

  Every active id must resolve to an owned/controlled element, survive list updates and reset before
  its element unmounts. Focus and selection have distinct visuals. The engine sets `data-active` on the active
  item in **every** composite and draws the indicator from it, not from `:focus-visible` alone (which may not match after
  programmatic focus following a pointer open); roving composites additionally carry real focus; the engine does one `focus({ preventScroll: true })`
  plus one `scrollIntoView({ block: 'nearest' })` with tokenized `scroll-margin`.
- **Native roving.** For native radio groups the browser owns arrow behavior: the kernel observes
  focus to set `data-active` and does not reimplement or double-handle arrows (contract
  `focus.strategy: native-roving`; [03](research/03-a11y-engine.md#roving-tabindex-versus-aria-activedescendant)).
- **Focus scope and return:** explicit opener reference; restore only when the target is connected,
visible, enabled and not `inert`, otherwise a declared logical fallback; no restore when a workflow
deliberately advanced. Popover does not trap focus; `showModal()` provides trap and inertness
natively.
- **Typeahead:** next option whose accessible name starts with the accumulated string, cycling;
normalization is Unicode normalize + trim/collapse + locale case folding; diacritics are not
stripped by default. Separate from fuzzy search (ADR-012).
- **IME and Android:** no typeahead, filtering, inline autocomplete or Enter-accept during
composition; guard with both `isComposing` and a session state flag. Editable inputs use
`beforeinput`/`input` + `inputType` (Android reports `keyCode` 229); non-editable composites use
`keydown`.
- **Live regions:** persistent, document-shared, client-only registry (excluded from SSR); polite
`status` for counts and completion, `alert` only for urgent interruptions; deduplicated; never a
second announcement of an active-descendant move; no live region compensates for missing focus or
semantics.
- **Tooltips:** shown on focus and hover, dismissed with Escape, hoverable, persistent while hovered
or focused; never hover-only; on touch, the information is reachable without hover (visible text or
a disclosure) ([03 §Tooltip](research/03-a11y-engine.md#tooltip)).
- **Dated AT issue log** in the repo with minimal repro, speech output, versions and retest result;
user-agent-keyed ARIA workarounds are prohibited.
- Keyboard maps and ARIA contracts are **generated from the component definition** and consumed by
both code and tests (ADR-010).

**Consequences.** Two popup layouts (top-layer, inline) need parity testing; IME paths need extra
fixtures; the kernel exposes per-pattern options rather than one policy.

**Conflicts resolved.** 03 prefers roving by default and active-descendant for editable/select-only;
the table above states the exact assignment. 03's note that `focus({ focusVisible })` is
"non-portable" is restated as "below the floor on some engines", per AUDIT-R2.

**Sources.** [03 §Focus engine](research/03-a11y-engine.md#focus-engine),
[03 §Typeahead and IME](research/03-a11y-engine.md#typeahead-and-ime),
[03 §Live regions](research/03-a11y-engine.md#live-regions),
[03 §Required APG contracts](research/03-a11y-engine.md#required-apg-contracts),
[03 recs. 1-8](research/03-a11y-engine.md#recommendations-for-architecturemd),
[05 §Containment, pointers, and platform caveats](research/05-performance.md#containment-pointers-and-platform-caveats).

---

### ADR-007: Intent-based field kinds

**Context.** Wrong virtual keyboards, autocapitalization and autofill are systematic defects when each
app sets attributes by hand. The form owner, not an isolated field, knows the Enter action.

**Options considered.**
A. Per-field manual attributes.
B. A declarative `kind -> native attributes` table in the contract; explicit props refine.
C. Runtime inference of kind from labels or content. Rejected ([06 §Input-pattern detection](research/06-math-ml.md#input-pattern-detection-declaration-beats-inference)).

**Decision.** Option B. `SJInput kind="phone"` resolves the row below at render time in the core
(`resolveKind(kind, ctx)`), a pure function. Consumers may override an attribute when the declared
data semantics remain true. Autofill fields need a stable `name`/`id`, an owning `<form>` and a
visible label; address/contact repeats use autofill section tokens.

*Enter key.* Textarea kinds always use `enterkeyhint="enter"` and are excluded from the position computation. `enterkeyhint` is otherwise computed by the **form owner**: `next` when another editable field
follows; `done` on the last field of a non-submitting group; `go` when Enter navigates or submits;
`send` for messaging; `search` for query submission. Kind overrides: URL `go`, Search `search`, OTP
`done` (auto-submit off) or `go` (on). The "Enter" column below is the default when the owner gives
no position.

| Kind | `type` | `inputmode` | `autocomplete` | Enter | `autocapitalize` / `autocorrect` / `spellcheck` | Notes |
|---|---|---|---|---|---|---|
| `text` | text | text | context or `on` | position | sentences / on / true | |
| `name` | text | text | `name` | position | words / off / false | `given-name`, `family-name` variants |
| `username` | text | text | `username` | position | none / off / false | |
| `email` | email | email | `email` | position | none / off / false | |
| `url` | url | url | `url` if meaningful | go | none / off / false | |
| `phone` | tel | tel | `tel` or `tel-*` part | position | none / off / false | unmasked editing, format on blur; no `maxlength` |
| `otp` (numeric) | text | numeric | `one-time-code` | done / go | none / off / false | one control, paste-safe; ASCII-digit `pattern` optional; length validated after normalization; no `maxlength` |
| `otp-alnum` | text | text | `one-time-code` | done / go | characters only if canonical uppercase / off / false | |
| `amount` (decimal) | text | decimal | `transaction-amount` only in that context | position | - / off / false | `Intl` display, owned parser; no spinbutton |
| `amount-signed` (`amount` with `signed`) | text | decimal | as `amount` | position | - / off / false | iOS `decimal` may omit minus: render an explicit sign control (toggle or prefix part); parser accepts leading `-` or `−` only when `signed` (credit notes, refunds) |
| `quantity` | number or text | numeric (text variant) | context or `off` | position | - | `number` only where stepping helps; `min/max/step` |
| `postal` / `reference` / `account` | text | numeric only when digits-only by contract | `postal-code` or token | position | - | preserve leading zeroes; never `type=number`; no `maxlength` |
| `tax-id` | text | numeric only when digits-only | attribute omitted (no standard token; `off` is not a generic suppressor) | position | - | normalize, then validate check digit |
| `search` | search | search | usually `off` | search | by domain | |
| `password` (current) | password | text | `current-password` | position | none / off / false | |
| `password-new` | password | text | `new-password` | position | none / off / false | distinct section tokens if needed |
| `date` | date | n/a | `bday` only for birth date | position | - | native picker; value `yyyy-mm-dd` |
| `time` | time | n/a | context or `off` | position | - | `step` when needed |
| `choice` (native) | `<select>` | n/a | purpose token | position | - | no ARIA listbox recreation |
| `cc-number` | text | numeric | `cc-number` | position | - | normalize then checksum; never `type=number` |
| `cc-exp` / `cc-exp-month` / `cc-exp-year` | text | numeric | `cc-exp` / `cc-exp-month` / `cc-exp-year` | position | - | `cc-exp` accepts digits-only `MMYY`/`MMYYYY` and **inserts the display separator itself** (the iOS numeric keypad has no `/`); the month/year pair is the alternative; keep leading zero |
| `cc-csc` | text | numeric | `cc-csc` | done | - / off / false | |
| `cc-name` | text | text | `cc-name` | position | words / off / false | |
| `address` | textarea | text | `street-address` | `enter` (fixed) | - | Enter inserts a newline: textarea kinds are excluded from the form owner's position computation; use `address-line1..3` for split lines; never combine |
| `address-line` | text | text | `address-line1/2/3` | position | - | |
| `country` | `<select>` (default, `choice`) | n/a | `country` (ISO 3166-1 alpha-2 code) | position | - | text variant (`type=text`, `inputmode=text`) uses `country-name`; never infer from keyboard locale |
| `organization` | text | text | `organization` | position | words (hint) | |

*Rules attached to the table.*
- OTP is a **single** text control; split-character inputs are not the default (extra paste, focus,
screen-reader and deletion logic).
- Numeric-looking identifiers never use `type="number"` (spinbutton and invalid-character problems).
- No `maxlength` on phone, amount, reference, tax, card or OTP: `maxlength` truncates pasted text
before any `input` event, so "normalize first" becomes impossible. Length is validated after
normalization.
- Locale numbers: `Intl` formats; an owned deterministic parser reads input, accepting both
separators with a grouping-structure rule, no prefill, tested in both directions per locale; never
`parseFloat`, punctuation stripping or binary money arithmetic. Canonical value is separate from
editing text.
- Phone: unmasked; live masks require caret-mapping and paste tests.
- Keyboard locale is not application locale.
- `autocorrect` is supported from Chromium 153 / Firefox 136 / Safari 14.1 and is treated as a hint.
- Touch control text is at least 16 CSS px via size tokens, with `maximum-scale`/`user-scalable`
prohibited (WCAG 1.4.4) ([04 §Prevent focus-triggered zoom](research/04-mobile-input-ux.md#prevent-focus-triggered-zoom-through-type-tokens)).
- Each kind row is certified on physical iOS Safari (the owner's iPhone); Android Chrome rows are `not run` and labelled so until a device exists (keyboard, minus/decimal,
Enter label, autofill, paste, caret, deletion, IME, leading zeroes, rotation).

*Home of the table.* `packages/contracts/kinds.contract.json`, validated by `kinds.schema.json`, is the
source of `resolveKind`, the generated `kind` union, lint rules and the MCP `get_kind` tool.

**Consequences.** Kind rows need device-level certification and occasional overrides. Library cannot
guess; an unknown kind is a type error (the `kind` union is generated from the contract). Presets for
auth (`otp`, `password`) interact with WCAG 3.3.8 (ADR-013).

**Sources.** [04 §Recommended intent-to-native mapping](research/04-mobile-input-ux.md#recommended-intent-to-native-mapping),
[04 §One-time codes](research/04-mobile-input-ux.md#one-time-codes),
[04 §Phone formatting](research/04-mobile-input-ux.md#phone-formatting-without-damaging-input),
[04 §Locale-aware numbers and currency](research/04-mobile-input-ux.md#locale-aware-numbers-and-currency),
[04 recs. 1-4, 8](research/04-mobile-input-ux.md#recommendations-for-architecturemd),
[06 §Input-pattern detection](research/06-math-ml.md#input-pattern-detection-declaration-beats-inference).

---

### ADR-008: Native versus custom on touch

**Context.** The 2026 WebAIM survey reports 91.8% of respondents use a mobile screen reader, and
custom composites have open VoiceOver/TalkBack defects (ADR-005 step 8). Native controls carry
platform keyboards, pickers, autofill and AT support.

**Options considered.**
A. Same custom UI on every platform for visual consistency.
B. Native by default on touch; custom only with a written capability statement; presentation may
differ by pointer class if the contract stays equivalent.
C. Native everywhere including desktop.

**Decision.** Option B.

*Decision rule* (evaluated in order, recorded as a `nativeFallback` block in the contract):
1. If a native element satisfies the data semantics and required capabilities, use it. Always so
for date, time, short fixed single-choice lists, and boolean controls.
2. Custom is allowed only if the contract lists a capability natives lack: filtering, async
suggestions, rich non-interactive option descriptions, values beyond native options, range selection
with cross-month constraints, unavailable-date visualization, week numbers, multi-month comparison.
Pixel parity across operating systems is not a capability.
3. On touch-capable devices (`(any-pointer: coarse)`), if the contract can stay equivalent, the **native
control is rendered** even where desktop uses a customized trigger. Equivalence test: accessible
name, value and form state are identical across presentations.
4. A custom control retained on touch must pass the touch protocol: touch exploration order,
activation, scrolling, dismissal, with `listboxMount: inline` unless ADR-005's evidence flips it.
5. A custom calendar keeps a text-entry or native alternative where practical, full grid keyboard,
and locale/week-start rules.

*Touch preset.* Tokenized 44 CSS px minimum target where layout permits; 24 CSS px (WCAG 2.5.8) is
the absolute floor, not the aim; Android 48 dp is checked separately (dp is not px). Hit area, not
icon, counts; no overlapping pseudo-element hit areas. Hover is never the only trigger, long-press
never the only route, drag always has a single-pointer alternative (2.5.7). A separate density preset
serves dense desktop layouts; touch usability is never shrunk to fit.

**Consequences.** Touch and desktop can differ visually; equivalence tests guard behavior. Less
visual uniformity in exchange for native keyboard, autofill and AT behavior.

**Sources.** [04 §When native pickers win](research/04-mobile-input-ux.md#when-native-pickers-win),
[04 §Touch targets and gestures](research/04-mobile-input-ux.md#touch-targets-and-gestures),
[03 rec. 3-4](research/03-a11y-engine.md#recommendations-for-architecturemd),
[01 rec. 5](research/01-platform-primitives.md#recommendations-for-architecturemd),
[03 §Known AT x browser evidence](research/03-a11y-engine.md#known-at--browser-evidence-facts-not-folklore).

---

### ADR-009: Styling layer

**Context.** BRIEF defects: hand-duplicated color values, hardcoded px, remote font imports.
AGENTS.md: never hardcode color, spacing, typography, radius, shadow or motion; tokens are authoritative.

**Options considered.**
A. CSS-in-JS per component. Runtime cost, SSR complexity, no vanilla parity.
B. Utility-class dependence (Tailwind-style). Adds a build dependency to consumers.
C. Plain CSS shipped as `@ramoslabs/css`: tokens as custom properties, cascade layers, per-part
classes, `data-*` axes.

**Decision.** Option C.
- **Pipeline:** `@ramoslabs/tokens` (DTCG JSON) -> `tokens.css` -> `@ramoslabs/css`. Component
styles reference only `var(--space-*)`, `var(--color-*)`, `var(--radius-*)` and so on. A stylelint
rule rejects raw hex, raw px (except documented zero/`1px` hairline tokens) and non-token durations;
a build check fails on them. Required token additions (touch target size, focus ring width/offset,
control text minimum, overlay sizing caps) are made in `packages/tokens` first, never inline.
- **Cascade layers:** `@layer sj.reset, sj.base, sj.component, sj.variant, sj.state;`. Consumer
unlayered CSS always wins over any `sj.*` layer, so overrides need no specificity fights. The
layer order is part of the public API.
- **Per-part classes and hooks:** each anatomy part has a stable class `sj-<component>__<part>`
(for example `sj-select__trigger`) and `data-part`. Library state is exposed as `data-state`,
`data-active`, `data-disabled`, `data-invalid`, never as generated class names.
- **Orthogonal axes:** `variant` x `tone` x `size` set as `data-variant`, `data-tone`, `data-size`,
mapped to tokens in `sj.variant`. Controlled per-part class overrides come from the adapter
(ADR-004).
- **Contrast at build time:** every `variant x tone x size` text/background pair asserted at 4.5:1
and UI/focus pairs at 3:1, so token changes fail before rendering ([07](research/07-testing-certification.md#wcag-22-is-a-checklist-not-an-axe-tag-set)).
- **Focus:** visible indicator at or above WCAG 2.4.13 area and 3:1 change contrast, via tokens;
never `outline: none` without replacement.
- **Motion:** `prefers-reduced-motion` honored through motion tokens; View Transitions live in
wrappers outside state machines and are skipped for reduced motion.
- **Fonts:** no remote font imports in any package; consumers load fonts; visual tests load production
font files with `font-display: block`.
- **Containment:** `contain: layout paint` on overlay panels and list rows only where it does not
clip focus rings or popovers; `will-change` only temporarily after profiling; animate
transform/opacity.
- **Logical properties** and RTL are default.

**Consequences.** Consumers get zero-JS styles that work in vanilla HTML. Teams that bring their own
CSS override via layers and per-part hooks without `!important`.

**Sources.** AGENTS.md "The one hard rule"; [07 §WCAG 2.2](research/07-testing-certification.md#wcag-22-is-a-checklist-not-an-axe-tag-set);
[05 rec. 5](research/05-performance.md#recommendations-for-architecturemd);
[01 rec. 8](research/01-platform-primitives.md#recommendations-for-architecturemd);
[04 §Prevent focus-triggered zoom](research/04-mobile-input-ux.md#prevent-focus-triggered-zoom-through-type-tokens).

---

### ADR-010: Component contract schema

**Context.** BRIEF constraint 7 and research 01/03/07 all converge: one machine-readable contract per
component must feed registry data, shared semantic tests, ARIA snapshots, lint and the MCP server so
that frameworks and agents cannot drift.

**Options considered.**
A. Prose docs plus TypeScript types only.
B. A JSON contract per component validated by JSON Schema, from which docs, registry, tests and lint
rules are generated.
C. Contracts embedded in TypeScript code only. Not consumable by non-JS tools.

**Decision.** Option B. File: `packages/contracts/<component>.contract.json`, validated against
`contract.schema.json`; `registry.json` is **generated** from the contracts in CI (a PR job fails on
schema violation or registry drift).

```json
{
  "$schema": "https://design.ramoslabs.com/schema/contract.v1.json",
  "name": "SJSelect",
  "contractVersion": "1.0.0",
  "status": "draft | beta | stable",
  "pattern": { "apg": "combobox-select-only", "native": "select",
                "evidence": "select-only-combobox" },  // evidence required (G2 ruling, 2026-10-27)
  "anatomy": [
    { "part": "root",    "element": "div" },
    { "part": "trigger", "element": "button", "role": "combobox", "native": false },
    { "part": "content", "element": "div",    "role": "listbox", "mount": "overlay" },
    { "part": "item",    "element": "div",    "role": "option", "repeats": true }
  ],
  "state": { "machine": ["closed", "open"], "controllable": ["open", "value"] },
  "actions": [
    { "id": "open", "from": "closed", "to": "open",
      "emit": "openChange", "focus": "activeItem",
      "aria": { "trigger": { "aria-expanded": "true" } } }
  ],
  "keyboard": {
    "trigger": { "ArrowDown": "open", "Enter": "open", "Space": "open" },
    "content": { "ArrowDown": "next", "ArrowUp": "prev", "Home": "first",
                 "End": "last", "Escape": "close", "typeahead": "prefix" }
  },
  "focus": { "strategy": "activedescendant", "owner": "trigger" },
  "kinds": ["choice"],
  "runtime": ["locale", "dir", "idPrefix", "supports", "scheduler"],
  "nativeFallback": {
    "touch": "select", "equivalence": ["name", "value", "formState"],
    "customRequires": ["filtering", "richOptions"]
  },
  "overlay": {
    "kind": "popover",
    "placement": { "positionArea": "block-end span-inline-end",
                   "tryFallbacks": ["flip-block"], "tryOrder": "most-height",
                   "visibility": "anchors-visible" },
    "listboxMount": { "default": "top-layer", "byAnyPointer": { "coarse": "inline" } }
  },
  "support": [
    { "feature": "popover", "nativeFrom": { "chromium": 114, "firefox": 125, "safari": 17 } },
    { "feature": "anchor-positioning", "nativeFrom": { "chromium": 125, "firefox": 147, "safari": 26 },
      "fallbackUntil": { "chromium": 124, "firefox": 146, "safari": 25 } }
  ],
  "a11y": { "wcag": ["2.1.1", "2.4.3", "2.4.7", "2.4.11", "2.5.8", "4.1.2"],
            "liveRegions": [{ "id": "result-count", "politeness": "polite" }],
            "atAssertions": ["manual-speech-trigger-name", "manual-active-option"],
            "atSupport": [
              { "at": "voiceover", "platform": "macos", "browser": "safari",
                "test_status": "pending-real-test", "evidence": [] },
              { "at": "voiceover", "platform": "ios", "browser": "safari",
                "test_status": "pending-real-test", "evidence": [] },
              { "at": "nvda", "platform": "windows", "browser": "chrome",
                "test_status": "evidence-only", "evidence": ["at-support/select-only-combobox.json#nvda-chrome-apg-select-only"] },
              { "at": "jaws", "platform": "windows", "browser": "chrome",
                "test_status": "evidence-only", "evidence": ["at-support/select-only-combobox.json#jaws-chrome-a11ysupport-haspopup"] },
              { "at": "talkback", "platform": "android", "browser": "chrome",
                "test_status": "evidence-only", "evidence": ["at-support/select-only-combobox.json#talkback-chrome-apg2855"] }
            ] },
  "events": [{ "name": "openChange", "payload": "{ open: boolean }" },
             { "name": "valueChange", "payload": "{ value: string }" }],
  "props": [{ "name": "open", "type": "boolean" },
            { "name": "value", "type": "string" }], "slots": [],
  "fixtures": ["empty", "one", "many", "long-label", "disabled-item"],
  "budgets": { "gzipKiB": 8, "shared": ["overlay", "collection"] }
}
```

*Consumers.*
- **Core and adapters:** the reducer's allowed events and the finite-state table must equal the
contract's `actions` (a CI equivalence check); keyboard maps and ARIA attribute tables are generated
from the contract; the `kind` union type is generated from `kinds`.
- **Tests:** the shared semantic spec (ADR-013) is derived from `actions`, `keyboard`, `focus` and
`fixtures`. A fixture named `disabled` is the inert scenario (`INERT_FIXTURE`, a string match in the
spec derivation, not a schema field): its scenarios are derived with `interactive: false`.
- **Registry and MCP:** `registry.json`'s `components` array lists name, status, anatomy,
roles, keyboard map, kinds, support floor, per-AT `test_status` with evidence references, and doc links; the MCP server adds `get_component` and
`list_components` tools, and `lint_css` rules reference parts and data-attributes from contracts.
- **Lint:** the contract drives ESLint/stylelint rules (unknown `kind`, preset using internals, raw
values, missing label).
- **AT honesty gate:** the schema allows `tested-real` only with a `tested_on` date and an evidence log reference; `pending-real-test` is the only status that may carry `evidence: []` and no date, and is treated as evidence-only by this gate, and CI fails if docs, registry or MCP output label an `evidence-only` AT as tested or certified (ADR-015).
- **Fallback gating:** `support[].nativeFrom/fallbackUntil` determines which fallback code is bundled
per entry point and which forced-false capability runs exist in tests.

*Status meanings (G3A ruling (i), 2026-10-28).* `draft` = the contract may change. `beta` = contract and
getters are frozen, fixtures and parity are green, visual and assistive-technology lanes are pending.
`stable` = M5 certification (VoiceOver protocol, reviewed baselines, floor lane). The schema carries
only the enum; promotion is a reviewed edit of `status`.

*Schema freeze (G2 ruling, 2026-10-27).* `contract.schema.json` v1 enforces: `state.controllable` is a
subset of `props[].name`; every `actions[].emit` names an entry of `events[]`; `pattern.evidence` is
required. Any further schema change is a broadcast event needing a G-gate ruling.

**Consequences.** Schema design is up-front work and contract maintenance is release work. In
return the support claims, a11y claims and agent guidance become executable. A contract version bump
is a breaking-change signal. The `$schema` URL must be served by the site deploy (release gate).

**Sources.** [07 rec. 1](research/07-testing-certification.md#recommendations-for-architecturemd),
[07 §One shared semantic specification](research/07-testing-certification.md#one-shared-semantic-specification),
[03 rec. 2](research/03-a11y-engine.md#recommendations-for-architecturemd),
[01 rec. 9](research/01-platform-primitives.md#recommendations-for-architecturemd),
[04 rec. 1](research/04-mobile-input-ux.md#recommendations-for-architecturemd),
[06 §One placement policy](research/06-math-ml.md#one-placement-policy-for-css-and-fallback-geometry).

---

### ADR-011: Performance budgets and gates

**Context.** Research 05 separates measured wins from folklore and sets provisional absolute gates.
Research 02 sets provisional byte ceilings. The two interact with the mandatory fallbacks of ADR-001.

**Options considered.**
A. Byte budgets only. Bytes are not performance; compression hides parse cost.
B. Relative regressions only. Cannot catch an absolute defect.
C. Byte ceilings plus absolute p95 interaction gates plus a control/candidate protocol for changes.

**Decision.** Option C.

*Byte ceilings* (minified + gzip, per published artifact, revisable only by ADR; also record raw
minified bytes, import graph and fixture execution):

| Artifact | Ceiling |
|---|---|
| Snapshot/subscription utility | 1 KiB |
| Simple headless primitive core (excl. framework, styles, shared kernel modules) | 3 KiB per component |
| Complex combobox / calendar / grid engine | 8 KiB per component, optional submodules split |
| Overlay + geometry fallback (shared) | **4 KiB** |
| Collection + focus kernel (shared) | **3 KiB** |
| Live-region registry (shared) | **1 KiB** |
| Field-kinds resolver + number parser (shared) | **2 KiB** |
| Unused component in a fixture importing another | 0 KiB JavaScript |
| Framework adapters | reported separately; peer framework code never counted; adapter rows exclude `@ramoslabs/core` by construction (it is an external, unbundled dependency) (G1 ruling, 2026-10-27) |

All ceilings above are **provisional gates, revisable only by ADR**. Rationale for the shared
numbers (no measurement exists yet, so they are engineering limits): the overlay module holds the
placement parser, candidate evaluation, dismissal and nested stack, which is comparable in scope to
the 3 KiB "simple primitive" ceiling plus one fallback algorithm; the collection/focus kernel is a
primitive core plus typeahead and active-id bookkeeping; the live-region registry is a singleton
queue with dedupe, the smallest of the set; the kinds resolver is a table lookup plus a locale-aware
parser. **Derived consumer cost:** a one-component fixture caps at 3 + 1 + 4 = **8 KiB** for
`SJPopover`; 3 + 1 + 4 = 8 KiB for `SJTooltip`; and 8 + 1 + 4 + 3 = **16 KiB** for the custom
`SJSelect` listbox. `SJInput` caps at 3 + 1 + 2 = 6 KiB. **Revision measurement:** the first
prototype of each shared module is measured (minified+gzip, tree-shaken, pinned bundler); a ceiling
is changed only by an ADR that cites that measurement, and no ceiling may rise more than 50% in one
ADR without a design review of what was added.

*Conflict resolved:* 02's 3 KiB cannot hold a popover-family component with the geometry fallback
inside it. Decision: shared kernel modules are separate artifacts with their own ceilings, and the
one-component fixture fails against the derived totals above, so consumers see the real cost.

*Interaction gates* (provisional p95, 30+ iterations after warm-up, reference targets Moto G Power 5G
(2024) and iPhone 15. Under the current lab (ADR-015) the Android row is `not run` and labelled so; the iPhone row is the owner's device as recorded in the manifest; the named devices remain the reference targets for when hardware exists. Exact device, OS, browser, power and CPU/network conditions recorded; revisable
only by ADR):

| Scenario | Gate |
|---|---|
| One roving-focus step, keydown to painted active item | <= 50 ms |
| Overlay open (incl. native `showModal()`/`showPopover()` and dependent focus) | <= 100 ms |
| Editable combobox filter at 1,000 items: key echo + painted results + count announcement | <= 50 ms |
| 1,000 mount/destroy cycles | 0 retained stores, listeners, observers, items |
| Fixed-size virtual scroll at 10,000 rows | no engine-attributable long task > 50 ms |

*Rules.*
- Plain DOM below **250 fixed-size rows**; fixed-size virtualization above (provisional, retained only
if comparison at 100/250/500/1,000 rows shows material benefit without accessibility regression).
Variable-size virtualization is opt-in until certified. `content-visibility` for independent
sections only; find-in-page and AT checks per engine (Safari 18-25 is partial).
- Pointer Events with declared `touch-action`; passive non-canceling listeners; direct listeners,
delegation only after benchmarks.
- Intersection/ResizeObserver over polling; disconnect aggressively; never mutate observed geometry
unguarded.
- Filtering above a measured threshold chunks work: paint key echo first, yield via
`scheduler.yield()` (Chromium 129 / Firefox 142), else `setTimeout(0)`/`MessageChannel`; coalesce
stale query versions; never delay echo, active feedback or correctness behind an older chunk.
- Stable record shapes and cached derived structures as hygiene; **no JIT-driven rewrites without
traces**.
- Evidence sources per engine: LoAF is Chromium-only; Event Timing where implemented; Firefox
Profiler and Safari Timelines for others. Never present Chromium LoAF as a three-engine result.
- Candidate changes to hot paths run the control/candidate protocol (tail latency, rendering stages,
heap, physical devices).

**Consequences.** Slower certification; no "optimization" ships from folklore or a desktop average.
Two list strategies must be tested.

**Sources.** [05 §Provisional laboratory ceilings](research/05-performance.md#provisional-laboratory-ceilings),
[05 §Cross-engine measurement and yielding](research/05-performance.md#cross-engine-measurement-and-yielding),
[05 recs. 2-7](research/05-performance.md#recommendations-for-architecturemd),
[05 §Benchmark and certification protocol](research/05-performance.md#benchmark-and-certification-protocol),
[02 §Tree-shaking and bundle budget](research/02-headless-engine.md#tree-shaking-and-bundle-budget).

---

### ADR-012: Where math and ML are allowed

**Context.** Positioning, ranking, virtualization and prefetch all admit "smart" implementations.
Accessibility needs identical results for identical inputs.

**Options considered.**
A. Ship ML-assisted ranking, prediction and kind inference.
B. Deterministic math only in the core; ML excluded; heuristics at application level.

**Decision.** Option B.

*Allowed in `@ramoslabs/core` (deterministic, no learned weights):*
- **Placement geometry** driven by the contract's CSS vocabulary (ADR-005).
- **Lexical search ranking:** normalized scores, ties broken by input order, `Intl.Segmenter`
word-prefix indexing built once at index time (never per keystroke), versioned multilingual fixtures.
- **Prefix typeahead:** a separate algorithm from fuzzy ranking; never reuse the ranker for keyboard
typeahead.
- **Virtualization math:** fixed-size formulas; variable-size prefix-sum offsets with binary search;
exactly one scroll-anchoring owner (native `overflow-anchor` where present, else `overflow-anchor: none`
before manual correction).
- **Civil-date arithmetic:** owned Gregorian arithmetic anchored at UTC noon; Temporal as enhancement
only; no non-Gregorian presets and no zoned date-time until implemented and tested.

*Excluded:* ML typeahead, learned row heights, runtime kind inference, base-engine neural/semantic
search, and any model or inference runtime. Revisit only through an ADR with baseline evaluation,
exact artifact sizes, licence/provenance, privacy review, deterministic fallback and accessibility
results.

*Application-level only:* predictive prefetch. Components emit navigation and remote-option
`prefetch` intent (focus or deliberate hover on a remote combobox); the app decides, dedupes and
cancels. Speculation Rules is Chromium-led progressive enhancement, never a floor feature.

*Determinism requirements* (identical across frameworks and repeated runs for the same inputs):
active descendant/roving focus and selection; typeahead next match and wrap; placement candidate;
Home/End and virtual range offsets; result counts and live-region messages; controlled-state
transitions and fallback rules. A ranker must not reorder while the user traverses unless the
query/results changed; active item identity is preserved across score updates.

**Consequences.** No fashionable semantic search; synonyms are an app concern. Two small
algorithms instead of one "smart" service.

**Sources.** [06 §What must remain deterministic](research/06-math-ml.md#what-must-remain-deterministic-for-accessibility),
[06 §Hype and bundle-weight register](research/06-math-ml.md#hype-and-bundle-weight-register),
[06 recs. 1-7](research/06-math-ml.md#recommendations-for-architecturemd),
[05 §Virtualization](research/05-performance.md#virtualization).

---

### ADR-013: Testing and certification pipeline

**Context.** Parity across three frameworks and three engines needs one spec. Automation cannot
certify real AT output, and axe covers one WCAG 2.2 rule.

**Options considered.**
A. Per-adapter test suites. Drift.
B. One shared semantic spec driving every layer, plus manual AT protocol and a real-floor lane.
C. Automation-only certification. Rejected: it cannot assert actual speech or old-OS behavior.

**Decision.** Option B. Six layers, one spec:
1. **Unit/invariant:** reducer tests consume spec actions directly; model-based fast-check
(test-only, MIT) generates random action sequences with adversarial cases (disabled/removed items,
controlled rejection, duplicate registration, stale effect versions) and checks invariants.
2. **Interaction:** Playwright on Chromium, Firefox, WebKit, per adapter, executing the same
semantic actions. Assertions are on public behavior and relationships (focus target, IDREF
validity), not private implementation or byte-identical DOM. A text-safety test passes markup-like
consumer strings through labels, hints, errors and option text on every adapter and asserts they
render as text (no element injection). Shared `toMatchAriaSnapshot()` YAML per
state; CDP `Accessibility.getFullAXTree` additionally on Chromium. IME composition automated through
CDP `Input.imeSetComposition`/`insertText` on Chromium; physical Gboard and iOS CJK keyboards for
Firefox/WebKit.
3. **Automated accessibility:** axe in every affected state with zero untriaged violations; `target-size`
enabled explicitly. WCAG 2.2 named gates:

| Criterion | Gate |
|---|---|
| 2.4.11 Focus Not Obscured | PR: focused-rect vs sticky/fixed/top-layer intersection non-zero, incl. keyboard-open and overlays |
| 2.4.13 Focus Appearance (AAA, adopted as internal floor) | PR: computed indicator area >= 2 CSS px perimeter, >= 3:1 change contrast |
| 2.5.7 Dragging Movements | PR: every drag fixture performs same action via single-pointer alternative |
| 2.5.8 Target Size | PR: axe `target-size` + measured bounds >= 24 CSS px or exact documented exception |
| 3.3.7 Redundant Entry | Release (PR if changed): form presets retain/offer prior values |
| 3.3.8 Accessible Authentication | Release (PR if changed): OTP/auth presets pass without cognitive test; paste, manager and one-time-code work |
| 3.2.6 Consistent Help | Release: help/contact order consistent across preset views |

4. **Real-AT manual protocol (VoiceOver only, for now):** run on the release candidate on
**VoiceOver + Safari on macOS** and **VoiceOver + Safari on a physical iPhone**; each component run
records environment, initial announcement, every key/gesture, expected vs actual speech, focus
before/after, reading order, state changes, and pass/fail. NVDA, JAWS and TalkBack are **not**
hands-on tested: they are covered by the evidence registry (ADR-015) with `test_status:
evidence-only`, checked by the evidence gate below. Optional later lane: NVDA is free and the owner
has a Windows PC, so NVDA real testing can be added and upgrades the affected entries to
`tested-real`. Guidepup (MIT, test-only) may drive NVDA and VoiceOver as a regression net only; a
Guidepup run alone never upgrades `test_status`.
4b. **Evidence gate:** every pattern a component uses must have an up-to-date registry file with an
entry for each **primary pair** (NVDA, JAWS, VoiceOver macOS, VoiceOver iOS, TalkBack; secondary pairs
are optional); `next_review` older than today fails CI; an entry's structured `constraints`
(`focusStrategy`, `listboxMount`, `nativeOnTouch`, `mustNot`) conflicting with the component's
`focus.strategy` or `overlay.listboxMount` fails CI (ADR-015).
5. **Visual regression:** hermetic; production fonts, `font-display: block`; baselines per
`engine x platform x DPR`; mandatory human review; no "update all".
6. **Cross-framework parity matrix:** rows `component / scenario / action / browser / adapter / path`,
where `path` is `native` or the named fallback. Engine feature detection is an injected `supports`
map, so each fallback-bearing component runs once with real detection and once per capability forced
false, on every adapter.

*Real floor lane.* The same interaction suite runs on actual Chromium 114 and Firefox 125 (desktop
builds, automatable) per release and on every change to a fallback-bearing component. Physical iOS
17 and the Android floor are **not available** under the owner decision: their rows are reported as
`not run` in the manifest, the iOS 17 / Android floor paths are verified only through forced-false
capability runs (path parity) and evidence, and the documentation does not claim hands-on iOS 17 or
Android-floor verification. If the owner's iPhone runs iOS 17, that device covers the iOS row.
Emulation and a patched current WebKit are not substitutes.

*Gates.* Every PR: unit/invariant, adapter x engine interaction for affected components, axe, ID/focus/
keyboard assertions, deterministic visual diffs reviewed, bundle/tree-shaking budgets (ADR-011),
SSR/hydration checks comparing full IDREF relationships, contract schema validation and
`registry.json` regeneration, build-time contrast, no skipped test without issue and owner. Every
release: VoiceOver (macOS and iPhone) protocol on the RC, the evidence gate for NVDA/JAWS/TalkBack, physical iPhone input/keyboard scenarios, stable branded
browsers, parity report, control/candidate performance runs for changed hot paths, licence/provenance
check confirming no behavioral runtime dependency, updated contracts and dated AT evidence.
Flaky tests are failures; retries diagnose but never certify.

*Evidence manifest* per release: spec version, source revision, tool versions, environment matrix,
case totals (executed/passed/failed/not-applicable with reasons), axe scope, visual baseline
revision, AT result log with per-AT `test_status`, the evidence-registry snapshot, known upstream issues, performance traces, BCD dataset version, signer and
date. It is an internal reproducible record, not an external WCAG certification.

*Closed list of `supports` keys* (G1 ruling, 2026-10-27). The injected `SupportsMap` has exactly these ten keys:
`popover`, `userInvalid`, `anchorPositioning`, `dialogRequestClose`, `invokerCommands`,
`detailsName`, `viewTransitions`, `weekInfo`, `schedulerYield`, `focusVisible`. A key is added only
when a component first branches on it, never ad hoc. Three detections named elsewhere are
**deferred** and have no key yet: `closedby` (ADR-005 step 7), `popover="hint"` and `interestfor`
(ADR-005 step 1). `anchorPositioning` is true only when every anchor property the contracts emit
(`anchor-name`, `position-area`, `position-try-fallbacks`, `position-try-order`,
`position-visibility`) passes `CSS.supports`, because the per-property floors differ; Chromium
125-128 and Firefox 147 therefore take the fallback.

**Consequences.** Expensive matrix and manual release time (licences, devices). No "ship now, certify
later".

**Sources.** [07 rec. 1-6](research/07-testing-certification.md#recommendations-for-architecturemd),
[07 §Layers 1-6](research/07-testing-certification.md#layer-1--unit-and-propertyinvariant-tests),
[07 §Release certification gates](research/07-testing-certification.md#release-certification-gates),
[07 §Revision 1](research/07-testing-certification.md#revision-1-floor-lanes-and-explicit-wcag-22-gates),
[03 §Required AT test matrix](research/03-a11y-engine.md#required-at-test-matrix),
[03 rec. 7-8](research/03-a11y-engine.md#recommendations-for-architecturemd).

---

### ADR-014: Forms, validation and form participation

**Context.** Field kinds (ADR-007), native validation, error identification and custom controls must
combine without losing native submission. Brief concept: layered Field -> BaseInput -> concrete input.

**Options considered.**
A. Reimplement validation in JavaScript.
B. Native constraint validation and `:user-invalid` for timing; error text, relationships and
submission in the field contract.
C. FACE for every custom control in every adapter.

**Decision.** Option B, with FACE scoped.
- **Layers:** `SJField` (label, hint, error with linked ids `-label`/`-hint`/`-error`; `aria-describedby`
and `aria-invalid` derived; `aria-errormessage` only where it is supported and tested) wraps a
`BaseInput` anatomy (prefix, leading, input, trailing, postfix parts) wrapping concrete inputs. The
form owner (`SJForm` context) supplies `enterkeyhint` position and tracks entered values for 3.3.7.
- `:user-invalid` styles error timing natively; Chromium 114-118 uses a small touched-state fallback.
- FACE/`ElementInternals` (via `attachInternals()`, custom elements in light DOM with no shadow root, ADR-002) **only in the vanilla custom-element adapter** where a custom control needs
native form participation; React and Vue render a real hidden/native input or the native control
itself; the core never depends on custom elements.
- Errors are announced through the shared live-region registry when appropriate; validation messages
are visible text, linked, and not color-only.

**Consequences.** One additional adapter lifecycle (custom element callbacks) and a small fallback.
Native APIs alone do not satisfy accessible error identification, so the contract carries the
relationships.

**Sources.** [01 recs. 6-7](research/01-platform-primitives.md#recommendations-for-architecturemd),
[01 §ElementInternals, FACE, and validation](research/01-platform-primitives.md#elementinternals-face-and-validation),
[04 rec. 1](research/04-mobile-input-ux.md#recommendations-for-architecturemd),
[03 §Live regions](research/03-a11y-engine.md#live-regions).

---

### ADR-015: Evidence-based assistive-technology support

**Context.** The architecture targets VoiceOver (macOS, iOS), NVDA, JAWS and TalkBack (research 03),
but the owner can hands-on test only VoiceOver for now (owner decision 2026-10-27: VoiceOver on
macOS and iPhone, a Windows PC, no JAWS licence). Without a rule, support for the other ATs would be
either unverified guesswork or silently claimed as tested. Research 03 already requires dated
issue records and forbids unmeasured browser-specific workarounds ([03 rec. 8](research/03-a11y-engine.md#recommendations-for-architecturemd)).

**Options considered.**
A. Claim support for all ATs and test none. Dishonest.
B. Support only VoiceOver. Contradicts the 2026 usage data (JAWS/NVDA lead desktop, TalkBack
substantial, [03 §Required AT test matrix](research/03-a11y-engine.md#required-at-test-matrix)).
C. Evidence-based support: design from documented evidence for untested ATs, label them
`evidence-only`, test VoiceOver for real, and upgrade evidence entries to `tested-real` as lanes appear.

**Decision.** Option C.

*Evidence registry.* One file per APG pattern at
`docs/architecture/evidence/at-support/<pattern>.json`. The **twelve patterns** are: `button`,
`checkbox`, `dialog-modal`, `disclosure`, `live-region`, `popover-nonmodal`, `radio-group`,
`select-only-combobox`, `switch`, `tabs`, `text-field`, `tooltip` (wave 2 adds files such as
`combobox-editable`, `listbox`, `menu-button` by the same schema). Each file is an object
`{ pattern, recommended, entries[] }`:

- `recommended` is the pattern-level block: `variant` (the variant the library ships),
  `constraints` (structured, below), `supportedBy` (entry ids), and `atEvidence`, a per-AT map of
  entry ids or the explicit value `no-measured-evidence`, rendered in docs as "no measured evidence;
  implemented to the contract".
- `entries[]` use the field table:

| Field | Meaning |
|---|---|
| `id` | Unique within the file, `<at>-<browser>-<source>` (for example `nvda-chrome-apg`, `talkback-chrome-apg2855`, `vo-ios-safari-webkit289338`); contracts reference `file#id` |
| `kind` | `contract` (what APG, HTML or WAI-ARIA require; no observed behavior) or `observation` (a measured or reported behavior) |
| `pattern` | APG pattern id and variant |
| `at`, `at_version` | NVDA, JAWS, VoiceOver, TalkBack, Narrator and exact version (`null` when the source gives none) |
| `browser`, `browser_version`, `platform` | Pairing the behavior applies to (`browser_version` may be `null`) |
| `behavior` | Observable behavior in one or two sentences |
| `impact` | **Required for `observation`, absent for `contract`.** `blocker` (task cannot be completed by observation), `degraded`, `cosmetic` or `none` |
| `source_url`, `source_date`, `retrieved` | Primary link, the source's own date, and our retrieval date |
| `source_tier` | `T1`, `T2` or `T3` (below) |
| `decision` | Prose rationale for the design rule adopted because of this entry |
| `constraints` | Computable form of the decision, in contract vocabulary: `{ focusStrategy?, listboxMount?, nativeOnTouch?, domAdjacent?: boolean, mustNot?: string[] }`. `focusStrategy` takes exactly the ADR-006 values `roving | activedescendant | native | native-roving`; omit the key where no focus strategy applies (live regions). For example `{ listboxMount: { coarse: "inline" }, domAdjacent: true }`; the CI conflict check reads this, never `decision` |
| `test_status` | `tested-real` (with `tested_on` and a log reference), `evidence-only`, or `pending-real-test` (in the real-test lane, not yet logged; treated as evidence-only by the honesty gate) |
| `next_review` | Date, at most 6 months after `retrieved` |

A JSON Schema validates the files; contracts reference entries by `file#id` (ADR-010).

*Source tiers.*
- **T1:** vendor documentation and issue trackers (NV Access, Freedom Scientific, Apple/WebKit,
  Google/Chromium), WAI-ARIA APG and its AT support tables (explicitly **ARIA-AT**, the W3C measured
  test reports, with the report phase noted), and specifications.
- **T2:** published cross-AT test data from established accessibility organizations, **such as**
  a11ysupport.io, PowerMapper screen-reader compatibility, TPGi, Deque, and measured consultancy
  tests (for example TetraLogical's live-region tests, measured across NVDA, JAWS, Narrator, Orca,
  VoiceOver and TalkBack); WebAIM's screen reader survey for usage
  weighting only, not for behavior).
- **T3:** practitioner write-ups and blog posts.

*Rules of evidence.* **The unit is the pattern's `recommended` variant, not an individual entry.**
`contract` entries (APG, HTML, WAI-ARIA, all T1) establish the variant's requirements and count
toward the rule for the variant. A variant is adopted when its `supportedBy` contains at least one
T1 source or at least two independent T2 sources. A **per-AT support claim** for an `evidence-only`
AT (NVDA, JAWS, TalkBack) additionally requires at least one `observation` entry for that AT (a T1
tracker or ARIA-AT report, or T2 data) or the explicit value `no-measured-evidence`; a contract
page alone is never presented as evidence of AT support. T3 never decides alone; it may only motivate a test. Independent means different
organizations that did not derive their results from one another. Conflicting evidence is resolved
toward the more conservative pattern (the one with fewer reported failures and fewer ARIA
dependencies), and the conflict is recorded in the entry.

*Selection rule ("most recommendable").* For each pattern the library ships the variant with the
widest documented support across VoiceOver macOS/iOS, NVDA, JAWS and TalkBack. Ties are broken in
order: native element over simpler ARIA over fewer live-region dependencies. **A variant with a
documented `blocker` (an `observation` entry; `contract` entries have no impact) on an AT/platform is never
shipped on the platforms where that blocker is documented if an alternative exists** (so the
TalkBack/iOS listbox blockers constrain touch-capable devices, while the desktop custom listbox
remains shippable). If none exists, the component ships behind an explicit documented limitation and the contract records the
blocker. Worked example: ADR-005 step 8 (inline listbox on touch-capable devices) and ADR-008
(native `<select>` on touch) are exactly this rule applied to the VoiceOver iOS and TalkBack
select-only evidence.

*Honesty.* Contracts, docs, `registry.json` and MCP output expose `test_status` per AT and platform.
`evidence-only` ATs are never labelled "tested", "verified" or "certified"; the permitted wording is
"implemented to documented evidence, not hands-on tested". CI scans generated docs and registry
output for the forbidden labels on evidence-only entries.

*Certification meaning for wave 1.* A wave-1 component is certified when it is `tested-real` on
**VoiceOver + Safari (macOS)** and **VoiceOver + Safari (iOS)** and **evidence-conformant** for NVDA,
JAWS and TalkBack, meaning its design follows the registry decisions and the evidence gate passes.
The evidence manifest states this split explicitly and is not a claim of tested support for the
evidence-only ATs.

*Staleness.* `next_review` is at most 6 months after `retrieved`; CI fails if any entry used by a
shipping component is past `next_review`. A re-review re-fetches the source, records the new
`retrieved` date and either confirms or revises `decision`. NVDA real testing on the owner's Windows
PC is an optional later lane (NVDA is free): when run, it upgrades the matching entries to
`tested-real` with a `tested_on` date and a session log. JAWS and TalkBack remain `evidence-only`
until a licence or device exists.

**Consequences.**
- Support claims for three of four ATs rest on documents, not on our own observation; real
  regressions there can ship undetected until reported. Mitigation: conservative-conflict rule,
  blocker-avoidance rule, a visible issue channel, and the optional NVDA lane.
- The registry is maintenance work (six-month reviews), but it makes every AT-driven design choice
  traceable and reviewable.
- Users and agents see exactly what is tested, which is a product feature of an accessibility-first
  library.

**Sources.** [03 rec. 7-8](research/03-a11y-engine.md#recommendations-for-architecturemd),
[03 §Known AT x browser evidence](research/03-a11y-engine.md#known-at--browser-evidence-facts-not-folklore),
[03 §Required AT test matrix](research/03-a11y-engine.md#required-at-test-matrix),
[07 rec. 4](research/07-testing-certification.md#recommendations-for-architecturemd),
owner decision D2 (2026-10-27), [AUDIT-combined-R1](audits/AUDIT-combined-R1.md) A-MUST-1 to A-MUST-4.

---

## 4. First component wave (proposal only)

Eleven components, chosen so that **each kernel capability is exercised by at least one component
before harder ones depend on it**, and every kind/native decision is tested on real surfaces.

| # | Component | Why in wave 1 | Kernel capability proven |
|---|---|---|---|
| 1 | `SJButton` (+ icon button, link variant) | Smallest surface; sets `variant x tone x size`, focus ring, 44 px target, disabled semantics | Styling layer, contrast gate, target-size gate |
| 2 | `SJField` + `SJInput` (kinds) | The product's core promise (intent fields); highest value for mobile UX | Field kinds, ids/IDREFs, form-owner `enterkeyhint`, live-region errors |
| 3 | `SJSwitch` and `SJCheckbox` | Native-input-based; tests the "native wins" rule with custom visuals | Native-first, form participation |
| 4 | `SJRadioGroup` | First roving-focus composite; simple APG contract | Roving focus, collection registration, RTL |
| 5 | `SJTabs` | Roving focus plus automatic/manual activation; keyboard defect in the brief | Collection, deterministic successor, keyboard map generation |
| 6 | `SJDisclosure` (accordion) | Native `<details>` path plus enhancement; smallest overlay-free state machine. Exclusive groups use `<details name>` (Chromium 120 / Firefox 130 / Safari 17.2) with an owned exclusive-open fallback below those versions | Native-first ladder, reduced motion |
| 7 | `SJDialog` | Modal `showModal()`, focus return, close tiers; defect named in brief | Dialog path, opener stack, close-request tiers, `inert` |
| 8 | `SJPopover` | Non-modal top layer, anchor positioning and geometry fallback | Placement contract, geometry parity, Escape/nesting order |
| 9 | `SJTooltip` | Fixes the hover-only defect; manual popover stack | Focus/hover/Escape rules, touch policy, nested `hint` rules |
| 10 | `SJSelect` (native preset + custom listbox compound) | Highest-risk composite; forces ADR-005 step 8 and ADR-008 into real use | Active-descendant, typeahead, IME, `listboxMount`, native-on-touch equivalence |
| 11 | `SJState` (empty/loading/error) | Three kinds of empty state from the brief; first live-region consumer; shared across data views | Live-region registry, messaging conventions |

Deferred to wave 2: `SJCombobox` (needs SJSelect's AT evidence and ranking), `SJMenu`, `SJToast`,
`SJPagination`, `SJCommandPalette`. Wave 3: `SJCalendar`/date picker (engine + presets, custom only
with capability statement), `SJDataTable`, virtualized list, side navigation. Order is justified by
dependency on kernel parts and by AT risk; it is revisited after wave-1 AT evidence.

---

## 5. Open questions and risks

### 5.1 Open questions

| # | Question | Owner / resolution path |
|---|---|---|
| Q1 | Measured sizes of reference libraries (informational; no decision depends on it) | Wave-1 evidence task, recorded in `evidence/`; may revise ADR-011 only via ADR |
| Q2 | Are the provisional shared-kernel ceilings of ADR-011 right? | First prototype measurement; ADR-gated revision (no longer blocking) |
| Q3 | Is `maximum-scale`/zoom handling plus 16 px control text enough to avoid iOS focus zoom on all kinds? | Physical-device matrix (ADR-007) |
| Q4 | Do iOS/TalkBack AT results justify flipping `listboxMount` for any pointer class? | VoiceOver real tests plus registry evidence in wave 1 (SJSelect); ADR amendment |
| Q5 | Week-start data on Chromium 114-129 and Firefox 125-152 (no `getWeekInfo`): explicit prop only, or a generated CLDR-derived table (data licence, size)? | Decide in wave 3, before the calendar |
| Q6 | (closed) Vue peer `>=3.5.0` is decided in ADR-002; the scaffold is unpublished and its devDependency is already `^3.5.0` | - |
| Q7 | Do we publish a Svelte/Angular adapter spike to validate the store-bridge claim before certification? | Optional timeboxed spike after wave 1 |
| Q8 | Customizable `<select>` (`base-select`) as enhancement: when to enable, given Firefox is behind a flag | Post-wave 1; contract flag stays off on the floor |

### 5.2 Risks

1. **Fallback matrix size.** Native x fallback x three adapters x three engines x floor lane is
costly. Mitigation: forced-false capability testing for breadth, real floor lane only per release and
on fallback changes.
2. **AT evidence ages quickly.** Tracker-based claims (WebKit, APG, NVDA) change. Mitigation: dated
log, retest on every RC, no permanent compatibility claims. Research 03's tracker dates carry
required corrections (AUDIT-R2 "Required corrections before synthesis"); this document relies only on
WebKit 289338 and APG 2855 with the softened wording, and does not cite the corrected-pending items
(WebKit 284804, 185679, 278370, a11ysupport.io).
3. **Provisional numbers.** Byte and p95 ceilings are engineering limits without current measurements.
Mitigation: ADR-gated revision, first prototype measures and sets them.
4. **Floor drift.** Baseline-2026 rises monthly; keeping Safari 17 costs fallback weight. Mitigation:
per-release floor review with installed-base data.
5. **Untested ATs.** NVDA, JAWS and TalkBack are `evidence-only` and iOS 17 / Android-floor devices are unavailable, so regressions there can ship undetected. Mitigation: ADR-015 rules (blocker avoidance, conservative conflicts, six-month staleness gate), forced-false path parity, and the optional NVDA lane on the owner's Windows PC. If a VoiceOver test device runs an OS newer than iOS 17, pin its version and record it.
6. **Contract-first friction.** Schema design delays the first component. Mitigation: build the
Button and Switch contracts first to shake out the schema before composite contracts.
7. **Native-on-touch fragments visual identity.** Equivalence tests protect behavior, not looks;
design acceptance of platform pickers is required.
8. **Third-party reference licences.** Concepts only, but any inadvertent code similarity is a
provenance risk. Mitigation: clean-room notes in the evidence folder and a licence/provenance gate
in release (ADR-013), which also requires pinned, lockfile-verified devDependencies.
9. **Consumer resets beat `sj.*` layers.** Unlayered CSS always wins over any layer, so a Tailwind v3 preflight or other unlayered reset overrides component styles. Consumers must place resets in a layer declared before `sj.*` (Tailwind v4 already layers); the required `@layer` declaration order is documented in `@ramoslabs/css`.
10. **Injection surface in the vanilla adapter.** Consumer strings are rendered by library code; mitigated by the text-nodes-only rule (ADR-002) and the layer-2 text-safety test (ADR-013).
11. **Tokens gaps.** Required new tokens (touch target, focus ring, overlay caps, control text minimum)
must land in `packages/tokens` before styling work; otherwise raw values will tempt contributors.

---

## Decisions needed from owner

None of the five audit MUSTs required a product decision; all were resolved technically. Two
product-level choices underpin the architecture; both are resolved:

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Browser floor (ADR-001) | A: keep Chromium 114 / Firefox 125 / Safari-iOS 17 and carry the geometry and close fallbacks. B: raise to Safari-iOS 26 / Chromium 125 / Firefox 147, dropping fallbacks, excluding about two iOS generations | **Resolved 2026-10-27: A** (owner delegated the call to the orchestrator; keep the floor). Revisit per major release with installed-base data |
| D2 | AT testing lane (ADR-013, ADR-015) | **Resolved 2026-10-27 by owner:** real testing on VoiceOver only (macOS + iPhone); NVDA, JAWS and TalkBack implemented from documented evidence (`evidence-only`), never labelled tested; optional later NVDA lane on the owner's Windows PC; no JAWS licence, no physical Android or iOS 17 floor devices | Adopted as ADR-015. Re-open if a licence, device or hosted service becomes available |

---

STATUS: CERTIFIED (ds-fable, audits/AUDIT-combined-R2.md, 2026-10-27)
