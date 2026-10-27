# 06 — Math and ML: where they genuinely help

**Research date:** 2026-10-27. There is no library implementation or user telemetry to evaluate, so no accuracy, latency, or bundle-saving claim is made here. The default is deterministic arithmetic and lexical matching. A learned model needs an application-level use case, evaluation data, and an explicit exception to the zero-runtime-dependency rule; none is justified for the core engine.

## Positioning and collision geometry: genuinely useful math

Anchor positioning associates boxes and can try alternative placements to avoid overflow ([CSS Anchor Positioning Module Level 1, Editor’s Draft retrieved 2026-10-27](https://drafts.csswg.org/css-anchor-position-1/)). Use it natively first. The fallback still needs straightforward geometry, not ML:

1. Measure the anchor, floating rectangle, clipping ancestors, and visual viewport once in the read phase.
2. Generate preferred and alternate placements in logical coordinates (`block-start`, `inline-end`), then resolve writing mode/RTL.
3. For each candidate, compute overflow on each side: `max(0, boundaryMin - elementMin)` and `max(0, elementMax - boundaryMax)`.
4. Reject candidates that cannot fit after allowed size constraint; otherwise choose the first valid declared fallback, or minimum overflow with original input order as tie-breaker.
5. Shift the chosen rectangle into the boundary, constrain maximum inline/block size, and compute the arrow’s clamped anchor-center projection.
6. Hide or detach according to an explicit `position-visibility` policy when the anchor is not usable; do not leave a floating control visually attached to the wrong target.

These are deterministic rectangle operations. The subtle work is browser geometry—transforms, scroll containers, clipping, visual viewport, zoom, and writing modes—not prediction. Keep pure functions for `intersect`, `overflow`, `clamp`, `candidateRect`, and `arrowOffset` and test them independently of DOM.

Floating UI is useful **studied reference only** for middleware ordering, flip/shift/size/arrow concepts, and platform abstraction; it is MIT-licensed ([Floating UI middleware documentation, retrieved 2026-10-27](https://floating-ui.com/docs/middleware); [MIT license, retrieved 2026-10-27](https://github.com/floating-ui/floating-ui/blob/master/LICENSE)). No code or runtime import is required. Its documentation explicitly shows that middleware order changes results, so the owned fallback must version and test one fixed pipeline rather than accepting arbitrary plugin order.

**Trade-off:** native CSS avoids JavaScript measurement and frame scheduling but cannot express every product-specific collision policy. A small fallback adds code and geometry bugs; a generalized middleware plugin system adds extensibility that the core does not need.

## Fuzzy search ranking: lexical algorithms before ML

Component search usually ranks a bounded option/command list. A deterministic weighted lexical scorer is sufficient default:

- exact accessible-name match;
- exact prefix;
- word-prefix in original order;
- contiguous substring;
- ordered subsequence with penalties for gaps and total span;
- optional bounded edit distance only for a deliberate “did you mean” mode.

Normalize with Unicode normalization, whitespace collapsing, and locale-aware case folding; preserve original labels and stable input order as the final tie-breaker. Do not strip diacritics by default or use an English-only tokenizer for all locales. `Intl.Collator` provides locale-sensitive comparison for sorting, but ranking still needs an explicit policy ([MDN `Intl.Collator`, retrieved 2026-10-27](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator)).

Edit distance is a real string metric, not automatically good ranking. The primary source is V. I. Levenshtein, “Binary codes capable of correcting deletions, insertions, and reversals,” *Soviet Physics Doklady* 10(8):707–710, 1966; Russian original *Doklady Akademii Nauk SSSR* 163(4):845–848, 1965 ([scanned original paper, 1966](https://nymity.ch/sybilhunting/pdf/Levenshtein1966a.pdf)). The useful implementation fact is that unrestricted `queryLength × candidateLength` dynamic programming can dominate a large interactive list. Bound distance/candidates or use a subsequence index rather than running full edit distance on every item per keystroke.

BM25 is a documented probabilistic retrieval ranking function with term-frequency saturation and document-length normalization ([Robertson & Zaragoza, 2009-12-17, DOI 10.1561/1500000019](https://dx.doi.org/10.1561/1500000019)). It is appropriate for document-like collections, not automatically for a 20-item menu whose accessible names are short. Neural semantic ranking can help synonyms and natural-language commands, but it introduces weights, inference runtime, language/domain evaluation, nondeterministic version upgrades, and potentially large downloads. It does not belong in base list filtering.

Evaluate search with versioned, multilingual query→expected-item fixtures: exact/prefix behavior, top-1 success, top-k recall, stable ties, empty/no-result behavior, CJK and diacritics, and per-keystroke latency. A more sophisticated ranker must beat exact/prefix baseline on relevant fixtures without demoting keyboard-expected matches.

## Typeahead: deliberately simpler than fuzzy search

APG typeahead moves to the next option whose name starts with the typed character or rapidly accumulated string ([APG listbox, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)). Fuzzy scoring would violate that predictable contract: a substring or “similar” item is not necessarily the next prefix match.

Use a cyclic prefix index keyed by normalized accessible name, start after the active item, preserve data order, reset the buffer after a documented timeout, and skip composition events. Matching may be normalized; selection and announcement remain the original option. No ML, no probabilistic reorder, no debounce that makes keyboard feedback late.

**Useful distinction:** combobox filtering can rank; listbox/menu typeahead should find the next deterministic prefix. Sharing one fuzzy engine between them would be an accessibility defect.

## Virtualization math: prefix sums, not prediction

For fixed block size `s` and scroll offset `o`, first visible index is `max(0, floor(o / s) - overscan)` and total spacer size is `count × s`. For variable sizes, store a prefix-offset array `P` where `P[0] = 0` and `P[i + 1] = P[i] + size(i)`; binary search finds the first item whose end crosses `o`. These formulas are deterministic and support Home/End/typeahead directly on data.

After measuring item `i`, update its size and subsequent offsets. **Choose one scroll-anchoring owner:** rely on native CSS scroll anchoring where present (Chromium 56 / Firefox 66 / Safari-iOS 27), or set `overflow-anchor: none` on the scroller before applying the engine's correction only when the changed item is above the visible start. Never run both corrections. Native anchoring is available only when a suitable anchor node remains in the DOM, so the spacer/padding technique must preserve that candidate ([MDN `overflow-anchor`, updated 2026-07-26](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-anchor)). Keep stable item keys and `aria-posinset`/`aria-setsize`; APG requires those relationships when not all options are in the DOM ([APG listbox, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)).

Learned height prediction is hype for ordinary lists: it adds a model to approximate a value that can be measured exactly after render. A conservative estimated size is useful only as an initial placeholder; actual measurements remain authoritative. Virtualization itself is justified only by the performance protocol in research 05.

## Predictive prefetch: heuristics first, ML rarely

The Speculation Rules API declaratively requests navigation prefetch/prerender. Prefetch downloads a document response; prerender also loads subresources and runs JavaScript in an invisible tab, consuming more network and memory ([MDN Speculation Rules API, updated 2026-09-10](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API)). This API supplies a limited-availability progressive-enhancement mechanism, not a prediction algorithm or a portable baseline.

Start with deterministic intent:

- keyboard focus or deliberate hover delay on an enabled internal link;
- an explicitly declared next step in a linear workflow;
- an intersection-triggered hint only where visibility strongly implies navigation;
- no hint for logout, state-changing GETs, payments, OTP sends, quotas, or volatile/user-specific content.

MDN documents that unused prefetch/prerender wastes resources, prerender can create analytics/storage/stale-state side effects, and cross-site prefetch has privacy restrictions. It also exposes `Sec-Purpose`, `Document.prerendering`, `prerenderingchange`, and cache-clearing mechanisms ([MDN Speculation Rules API, 2026-09-10](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API)). These controls are mandatory application integration, not optional polish.

A learned next-page model is justified only with consented, aggregated navigation data and a measured baseline comparison. Report prediction precision, navigation rate, cache-hit rate, bytes/memory wasted per successful navigation, server cost, data-saver behavior, stale-content errors, and actual navigation latency. A model that improves hit rate while wasting more resources than the simple focus/hover rule is not a win. Predictive behavior must never prefetch protected data to a shared/untrusted cache or change component state before activation.

This belongs in an application navigation adapter, not the component behavior core. Components may emit intent; they must not autonomously fetch routes.

## Input-pattern detection: declaration beats inference

The field’s `kind` is already a contract that selects keyboard/autofill/validation attributes. Inferring “phone,” “OTP,” “amount,” or “date” from the user’s current text would change the keyboard and parsing rules mid-task and can misclassify identifiers with leading zeroes. Use the declared kind and locale; pattern detection may only assist with non-semantic cleanup such as recognizing allowed pasted separators.

At authoring/lint time, simple deterministic heuristics can warn that a phone-looking field lacks `type="tel"` or an OTP field lacks `autocomplete="one-time-code"`. That is static developer assistance, not runtime ML. Runtime inference of sensitive data categories also creates unnecessary data collection and surprising accessibility changes.

## What must remain deterministic for accessibility

The following require identical results across frameworks and repeated runs for the same inputs:

- active descendant/roving focus and selection;
- typeahead next match and wrapping;
- placement candidate choice and focus-safe clipping;
- Home/End targets and virtual range offsets;
- accessible result counts and live-region messages;
- controlled-state transitions and fallback rules.

APG defines predictable keyboard conventions, including selection-follows-focus only where latency does not harm navigation ([APG keyboard interface, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)). A learned ranking must not reorder while the user is traversing unless the query/results genuinely changed; preserve active item identity across score updates and resolve ties by stable input order. Animations, asynchronous model completion, and speculative loads must not steal focus or announce a result that is not displayed.

## Hype and bundle-weight register

| Proposal | Verdict | Reason / condition |
|---|---|---|
| Rectangle collision math | **Useful, ship small pure functions** | Solves a bounded deterministic problem; native CSS first |
| Prefix/subsequence lexical ranker | **Useful default** | Bounded list, explainable score, no model artifact |
| BM25 for document search | **Conditional** | Useful for text corpora; overkill for short option lists |
| Full edit distance per item per key | **Usually poor fit** | Computation and ranking complexity; bound or index first |
| Fuzzy/ML typeahead | **Reject** | APG expects predictable prefix navigation |
| Learned row heights | **Reject** | Placeholder only; actual measurement is exact |
| Focus/hover/workflow prefetch | **Conditional, app-level** | Small deterministic intent; needs safety and waste metrics |
| ML next-page prediction | **Hype until measured** | Needs data, privacy, model/inference budget, and baseline win |
| Runtime field-kind inference | **Reject** | Declared intent is more accurate and stable |
| Neural search in base engine | **Reject** | Weights, runtime, language/domain risk, and accessibility complexity |
| Generic “AI accessibility fixer” | **Reject** | Cannot repair DOM semantics/focus or certify actual AT behavior |

No learned artifact should be described as “a few KB” without a production build measurement. Model weights, tokenizer, inference operators, WASM/GPU fallback, and model updates all count toward network, parse/compile, memory, and energy budgets. WebNN is a hardware-acceleration API specification, not evidence that a model is useful or small; it was still under W3C development at research date ([W3C Web Neural Network API, retrieved 2026-10-27](https://www.w3.org/TR/webnn/)). Browser acceleration does not remove download, evaluation, or accessibility costs.

## Revision 1: shared placement vocabulary, dates, and segmentation

### One placement policy for CSS and fallback geometry

The component contract stores the actual CSS vocabulary: a `position-area` value, ordered `position-try-fallbacks` (including `flip-block`, `flip-inline`, and named `@position-try` options), `position-try-order`, and `position-visibility` (`anchors-visible` or `no-overflow` where used). The CSS compiler emits those declarations directly. The geometry fallback parses the same contract and evaluates candidates in declaration order.

The first candidate that fits after size constraints wins; if none fits, `position-try-order` determines the most suitable size/overflow result and `position-visibility` determines conditional hiding. This mirrors the specification's ordered try-fallback algorithm rather than inventing a second placement policy ([CSS Anchor Positioning §position-try-fallbacks, retrieved 2026-10-27](https://drafts.csswg.org/css-anchor-position-1/#position-try-fallbacks); [MDN try options/hiding, updated 2026-10-06](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Try_options_hiding)). Parity tests feed identical rectangles to both paths and assert the same candidate, offset, and visibility outcome.

### Segmentation and date arithmetic

Word-prefix indexing uses `Intl.Segmenter` with `granularity: "word"` for CJK, Thai, and other scripts where whitespace is not a word boundary; it is available in Chromium 87, Safari 14.1, and Firefox 125 ([MDN `Intl.Segmenter`, retrieved 2026-10-27](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)). Segmentation runs once when the index is built, not on every keystroke. Exact/prefix and typeahead paths still use the accessible name, while word-prefix ranking stores segment boundaries.

Temporal is an enhancement only where available (Chromium 144 / Firefox 139; Safari preview, not on the proposed floor) ([TC39 Temporal status and WPT proposal, 2026-09-08](https://github.com/web-platform-tests/interop/issues/1381)). The floor uses owned **Gregorian, civil-date-only** arithmetic anchored at UTC noon, adding/subtracting calendar fields rather than local milliseconds so DST transitions cannot shift a date. It does not implement zoned date-time, leap seconds, non-Gregorian arithmetic, or instant semantics.

`Intl.DateTimeFormat` supplies month names, numbering systems, and display formatting; `resolvedOptions()` exposes calendar/numbering system, and `Intl.Locale.getWeekInfo()` supplies first day/weekend/minimal days where supported ([MDN `resolvedOptions`, updated 2025-09-24](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions); [MDN `getWeekInfo`, updated 2025-07-10](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo)). A non-Gregorian calendar preset is rejected until its arithmetic is implemented and tested; display-only localization does not silently change the arithmetic model. UTC-noon is a civil-day technique, not permission to add 86,400,000 ms to local-time instants ([MDN Date and differing day lengths, updated 2025-12-08](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)).

### Speculation support and component-level intent

Speculation Rules is not a portable floor primitive: stable support is Chromium (full document rules from 109, same-origin prerender from 105), Firefox has preview/limited prefetch work, Safari 26.2 support is behind a flag, and `Document.prerendering` is Chromium-only ([MDN Speculation Rules, updated 2026-09-10](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API); BCD retrieved 2026-10-27). It is a progressive enhancement, never a “safe-ish” requirement. `<link rel="prefetch">` also has uneven semantics/support and cannot guarantee a navigation win.

A combobox with remote options may emit an explicit `prefetch` intent on trigger focus/deliberate hover. The application decides whether to fetch and cancel/dedupe it; the component never starts navigation or hides network state. This is the only component-level prefetch intent in the core contract.

## Recommendations for ARCHITECTURE.md

1. **Ship deterministic geometry primitives and one fixed fallback positioning pipeline driven by the exact CSS anchor vocabulary; native CSS is primary.** *Trade-off:* the fallback parser accepts only declared CSS features, but native/fallback parity is testable and there is no second placement policy.
2. **Implement separate lexical utilities for search ranking and prefix typeahead; never reuse fuzzy ranking for keyboard typeahead.** *Trade-off:* two small algorithms instead of one “smart” service, each matching its UX contract.
3. **Use stable normalized scores with input-order ties, `Intl.Segmenter` at index time, and versioned multilingual fixtures.** *Trade-off:* simple rankers cannot infer synonyms; semantic ranking belongs in an application-specific optional service after evaluation, not base components.
4. **Use fixed-size formulas and variable-size prefix offsets/binary search for virtualization, with exactly one scroll-anchoring owner.** *Trade-off:* native/manual branches need tests, but double correction and speculative height models are avoided.
5. **Exclude predictive fetching from the headless core; expose navigation and remote-option `prefetch` intent only.** Applications may add deterministic speculation with safety/staleness controls. *Trade-off:* no built-in “instant navigation” claim, but components avoid hidden network, privacy, and server side effects.
6. **Do not ship ML models, inference runtimes, or runtime kind inference.** Revisit only through an ADR containing baseline evaluation, exact artifact sizes, license/provenance, privacy review, deterministic fallback, and accessibility results. *Trade-off:* the library forgoes fashionable semantic features until evidence supports them.
7. **Use Temporal only as an enhancement and owned Gregorian UTC-noon civil-date arithmetic on the floor.** *Trade-off:* non-Gregorian and zoned date-time presets are initially out of scope, while DST-safe calendar grids need no runtime date dependency.

STATUS: REVISION-1