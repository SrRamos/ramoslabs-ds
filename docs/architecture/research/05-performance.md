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

V8 tracks object shapes with hidden classes and uses them for optimized property access/inline caches; same properties added in the same order share a shape, while shape churn can inhibit optimization ([V8 fast properties, published 2017-08-23](https://v8.dev/blog/fast-properties)). This mechanism is real. “Always make every UI object monomorphic” is not a measured architecture rule.

Reasonable hygiene is to construct snapshot/item records in one consistent shape and avoid adding/deleting arbitrary fields in hot loops. Do not replace immutable transitions, Maps, or readable records with classes/object pools solely on the expectation of a JIT win. SpiderMonkey and JavaScriptCore have different internals, and DOM/rendering often dominates. Accept a monomorphism rewrite only when a cross-browser profile identifies that hot property-access site and the rewrite improves the interaction.

### Allocation and garbage collection

V8’s generational GC is optimized around many short-lived objects dying young; its own GC guide says short-lived objects are relatively cheap and surviving objects drive copying costs ([V8 “Trash talk”, published 2019-01-09](https://v8.dev/blog/trash-talk)). Therefore “zero allocations in all reducers” is folklore, not a universal requirement. Immutable snapshots allocate by design and are needed for React integration.

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

## Recommendations for ARCHITECTURE.md

1. **Build one read→compute→write frame scheduler for overlays, collection measurement, and viewport reactions.** *Trade-off:* geometry operations become asynchronous/coordinated instead of ad hoc synchronous calls, but forced-layout loops have a single enforceable boundary.
2. **Use passive non-canceling listeners, direct listeners by default, and delegation only after collection benchmarks.** *Trade-off:* potentially more small listeners, but simpler lifecycle and no root-handler overhead without proof.
3. **Prefer Intersection/ResizeObserver to polling; disconnect aggressively and never mutate observed geometry in an unguarded callback.** *Trade-off:* asynchronous timing is unsuitable for exact per-frame positioning, which stays in the scheduler/CSS anchor path.
4. **Keep plain DOM as the default; adopt `content-visibility` for independent offscreen sections and virtualization only for measured large-list bottlenecks.** *Trade-off:* some large pages need two rendering strategies, while find-in-page, AT navigation, and focus remain intact by default.
5. **Animate transform/opacity and use `will-change` only temporarily after profiling.** *Trade-off:* some visual effects require layout/paint or a different design; layer memory is not spent speculatively.
6. **Maintain stable record shapes and cached derived structures as low-cost hygiene, but prohibit JIT-driven rewrites without traces.** *Trade-off:* theoretically avoidable polymorphism/allocation may remain where readability, immutability, and cross-engine simplicity win.
7. **Gate performance changes on the shared control/candidate protocol, including tail latency, rendering stages, heap, and physical mobile results.** *Trade-off:* performance work takes longer to certify, but “optimizations” cannot ship based on folklore or a single desktop average.

STATUS: DRAFT-COMPLETE