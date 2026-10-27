# 05 — Performance against the engine

**Research date:** 2026-10-27. No implementation exists to benchmark yet, so this document makes **no measured performance claim about the library**. “Measured” below refers to the cited authors’ specific fixtures, not an expected universal result. Architecture decisions should avoid work by design and require comparative traces before accepting optimization complexity.

## Rendering model: optimize the actual stage

The browser’s visual pipeline is JavaScript → style calculation → layout → paint → composite. Geometry changes normally require layout and paint; paint-only properties skip layout; some changes can reach composite without new layout/paint ([web.dev rendering performance, retrieved 2026-10-27](https://web.dev/articles/rendering-performance)). For UI engines this yields three concrete rules:

- Collection updates should reduce DOM/style/layout work, not merely reducer execution time.
- Motion should normally animate `transform` and `opacity` rather than dimensions/offsets, with DevTools confirming the actual path ([web.dev animation guide, updated 2020-10-06](https://web.dev/articles/animations-guide)).
- JavaScript micro-optimization cannot compensate for an interaction that repeatedly invalidates a large DOM subtree.

The often-quoted 16.7 ms frame interval belongs to 60 Hz, not every display. web.dev notes that a 60 Hz animation has roughly 16.7 ms per frame and recommends about 10 ms for application work after browser overhead; high-refresh devices have less time. INP’s “good” threshold is 200 ms or lower at the 75th percentile for page interactions, not a 16.7 ms target for every discrete click ([web.dev INP, retrieved 2026-10-27](https://web.dev/articles/inp); [web.dev rendering performance, retrieved 2026-10-27](https://web.dev/articles/rendering-performance)).

## Layout thrashing: real mechanism, measurable fix

Reading layout after mutating styles can force synchronous layout; alternating reads/writes in a loop can force it repeatedly. web.dev’s guidance is to batch reads before writes and inspect Forced Reflow/LoAF attribution ([web.dev layout thrashing, updated 2025-05-07](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)). The Long Animation Frames API defines a long rendering update as beyond 50 ms and provides script/timing attribution ([MDN LoAF timing, updated 2026-03-27](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing); [W3C LoAF draft, retrieved 2026-10-27](https://w3c.github.io/long-animation-frames/)).

The engine should use a per-overlay/frame scheduler:

1. collect required rectangles and computed inputs together;
2. calculate placement/state without DOM writes;
3. commit attributes/styles together;
4. never read geometry again after a write in the same phase unless a new, documented measurement is unavoidable.

`requestAnimationFrame` schedules work but does not make layout or JavaScript cheap. A trace showing style/layout duration and forced-reflow stacks is the acceptance evidence.

## Listeners and delegation

A passive listener promises not to cancel the event, allowing the browser to scroll without waiting for the handler; calling `preventDefault()` in one is ineffective ([Chrome passive listeners, updated 2016-06-05](https://developer.chrome.com/blog/passive-event-listeners); [MDN `addEventListener`, updated 2026-09-30](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)). Use `passive: true` for non-canceling `touchstart`, `touchmove`, `wheel`, and scroll-observation listeners. Drag/keyboard code that must cancel an event requires an active listener and should be scoped to the smallest possible element/gesture.

Event delegation is a DOM propagation model, not an automatic speedup. It can reduce listener setup/retention for large dynamic collections, but every event still needs target resolution and the root handler executes for descendants. Direct listeners can be clearer and cheaper for a small fixed component. Framework adapters may already delegate/synthesize events, so adding a second delegated layer has no principled claim of benefit. Compare listener counts, heap, mount time, and event-processing duration before choosing delegation for a hot collection.

Other folklore to reject:

- “Passive makes every event faster” — it addresses cancellation/scroll blocking, not arbitrary handler cost.
- “Debounce improves responsiveness” — it reduces call frequency while intentionally delaying work; input, focus, and active-option feedback must not wait behind a trailing debounce.
- “rAF is free throttling” — expensive callbacks still block rendering.

## Observers

`IntersectionObserver` asynchronously reports intersection changes and can replace repeated visibility polling ([MDN Intersection Observer API, updated 2026-09-02](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)). Use it for lazy activation/prefetch and visibility-aware work, not exact per-frame overlay positioning; asynchronous delivery and thresholds are not a geometry stream.

`ResizeObserver` reports element size changes, but changing observed layout in its callback can create loops; browsers may report “loop completed with undelivered notifications,” which does not stop the underlying infinite loop ([MDN ResizeObserver, updated 2025-11-07](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)). Keep callbacks small, compare before writing, and schedule layout-mutating follow-up through the frame scheduler.

Observers still have registration, callback, and retained-object costs. Scope roots/targets, share an observer where semantics match, disconnect on destroy, and do not add a MutationObserver around an entire component tree when explicit item registration can report the same change.

## `content-visibility`: measured example, not a universal multiplier

`content-visibility: auto` lets browsers skip style/layout/paint for irrelevant offscreen subtrees while keeping their DOM available; `contain-intrinsic-size` reserves estimated geometry and can remember the last rendered size with `auto` ([web.dev `content-visibility`, published 2020-08-05](https://web.dev/articles/content-visibility)). In the article’s travel-blog fixture, initial rendering fell from 232 ms to 30 ms (about 7×). That is a **measured demo result**, not a promise for components, grids, or all pages.

Use it for large independent document sections and inactive views after profiling. It is not a drop-in replacement for list virtualization: DOM nodes and component state still exist. Size containment can affect intrinsic layout/scrollbar estimates, and skipped rendering must not hide focused/selected content. The cited guide notes that offscreen content remains in the accessibility tree; authors must ensure hidden landmarks are not accidentally exposed by unrendered styles. Verify current AT behavior rather than treating that statement as certification.

## Virtualization

Virtualization reduces mounted DOM/state by rendering only visible items plus overscan. This can help genuinely large collections because layout cost generally grows with DOM size ([web.dev layout guide, updated 2025-05-07](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)). It also introduces complexity that small lists do not need:

- unmounted items disappear from browser find, accessibility navigation, selection, and direct measurement;
- active/focused items must remain mounted and preserve stable IDs;
- APG requires correct `aria-setsize`/`aria-posinset` when dynamic loading means not all options are in the DOM ([APG listbox, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/));
- variable heights require estimates, post-render measurement, scroll-anchor correction, and RTL/writing-mode tests;
- keyboard Home/End and typeahead must operate on the data collection, not only mounted nodes;
- recycling must not retain stale listeners, accessible descriptions, or framework component state.

Start with plain rendering and `content-visibility` where appropriate. Enable virtualization from a measured threshold/profile, not a magic item count. Fixed-size virtualization should be a separate simple path from variable-size measurement. Overscan is a memory/latency trade-off, not “larger is smoother” by definition.

## V8: useful internals versus performance folklore

### Hidden classes and monomorphism

V8 tracks object shapes with hidden classes and uses them for optimized property access/inline caches; same properties added in the same order share a shape, while shape churn can inhibit optimization ([V8 fast properties, published 2017-08-30](https://v8.dev/blog/fast-properties)). This mechanism is real. “Always make every UI object monomorphic” is not a measured architecture rule.

Reasonable hygiene is to construct snapshot/item records in one consistent shape and avoid adding/deleting arbitrary fields in hot loops. Do not replace immutable transitions, Maps, or readable records with classes/object pools solely on the expectation of a JIT win. SpiderMonkey and JavaScriptCore have different internals, and DOM/rendering often dominates. Accept a monomorphism rewrite only when a cross-browser profile identifies that hot property-access site and the rewrite improves the interaction.

### Allocation and garbage collection

V8’s generational GC is optimized around many short-lived objects dying young; its own GC guide says short-lived objects are relatively cheap and surviving objects drive copying costs ([V8 “Trash talk”, published 2019-01-03](https://v8.dev/blog/trash-talk)). Therefore “zero allocations in all reducers” is folklore, not a universal requirement. Immutable snapshots allocate by design and are needed for React integration.

Hot-path allocation still matters when it creates GC pauses, large retained graphs, or framework reconciliation churn. Reuse stable subscription/handler functions, cache formatter instances and derived indexes, and avoid rebuilding entire item registries per keystroke. Do not pool DOM nodes or mutable snapshots without correctness and heap evidence. Profile allocation rate, GC time, retained heap after mount/destroy cycles, and listener/observer leaks separately.

### Other claims requiring evidence

- Memoization can cost more than recomputation for cheap values and retains dependencies.
- A smaller gzip bundle does not guarantee lower interaction latency; parse/execute and DOM work must be measured.
- `will-change` is not a free compositor switch. The animation guide recommends it sparingly and removing temporary hints; permanent layer promotion can increase memory ([web.dev animation guide, 2020-10-06](https://web.dev/articles/animations-guide)).
- Signals/fine-grained rendering are not inherently faster than snapshots for every component; compare full framework pipelines.

## Benchmark and certification protocol

Create equivalent Vue, React, and vanilla fixtures with the same data, DOM depth, styles, and interaction scripts. Each optimization compares an unoptimized control and candidate in the same browser/session, with randomized order and no DevTools open during final timing. Publish fixture, commit, browser/OS/device, framework versions, sample count, median, p95/p99, and raw trace—not only an average.

Minimum scenarios:

1. mount/destroy 1, 100, and 1,000 component instances; retained heap after cleanup;
2. open/close overlay 500 times; focus and native top-layer work included;
3. keyboard traversal 100/1,000/10,000 items; plain versus virtualized;
4. editable combobox input and filtering, including IME and result-count announcements;
5. scroll fixed/variable-height lists at realistic velocity on a physical mid/low-tier phone;
6. resize/rotation/virtual-keyboard geometry storms;
7. SSR/hydration and production tree-shaken bundle execution.

Record INP/event timing, LoAF and long tasks, style/layout/paint/composite durations, forced-reflow attribution, dropped frames, DOM/listener counts, JS heap/GC, and adapter render counts. Field INP uses the 75th percentile; lab interactions should additionally report tail latency because one mean can hide keyboard stalls ([web.dev INP, retrieved 2026-10-27](https://web.dev/articles/inp)). No optimization merges without a statistically visible win over the control and no accessibility regression.

## Revision 1: absolute gates and scheduler scope

### Provisional laboratory ceilings

Reference hardware is **Moto G Power 5G (2024)** for mid-tier Android and **iPhone 15 (2023)** for iOS. Record exact device, OS, browser, power mode, and network/CPU conditions; these are named reference classes, not claims about every phone. The first implementation must meet these provisional p95 gates over at least 30 measured iterations after warm-up, revisable only by ADR:

| Scenario | Absolute provisional gate |
|---|---|
| One roving-focus step, keydown to painted active item | **≤ 50 ms p95** |
| Overlay open, including native `showModal()`/`showPopover()` and dependent focus | **≤ 100 ms p95** |
| Editable combobox filter at 1,000 items, key echo + painted results + result-count announcement | **≤ 50 ms p95** |
| 1,000 mount/destroy cycles | **0 retained stores, listeners, observers, or registered items** |
| Fixed-size virtual scroll at 10,000 rows | No long task > 50 ms attributable to engine range calculation/recycling |

Use **fixed-size virtualization from 250 rows** as the provisional default. Variable-size stays opt-in until its measurement path is certified. At 100/250/500/1,000 rows, compare plain versus virtual mount latency, p95 scroll/key latency, DOM nodes, and heap; retain the threshold only if virtualization materially improves interaction without an accessibility regression. This is an initial product rule to measure, not a universal optimum.

### Scheduler is fallback-only and commit-ordered

Native CSS anchor placement never enters the JavaScript frame scheduler. The read→compute→write scheduler exists only for the geometry fallback, variable-height virtualization, and keyboard-viewport reactions. It is drained by the same adapter post-commit effect queue defined in research 02: React layout effect, Vue post-flush watcher, or vanilla post-patch microtask. There is no independent rAF racing React/Vue rendering. Read work that genuinely needs the next frame is queued after the current commit with its snapshot version and dropped when superseded.

### Cross-engine measurement and yielding

LoAF attribution is Chromium-only from Chrome 123; Firefox and Safari have no corresponding API ([MDN `PerformanceLongAnimationFrameTiming`, updated 2026-10-22](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming)). Use Event Timing where implemented for interaction durations, and Firefox Profiler/Safari Timelines for rendering stacks and engine-specific evidence ([MDN `PerformanceEventTiming`, updated 2026-10-22](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming)). The protocol records different evidence sources rather than treating Chromium LoAF as a three-engine result.

Above a measured filtering-cost threshold, process ranking in chunks: paint the key echo first, yield between chunks with `scheduler.yield()` where available (Chromium 129 / Firefox 142), otherwise `setTimeout(0)` or `MessageChannel`, and coalesce stale query versions ([MDN `Scheduler.yield`, updated 2025-09-25](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)). Chromium-only `navigator.scheduling.isInputPending()` may influence an extra yield but is never required ([MDN, updated 2024-09-27](https://developer.mozilla.org/en-US/docs/Web/API/Scheduling/isInputPending)). Do not delay input echo, active-option feedback, or result correctness behind an older chunk.

### Containment, pointers, and platform caveats

`contain: layout paint` can bound invalidation on overlay panels and suitable list rows; `content` is another candidate when its full containment semantics fit ([MDN `contain`, updated 2026-09-07](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/contain)). Apply only where paint clipping does not cut off focus rings/popovers. Do not use `contain: size` on auto-height items; use `contain-intrinsic-size` with `content-visibility` instead.

Use `pointerdown`/`pointermove` with a declared `touch-action` for pan/zoom intent rather than building every gesture from touch listeners. Pointer Events provides unified input, while `touch-action` lets the browser decide native scrolling before JavaScript ([W3C Pointer Events, retrieved 2026-10-27](https://w3c.github.io/pointerevents/)). Retain touch listeners only for genuine multi-touch recognizers; non-canceling wheel/touch observation remains passive.

BCD records `content-visibility: auto` as partial in Safari 18–25 (offscreen content not findable) and full in Safari 26; the Baseline-newly-available milestone is 2025-09-15 ([web-features entry, 2025-09-15](https://web-platform-dx.github.io/web-features-explorer/features/content-visibility/)). Run find-in-page and AT checks per engine instead of generalizing the Chromium demo.

For roving focus, use `focus({ preventScroll: true })` followed by one explicit `scrollIntoView({ block: 'nearest' })` with tokenized `scroll-margin`, avoiding browser+script double scrolling ([MDN `focus`, updated 2025-06-23](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus); [MDN `scrollIntoView`, updated 2026-08-12](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)).

## Recommendations for ARCHITECTURE.md

1. **CSS-only placement above each property's floor; the scheduler-driven geometry fallback on the floor; drain the scheduler only for geometry fallback and measurement-driven features after adapter commit.** *Trade-off:* fallback geometry becomes coordinated rather than ad hoc, without an independent rAF racing framework rendering.
2. **Use Pointer Events and `touch-action` by default, passive non-canceling listeners, direct listeners, and delegation only after benchmarks.** *Trade-off:* potentially more small listeners, but simpler lifecycle and no root-handler overhead without proof.
3. **Prefer Intersection/ResizeObserver to polling; disconnect aggressively and never mutate observed geometry in an unguarded callback.** *Trade-off:* asynchronous timing is unsuitable for exact per-frame positioning, which stays in the scheduler/CSS anchor path.
4. **Keep plain DOM below 250 fixed-size rows, use fixed-size virtualization above it provisionally, and retain it only after comparative evidence.** Use `content-visibility` for independent sections and variable-height virtualization only after certification. *Trade-off:* two list strategies require testing, while small lists preserve find-in-page and simple AT navigation.
5. **Animate transform/opacity and use `will-change` only temporarily after profiling.** *Trade-off:* some visual effects require layout/paint or a different design; layer memory is not spent speculatively.
6. **Maintain stable record shapes and cached derived structures as low-cost hygiene, but prohibit JIT-driven rewrites without traces.** *Trade-off:* theoretically avoidable polymorphism/allocation may remain where readability, immutability, and cross-engine simplicity win.
7. **Gate initial and changed engines on the absolute p95 budgets plus the control/candidate protocol, including tail latency, rendering stages, heap, and named physical devices.** *Trade-off:* performance work takes longer to certify, but “optimizations” cannot ship based on folklore or a single desktop average.

STATUS: REVISION-1