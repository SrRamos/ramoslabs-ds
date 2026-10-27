# AUDIT — research/ (round 2)

Auditor: ds-fable. Input: `research/CHANGELOG-R1.md` (LISTO-R1) and the diff of each
`research/0N-*.md` against the round-1 commit (9116d8b). Scope: every MUST/SHOULD/NICE from
`audits/AUDIT-research.md`, the argued disagreement, and the modified sections only. New claims
in the modified sections were re-verified against BCD 8.1.7, the WHATWG spec text, and each
newly cited tracker/article.

Status legend: **resolved** (fix present and verified), **partial** (fix present, a defect
remains), **open** (not addressed), **rejected-with-reason** (kimi-ds argued; auditor's ruling
in the note).

Verdict rule for round 2: PASS when no MUST is open. A **partial** MUST that is citation
hygiene or a one-line wording slip does not block PASS; it is listed under "Required
corrections (no re-audit)" and the orchestrator verifies it at synthesis time.

**Result: 7/7 PASS.** Two files carry required corrections. One SHOULD remains open.

---

## 01-platform-primitives.md — **PASS**

| Finding | Status | Note |
|---|---|---|
| MUST 1 `requestClose()` gap | resolved | Three tiers with versions (Chromium 134 / Firefox 139 / Safari-iOS 18.4) in table and body; `cancel`+`close()` tier for Safari 17–18.3. Verified BCD. |
| MUST 2 `popover=hint` | resolved | Own row: partial 133–151 / 149–153, full 151 / 153, Safari none; tooltips on `manual`. Verified BCD. |
| MUST 3 `<select>` versions | resolved | `base-select` 135 / 27 / 149-flag; `::picker`, `<selectedcontent>` Firefox none. Verified BCD. |
| MUST 4 browser floor | resolved | Floor = Chromium 114 / Firefox 125 / Safari-iOS 17, with per-feature consequences and the rejected alternative (Safari 26 floor). Adds `nativeFrom`/`fallbackUntil` contract fields; 07 consumes them. |
| MUST 5 top-layer nesting | resolved | Rules 1–5 verified against the spec: "hide popovers until" runs in both `show()` and `showModal()`; auto nested in hint is downgraded to hint (effectiveType); hint nested in auto records a hint-stack parent and does not close autos. |
| SHOULD 6 command set | resolved | Built-ins enumerated; `request-close` 139 / 144 / 26.2; same-tree ID refs vs `commandForElement`. |
| SHOULD 7 `interestfor` | resolved | Chromium 142, not on standards track, no contract dependency. |
| SHOULD 8 empty cells | resolved | `:user-invalid` 119 / 88 / 16.5; VT same-doc and cross-doc split (126 / 18.2 / none). |
| SHOULD 9 property floors | resolved | `position-area` naming (125–130 `inset-area`, removed 131) matches BCD; `position-try-order` Firefox 148; `position-visibility` Safari 26.2. |
| NICE 10–11 | resolved | Popover focus semantics; `ToggleEvent.source` 140 / 145 / 26.5 verified. |

No regressions in the modified sections.

---

## 02-headless-engine.md — **PASS**

| Finding | Status | Note |
|---|---|---|
| MUST 1 effect timing | resolved | Versioned descriptors drained post-commit: `useLayoutEffect` (native/focus/geometry) + `useEffect` (announcements), Vue `flush: 'post'`, vanilla post-patch microtask; native open before dependent focus; superseded/missing-target drop; no synchronous re-dispatch. |
| MUST 2 props-in | resolved | `getProps()` read at derive and transition time, never copied into state or written during render; actual native state vs desired controlled state; corrective native effect post-commit without re-dispatch. The "controlled `open` wins and reopens after native Escape" rule is the standard controlled-input contract; accepted. |
| MUST 3 compound registration | resolved | Data-first ordered collection from the consumer; key→id map; mounted items register elements; `compareDocumentPosition` only as post-mount reconciliation, never SSR truth; virtual items mount before `aria-activedescendant` is written. Consistent with 03 MUST 3 and 05 virtualization. |
| SHOULD 4 StrictMode | resolved | Lazy store, reversible cleanup, idempotent `destroy()`, deduped `subscribe()`. |
| SHOULD 5 outside listeners | resolved | Capture-phase `pointerdown` on `document`, `composedPath()` exclusion, installed only without native light dismiss. |
| SHOULD 6 CSS identifiers | resolved | Raw ids for IDREFs; sanitized map for `anchor-name`/`view-transition-name`; `CSS.escape` for selectors. |
| SHOULD 7 studied references | **open** | Not applied and not declared as declined in the changelog. The brief lists the reference libraries and asks that licences be noted; the prop-getter/statechart comparison and the 3 / 8 KiB ceilings still cite none. Does not block PASS; carry to the ARCHITECTURE.md ADR on API shape. |
| SHOULD 8 `markRaw` | resolved | |
| NICE 9 timers | resolved | Injected scheduler, deterministic fake in SSR/tests. |

No regressions.

---

## 03-a11y-engine.md — **PASS** (required corrections below)

| Finding | Status | Note |
|---|---|---|
| MUST 1 mobile quirks | **partial** | Substance resolved: five-area dated log with P1 assertions, and the central evidence is real and current (WebKit 289338 NEW 2025-03-07, iOS VoiceOver does not move to a listbox mounted outside the combobox; APG 2855 open, TalkBack/Chrome select-only combobox unusable, Chrome 130 report; WebKit 260837 NEW; CSSWG 3040; TetraLogical priming; Matuzo TalkBack `haspopup` matrix). Defects: (a) WebKit 284804 was opened **2024-12-17**, not 2025-04-07 (that is Roselli's Safari 18.4 comment date); (b) WebKit 185679 was opened **2018-05-16**, not 2018-11-06, is RESOLVED FIXED, and **does not mention Safari 17**; the "Safari 17 was the remaining-fix milestone" sentence is unsupported by the cited source and must be sourced or removed; (c) WebKit 278370 was opened **2024-08-19**, not 2024-10-16 (fix landed Sept 2024, backports Sept–Oct 2024); (d) the a11ysupport.io TalkBack result (2023-08-22) is a client-rendered page whose content could not be retrieved; cite a quotable source or drop the sentence. (e) APG 2855's link to `aria-activedescendant` is a task-force hypothesis (July 2025), not a confirmed cause; say "selection failure, active-descendant suspected". |
| MUST 2 Android `keyCode` 229 | resolved | `beforeinput`/`input` + `inputType` for editable, `keydown` for non-editable, composition guard insufficient alone, physical Gboard/CJK fixture. |
| MUST 3 select-only strategy | resolved | DOM focus on trigger + `aria-activedescendant`, APG select-only cited; `aria-controls` path allowed by ARIA 1.2 but marked unproven per pair; native select on touch. Follow-up (SHOULD-level, not blocking): "renders the listbox inline when top-layer navigation fails" cannot be detected at runtime; make inline-vs-top-layer a static contract flag per platform class. |
| SHOULD 4 NVDA/WebKit dates | resolved | 18721 environment and closure corrected; 231724 open date 2021-10-14. |
| SHOULD 5 `:focus-visible` | resolved | `data-active` independent indicator. Note: `focus({ focusVisible })` is now Chrome 145 / Firefox 104 / Safari 18.4 (BCD), so "non-portable" should read "below the floor". |
| SHOULD 6 live-region ownership | resolved | Document-scoped client-only registry, dedupe window, SSR exclusion. |
| SHOULD 7 touch tooltips | resolved | |
| NICE 8 `aria-errormessage` | resolved | |

**Required corrections (no re-audit):** the three tracker dates, the Safari 17 sentence, the
a11ysupport.io citation, and the 2855 wording, all in the "Dated mobile quirk log" table and
the "Select-only combobox" section.

---

## 04-mobile-input-ux.md — **PASS**

| Finding | Status | Note |
|---|---|---|
| MUST 1 `enterkeyhint` | resolved | Column added to all 30 rows; form owner computes position; kind overrides (URL `go`, Search `search`, OTP `done`/`go`). |
| MUST 2 viewport primitives | resolved | `dvh`/`svh`/`lvh` with versions; `interactive-widget` Chrome Android 108 / Firefox Android 133 / iOS none; JS as residual. Verified BCD. |
| MUST 3 iOS focus zoom | resolved | ≥ 16 CSS px via size tokens; `maximum-scale`/`user-scalable` prohibited with WCAG 1.4.4; matrix records scale before/after focus. |
| SHOULD 4 separator rule | resolved | Dual-separator acceptance, grouping structure rule, no prefill, both-direction locale tests. |
| SHOULD 5 `maxlength` | **rejected-with-reason → accepted** | kimi-ds removed `maxlength` from OTP too, arguing a formatted paste is truncated by the browser before any input event. Correct: `maxlength` applies to pasted text, so "normalize first" is impossible for OTP. The auditor's exception was wrong; the new rule (no `maxlength` on phone/amount/reference/tax/card/OTP, length after normalization) stands. |
| SHOULD 6 payment/address kinds | resolved | 11 kinds added; `tax-id` with `autocomplete="off"` since no token exists. |
| SHOULD 7 Material / `autocorrect` | resolved | 48 dp with the dp ≠ px caveat; `autocorrect` 153 / 136 / 14.1. |
| SHOULD 8 autofill prerequisites | resolved | |
| NICE 9 `field-sizing` | open | Not applied; not blocking. |
| NICE 10 domain-bound SMS | open | Not applied; not blocking. |

No regressions.

---

## 05-performance.md — **PASS** (one required correction below)

| Finding | Status | Note |
|---|---|---|
| MUST 1 absolute gates | resolved | Five p95 gates, named devices (Moto G Power 5G 2024, iPhone 15), 30-iteration protocol, 250-row provisional virtualization with the revision measurement. |
| MUST 2 scheduler reconciliation | **partial** | Body is correct: scheduler is fallback/measurement-only, drained via the 02 post-commit queue, no independent rAF. But rewritten **recommendation 1 says "Use CSS-only overlay placement on the floor"**, and 01 now defines the floor as Safari/iOS 17, where anchor positioning does not exist and placement *is* the geometry fallback. Change to "CSS-only placement above each property's floor; the scheduler-driven geometry fallback on the floor". One line; it matters because the orchestrator lifts recommendations into ADRs. |
| SHOULD 3 V8 dates | resolved | 2017-08-30 and 2019-01-03 verified. |
| SHOULD 4 LoAF | resolved | Chromium-only; Event Timing + Firefox Profiler / Safari Timelines. |
| SHOULD 5 yielding | resolved | Chunking, `scheduler.yield()` 129 / 142, fallbacks, stale-query coalescing, echo first. |
| SHOULD 6 containment | resolved | |
| SHOULD 7 Pointer Events | resolved | |
| SHOULD 8 `content-visibility` Safari | resolved | 18–25 partial / 26 full matches BCD (`18-26` range). |
| NICE 9 `preventScroll` | resolved | |

**Required correction (no re-audit):** recommendation 1 wording as above.

---

## 06-math-ml.md — **PASS**

| Finding | Status | Note |
|---|---|---|
| MUST 1 scroll anchoring | resolved | One owner: native where present (56 / 66 / Safari 27) or `overflow-anchor: none` before manual correction; anchor-node candidate preserved. |
| MUST 2 placement vocabulary | resolved | Contract stores `position-area`, ordered `position-try-fallbacks`, `position-try-order`, `position-visibility`; fallback evaluates in declaration order; parity tests on identical rectangles. Consistent with 01 SHOULD 9 floors. |
| SHOULD 3 Levenshtein | resolved | Primary bibliographic data correct; the PDF is a mirrored scan, acceptable. |
| SHOULD 4 Speculation Rules | resolved | Chromium-only with versions; "safe-ish" removed. |
| SHOULD 5 `Intl.Segmenter` | resolved | Index time only. |
| SHOULD 6 date arithmetic | resolved | Temporal 144 / 139 / preview as enhancement; owned Gregorian UTC-noon civil-day model; non-Gregorian excluded. Note: `Intl.Locale.getWeekInfo()` is now Chrome 130 / Safari 17 / Firefox 153, so "where supported" is above-floor everywhere except Firefox 125–152; the Temporal citation (WPT interop issue) would be better as BCD/MDN. Not blocking. |
| NICE 7 fuzzy scorer references | open | Not applied; not blocking. |
| NICE 8 `prefetch` intent | resolved | |

No regressions.

---

## 07-testing-certification.md — **PASS**

| Finding | Status | Note |
|---|---|---|
| MUST 1 floor lane | resolved | Injectable `supports` map; `path` column in parity rows; real floor lane on Chromium 114 / Firefox 125 / physical iOS 17 / Android floor, per release and per fallback change; emulation and patched WebKit explicitly excluded. Consistent with 01 floor. |
| MUST 2 WCAG 2.2 checks | resolved | Correctly states axe has one 2.2 rule (`target-size`, off by default); named PR/release gates for 2.4.11, 2.4.13 (AAA adopted), 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8 with executable assertions where possible. |
| SHOULD 3 ARIA snapshots | resolved | `toMatchAriaSnapshot` + CDP full tree, limits stated. |
| SHOULD 4 IME automation | resolved | CDP `Input.imeSetComposition`/`insertText`; physical runs for Firefox/WebKit. |
| SHOULD 5 model-based tests | resolved | fast-check with adversarial generators. |
| SHOULD 6 Guidepup | resolved | Regression net under the manual protocol. |
| SHOULD 7 token contrast | resolved | Build-time 4.5:1 / 3:1 over `variant × tone × size`. |
| SHOULD 8 fonts/baselines | resolved | |
| NICE 9–10 | resolved | JSON Schema + registry generation in CI; BCD version in manifest. |

No regressions.

---

## Cross-file state after round 1

| Decision | Owner file | Status |
|---|---|---|
| Browser floor | 01 | Defined (Chromium 114 / Firefox 125 / Safari-iOS 17); consumed consistently by 07. 05 rec. 1 wording slip (above). |
| Overlay engine | 01 + 06 + 05 | Consistent: CSS vocabulary in the contract, CSS above property floors, geometry fallback below, scheduler fallback-only and post-commit. |
| Collection model | 02 + 03 + 05 + 06 | Consistent: data-first collection, key→id, mount-before-activedescendant, one scroll-anchoring owner, 250-row provisional threshold. |
| Focus strategy | 03 | Decided per composite incl. select-only; `data-active` indicator rule. Open SHOULD: static inline-vs-top-layer flag. |
| Typeahead input source | 03 + 02 + 07 | Consistent: `beforeinput`/`input` editable, `keydown` non-editable, CDP IME automation. |

## Open items carried forward (non-blocking)

- 02 SHOULD 7: studied-reference comparison with licences and measured sizes → ARCHITECTURE.md API-shape ADR.
- 03 follow-up: inline-vs-top-layer listbox as a static contract flag.
- 04 NICE 9–10, 06 NICE 7.

## Required corrections before synthesis (no re-audit)

1. 03: WebKit 284804 opened 2024-12-17; WebKit 185679 opened 2018-05-16 and remove or source the "Safari 17 milestone" sentence; WebKit 278370 opened 2024-08-19; replace or drop the a11ysupport.io citation; soften APG 2855 to "selection failure, active-descendant suspected".
2. 05: recommendation 1, "CSS-only overlay placement on the floor" → "above each property's floor".

AUDIT-ROUND-2 DONE
