# 07 — Testing and certification

**Research date:** 2026-10-27. “Certification” here means the repository’s documented release gate; it is not an external WCAG certification. W3C ACT covers automated, semi-automated, and manual evaluation and exists to make interpretations consistent ([W3C ACT overview, ACT Rules Format 1.1 published February 2026](https://www.w3.org/WAI/standards-guidelines/act/)). A clean automated scan alone cannot establish WCAG 2.2 AA or usable AT interaction.

## One shared semantic specification

Create a versioned, framework-neutral spec per component, used by contract generation and tests. It should contain:

- anatomy and required native element/role per part;
- initial states and controlled/uncontrolled configurations;
- actions with preconditions, expected next state, emitted intent, focus target, ARIA attributes/IDREFs, and native side effects;
- keyboard/gesture map, disabled/readonly behavior, orientation/RTL variants;
- accessible-name/description fixtures and expected relationships;
- native-feature fallback rules;
- data fixtures with stable item keys, empty/one/many/long-label/disabled cases;
- manual AT assertions that cannot be automated.

Reducer unit tests consume actions directly. Vue, React, and vanilla interaction suites execute the same semantic actions through their adapters. Assertions compare public behavior and relationships, not component-private implementation or byte-identical DOM. Generated IDs are checked for uniqueness, stability, and correct references rather than exact framework-specific strings. Event payloads are normalized at the adapter boundary.

W3C’s web-platform-tests project demonstrates the value of one test suite running across browser engines ([WPT introduction, retrieved 2026-10-27](https://web-platform-tests.org/)). The same principle applies at two layers here: one core spec across frameworks, then each adapter in Chromium, Firefox, and WebKit.

## Layer 1 — unit and property/invariant tests

Run without a browser for every component engine:

1. initial state and every transition branch;
2. illegal/no-op events and controlled-state rejection;
3. open→navigate→accept/cancel→focus-return sequences;
4. first/last/wrap/disabled/removed-item behavior;
5. selection versus active item, single/multi-select invariants;
6. stable IDs, item keys, list insert/delete/reorder, empty collections;
7. typeahead buffer/reset/cycle, Unicode normalization, and composition guard;
8. locale parsing incomplete/ambiguous states, paste normalization, and canonical values;
9. pure placement/search/virtualization math with boundary fixtures;
10. no DOM/browser global access during SSR construction.

Add invariant sequences, not only example snapshots: exactly one tab stop per composite, active ID resolves to a mounted option, selection is a subset of available IDs unless explicitly retained, a controlled value never commits internally, no focus target points to a removed node, and repeated equivalent actions have equivalent results. Coverage reports must include transition/branch and shared-spec case counts; a line-coverage percentage alone cannot certify keyboard behavior.

## Layer 2 — real-browser interaction with Playwright

Playwright drives Chromium, Firefox, and WebKit, and can run branded Chrome/Edge and emulated devices ([Playwright browsers guide, retrieved 2026-10-27](https://playwright.dev/docs/browsers)). It is Apache-2.0 licensed ([Playwright LICENSE, retrieved 2026-10-27](https://github.com/microsoft/playwright/blob/main/LICENSE)); it is a development/test dependency, never runtime behavior.

Use real `keyboard.press`, pointer/tap, focus, paste, and native form flows. Avoid `dispatchEvent` for primary interaction certification: Playwright’s actionability checks include visibility, stability, enabled/editable state, and hit-target interception, while `dispatchEvent` bypasses them ([Playwright actionability, retrieved 2026-10-27](https://playwright.dev/docs/actionability)). Synthetic events remain useful only for narrow edge-case unit/integration tests.

Run every shared interaction spec:

- across all three adapters and browser engines;
- with SSR HTML followed by hydration, asserting no mismatch, stable IDREFs, and no pre-hydration duplicate behavior;
- with two instances and multiple framework roots to expose ID/listener collisions;
- with mouse→keyboard→touch modality switches;
- with RTL, vertical/horizontal orientation, locale/timezone variations, and reduced motion;
- with native dialog/popover/select/input paths and forced fallback paths;
- with mount/destroy/remount cycles to detect leaked listeners/observers/focus restoration.

Playwright WebKit is a patched recent WebKit build, not branded Safari; its documentation explicitly distinguishes them and recommends WebKit on macOS for closest Safari behavior ([Playwright browsers guide, retrieved 2026-10-27](https://playwright.dev/docs/browsers)). Mobile emulation does not validate a real virtual keyboard, VoiceOver, or TalkBack. Keep stable Safari and physical-device gates rather than claiming those from emulation.

## Layer 3 — automated accessibility with axe

Run axe-core in the real-browser suite against every meaningful state: closed/open, active item, selected, disabled, invalid/error, loading/no-results, nested overlay, long content, and fallback. axe-core is MPL-2.0 licensed ([axe-core LICENSE, retrieved 2026-10-27](https://github.com/dequelabs/axe-core/blob/develop/LICENSE)); it is a test-only dependency.

Configure the WCAG 2.2 A/AA rules supported by the pinned axe version and record that version in the report. Fail on violations; triage “incomplete” results manually rather than dropping them. Never disable a rule globally to make a baseline green. A scoped exception requires issue, rationale, affected fixture, owner, and expiry/retest date.

Axe checks DOM/computed-style rules; it cannot judge meaningful labels, actual speech, focus logic, keyboard conventions, or whether a modal workflow makes sense. W3C ACT’s inclusion of semi-automated and manual methods reflects this need for human evaluation ([W3C ACT overview, 2026-02](https://www.w3.org/WAI/standards-guidelines/act/)). Report “zero detected axe violations in these states,” never “axe proves WCAG conformance.”

Supplement axe with executable assertions from the shared spec: all IDREFs resolve, no positive tabindex, focus is visible and expected after each key, inactive overlays are not focusable, options have correct position/set size, and live-region text matches visible status.

## Layer 4 — real-AT manual protocol

W3C ARIA-AT maintains test plans and results for expected screen-reader behavior across common patterns and multiple testers; its automation work is separate from established manual review ([W3C ARIA-AT about, retrieved 2026-10-27](https://aria-at.w3.org/about)). Use relevant ARIA-AT assertions as references, but test the library’s actual presets and compound primitives rather than assuming APG example coverage transfers.

### Required environments

Use the P1 matrix from research 03: NVDA+Chrome/Firefox and JAWS+Chrome/Edge on Windows; VoiceOver+Safari on macOS; VoiceOver+Safari and TalkBack+Chrome on physical mobile. Add Narrator+Edge and secondary pairs quarterly. Exact OS/browser/AT versions and hardware belong in every result.

### Procedure per component

1. Start from a fresh documented page with default AT settings; record changes if any.
2. Reach the component using normal reading/navigation and record initial role, name, value, state, instructions, and position.
3. Execute every shared keyboard/gesture action one at a time; record actual speech and visible focus after each.
4. Traverse with AT reading commands as well as widget interaction commands; for JAWS/NVDA include browse/virtual and forms/focus modes.
5. Open, navigate, accept, cancel, and dismiss every popup; verify focus return and no background interaction.
6. Test deletion/reorder/filter/no-results/error/loading and repeated status updates; note missing, duplicated, or excessive announcements.
7. On mobile, test touch exploration, activation, scrolling, rotor/local gestures, virtual keyboard, native dismissal, and orientation change.
8. Repeat with RTL, zoom/reflow, forced colors where supported, and an actual user of the AT for release-critical complex widgets when possible.

Store a dated result table with expected assertion, actual speech (verbatim), focus, verdict, evidence clip/log where consented, tester, and upstream issue link. A failure cannot be waived as “browser bug” without a minimal reproduction and documented user impact. Any workaround gets its own full matrix run.

## Layer 5 — visual regression

Playwright’s `toHaveScreenshot()` compares against stored references and documents that rendering varies by OS, browser, settings, hardware, and headless mode; baselines must be generated/compared in the same environment ([Playwright visual comparisons, retrieved 2026-10-27](https://playwright.dev/docs/test-snapshots)). Maintain separate browser/platform baselines instead of expecting identical text rasterization across engines.

For deterministic images:

- use local pinned fonts and wait for `document.fonts.ready`;
- fix locale, timezone, color scheme, viewport, DPR, data, and clock;
- disable finite animations/caret for static captures and move hover away intentionally;
- use reduced-motion and forced-colors media emulation in dedicated cases;
- mask only truly nondeterministic content, never focus rings, errors, contrast regions, or layout geometry;
- require human review of baseline updates, with before/after/diff artifacts.

Cover every variant×tone×size axis, label/hint/error/prefix/suffix composition, open overlays, focus/selection/disabled, long translations, RTL, 200%/400% zoom/reflow, touch density, and native fallbacks. Pixel thresholds should be narrow and justified per environment; a large global tolerance can hide real regressions. Semantic and visual tests are complementary—an accessible DOM can still be visually unusable.

## Layer 6 — cross-framework parity matrix

For each spec case, report a row keyed by `component / scenario / action / browser / adapter`. Required outcomes are identical for state, accessible relationships, focus, emitted intent, form value, and fallback. Rendering implementation may differ.

Parity fixtures include:

- compound primitives and the batteries-included preset built from them;
- controlled and uncontrolled operation, including controlled-owner rejection;
- prop-or-slot content and per-part classes;
- SSR/hydration and multiple roots/instances;
- native events versus programmatic events and consumer cancellation;
- form submit/reset/disabled fieldset;
- all keyboard maps, focus return, and IME composition;
- no duplicated framework event payloads or subscriptions after unmount.

A preset must run the same engine/spec as the compound parts; testing only the preset leaves primitive composition uncertified. Conversely, testing only primitives misses preset slot/default integration.

## Release certification gates

### Every pull request

- all unit/invariant and shared-spec cases;
- all adapter×engine interaction cases for affected components;
- axe in all affected states, with zero untriaged violations;
- semantic ID/focus/keyboard assertions;
- deterministic visual diffs reviewed;
- bundle/tree-shaking budgets and SSR/hydration checks;
- no skipped test without linked issue and owner.

### Before every release

- full P1 real-AT protocol on release candidate, not an older build;
- physical iOS/Android input and virtual-keyboard scenarios;
- stable branded Safari/Chrome/Edge checks where Playwright builds differ;
- complete cross-framework parity report and reviewed visual artifacts;
- performance control/candidate protocol for changed hot paths;
- license/provenance check confirming no behavioral runtime dependency;
- updated machine-readable contract, supported kinds, native fallback rules, known issues, and dated AT evidence.

A component ships only when every applicable gate passes. “Not applicable” requires a reason (for example, no async loading state exists). Flaky tests are failures to investigate, not candidates for automatic retry until green; retries may diagnose flakiness but cannot convert it into certification.

## Evidence artifact

Publish per release: spec version, source revision, test/tool versions, exact environment matrix, case totals (executed/passed/failed/not-applicable), axe scope/results, visual baseline revision, AT result log, known upstream issues, performance traces, and signer/date. This is a reproducible internal certification record, not a claim that an external body has certified the library.

## Revision 1: floor lanes and explicit WCAG 2.2 gates

### Test the capability and the real floor

Engine feature detection is injected through a `supports` map. Every fallback-bearing component runs its shared spec once with actual detection and once with each relevant capability forced false, on every adapter. The parity row becomes `component / scenario / action / browser / adapter / path`, where `path` is `native` or the named fallback. This proves branch behavior and event parity, not actual old-browser behavior.

A **real floor lane** runs the same interaction suite on actual Chromium 114 / Firefox 125 where practical and physical iOS 17 devices (device lab or hosted real devices), plus Android/Chrome at the declared floor. It runs at least per release and on every change to a fallback-bearing component. A current patched WebKit build or an emulated viewport is not an iOS 17 substitute. Record device, OS, browser, path, and any contract-version mismatch in the evidence manifest.

### WCAG 2.2 is a checklist, not an axe tag set

The axe rule list has exactly one WCAG 2.2 rule, `target-size`, and it is disabled by default ([axe-core rule descriptions, retrieved 2026-10-27](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)). Enable it explicitly, then implement the rest as named checks:

| Criterion | Gate and executable/manual assertion |
|---|---|
| 2.4.11 Focus Not Obscured (Minimum), AA | **PR:** after every focus move, intersect the focused rect with sticky/fixed/top-layer siblings and assert non-zero visible area; include keyboard-open and overlay cases ([W3C, updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)). |
| 2.4.13 Focus Appearance, AAA adopted as internal visible-focus floor | **PR:** tokenized computed-style check for indicator area at least the area of a 2-CSS-pixel perimeter and at least 3:1 contrast between focused and unfocused states. This exceeds AA intentionally ([W3C, updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)). |
| 2.5.7 Dragging Movements, AA | **PR:** every drag fixture performs the same action through its single-pointer alternative and verifies equivalent state ([W3C, updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)). |
| 2.5.8 Target Size (Minimum), AA | **PR:** enable axe `target-size`; additionally measure target bounds ≥24 CSS px or document/test the exact spacing/inline/equivalent exception. Triage axe “needs review” rather than auto-passing it ([W3C, updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). |
| 3.3.7 Redundant Entry, A | **Release:** form-preset integration and manual review confirm previously supplied values are retained or selectable, except deliberate security exceptions. Run the affected integration test in PR when changed ([W3C, updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)). |
| 3.3.8 Accessible Authentication (Minimum), AA | **Release:** OTP/auth preset test completes without a cognitive-function test, and manual review checks copy/paste, password manager, one-time-code, and alternative path behavior. Run the affected flow in PR when changed ([W3C, updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)). |
| 3.2.6 Consistent Help, A | **Release:** repeated help/contact mechanisms remain in the same relative order across preset views, unless the user deliberately changes it ([W3C, updated 2024-12-12](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)). |

At build time, assert every `variant × tone × size` text/background pair at 4.5:1 and UI/focus pairs at 3:1 using the existing contrast checker, so token changes fail before rendering. PR also validates every component contract against JSON Schema and generates `registry.json` in that job, preventing schema and registry drift.

### Accessibility-tree and IME automation

Use `getByRole` and `toMatchAriaSnapshot()` for one shared role/name YAML assertion per state across adapters ([Playwright ARIA snapshots, retrieved 2026-10-27](https://playwright.dev/docs/aria-snapshots)). Playwright computes its representation; for Chromium's own accessibility tree, add CDP `Accessibility.getFullAXTree` checks. Firefox/WebKit actual output remains a real-AT concern, not something inferred from YAML ([CDP Accessibility domain, retrieved 2026-10-27](https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/)).

Playwright keyboard events cannot create real IME composition. Automate Chromium composition start/update/commit/cancel and Enter-during-composition through CDP `Input.imeSetComposition` and `Input.insertText` ([CDP Input domain, retrieved 2026-10-27](https://chromedevtools.github.io/devtools-protocol/tot/Input/)). Keep physical Gboard and iOS Japanese/Chinese runs for Firefox/WebKit and actual keyboard-event ordering.

Use fast-check (MIT, test-only) to generate random action sequences from each spec's action set, check invariants after every step, and shrink failures. Generators must include disabled/removed items, controlled rejection, duplicate registration, and stale effect versions ([fast-check documentation and license, retrieved 2026-10-27](https://github.com/dubzzz/fast-check)).

Guidepup (MIT, test-only) may drive NVDA on Windows and VoiceOver on macOS from Playwright and capture spoken phrases on self-hosted runners ([Guidepup documentation and license, retrieved 2026-10-27](https://github.com/guidepup/guidepup)). It is a regression net under the manual protocol, not a replacement for JAWS, iOS, Android, or human judgment.

Visual fixtures load the actual production font files with `font-display: block`, and baselines are separated by `engine × platform × DPR`, not only browser name. The release manifest also records the BCD/Baseline dataset version used for support claims.

## Recommendations for ARCHITECTURE.md

1. **Make the machine-readable component contract the source for registry data, shared semantic tests, JSON Schema validation, and ARIA snapshots.** *Trade-off:* schema/actions require careful design up front, but framework parity and agent/lint consumers use the same truth.
2. **Use reducer invariants and model-based generators plus Playwright interaction tests on all engines/adapters and native/fallback paths.** *Trade-off:* the matrix is expensive, while browser/framework defects and untested edge sequences fail before release.
3. **Enable axe `target-size` and implement named WCAG 2.2 checks instead of treating an axe tag as conformance.** *Trade-off:* custom geometry and preset-flow tests require maintenance, but the AA floor is actually exercised.
4. **Require dated real-AT evidence on the release candidate, physical mobile devices, and a real floor lane; use Guidepup only as a regression net.** *Trade-off:* releases need manual time, licenses, and hardware, but actual speech/gesture UX and fallback behavior are verified directly.
5. **Keep visual baselines hermetic with production fonts and environment-specific `engine × platform × DPR` matrices, with mandatory human diff review.** *Trade-off:* more baseline artifacts, while broad pixel tolerances and accidental “update all” approvals do not conceal regressions.
6. **Publish a reproducible certification manifest including BCD version and block release on failed/flaky gates.** *Trade-off:* no “ship now, certify later” shortcut, but every accessibility/support claim has traceable evidence and known limitations.

STATUS: REVISION-1