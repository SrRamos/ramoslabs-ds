# S-TEST-A11Y notes (W1-310, ADR-013 L3)

Branch `feature/m3-a11y-gates`. Files: `packages/testing/a11y/**` and two scripts in
`packages/testing/package.json` (the only shared-file edit): `test:a11y` (`--grep @pr`) and
`test:a11y:release` (everything). axe is pinned exactly (`axe-core` and `@axe-core/playwright` 4.14.0, already in
the testing package, no change). `ci.yml` was not edited.

## Layout
- `collectors.js`: self-contained browser functions (Playwright serialises them), measure only.
- `verdicts.js`: pure decisions (`{ pass, failures[] }`), unit-tested in `verdicts.test.js` with pass and seeded-fail
  inputs per criterion (runs in the normal `vitest` gate, no browser).
- `a11y.e2e.ts`: 3 engines x the cases below, 120 tests, about 40 s. Titles carry `@pr` / `@release`.
- `serve.mjs`: builds the L2 host bundle (reused from `e2e/runner/build.mjs`), the real `@ramoslabs/css` and
  `tokens.css`, copies `fixtures/`, serves on `A11Y_PORT` (default 4180). Needs the tokens build first
  (`turbo` `dependsOn: build` provides it; the server throws a clear message otherwise).
- `triage.json`: `{ axe: [], targetSize: [] }`, empty. `validateTriage` fails any entry without an issue link
  (`#n` or a github issues URL) and an owner; an invalid entry triages nothing.
- `fixtures/**`: test-only HTML. Excluded from prettier/tsc/vitest by existing ignores (seeded violations).

## Gates and what each proves
axe (PR): the probe on all three adapters in states off, on, disabled, on+focused; tags wcag2a/aa, 21a/aa, 22aa,
best-practice; `target-size` enabled by name and the test fails if the rule is absent from every result bucket
(disabled controls make it `inapplicable`, which still proves it ran). Zero untriaged violations. (needs review) FAILS like a violation unless triaged with issue, owner and `reviewed: "pass"` (`result: "incomplete"`); the probe states currently produce none. Seeded page proves `image-alt`, `button-name`, `target-size` are reported and that
only a triage entry with issue AND owner clears one. Proves: axe's machine-checkable subset. Does not prove: the rest
of WCAG, or any screen reader behaviour.

- 2.4.11 (PR). Focus is moved by keyboard, then a 9x9 grid over the focused rect is hit-tested with
  `elementFromPoint`; a sample is obscured when the topmost node sits in a fixed/sticky/top-layer box that is not an
  ancestor of the focused element. The gate is STRICT as written in the ADR table ("intersection non-zero"): any
  obscured sample fails. The literal AA text (entirely hidden) is reported as `entirelyHidden`; the partial-cover
  fixture shows the difference. Fixtures: sticky header with the base `scroll-margin` (pass, page really scrolls), modal
  `<dialog>` opened with Enter (pass), full and partial fixed banner (fail). Does not prove: on-screen virtual
  keyboard overlap (not simulable on desktop engines), `pointer-events:none` overlays (hit test passes through
  them), cover by content that is not fixed/sticky, scroll-driven animations.
- 2.4.13 (PR, AAA internal floor). Computed model, no pixels: the outline plus non-blurred, zero-offset outer
  box-shadow rings become bands; a band counts if it contrasts >= 3:1 with the unfocused backdrop (ancestor
  background chain composited on white); total counting thickness must be >= 2 CSS px (a uniform ring of
  thickness t has area t x perimeter + 4t^2, so t >= 2 gives area >= 2 x perimeter). The base token ring (2px white
  gap + 2px indigo) passes; none, 1px and a 3px #e2e8f0 outline fail. Does not prove: gradient/image backgrounds,
  forced-colors rendering (reported, not judged), indicators drawn by other means (pseudo-elements, filters), or
  that the ring is not clipped by an `overflow` ancestor. The rendered look is W1-312/L5's job.
- 2.5.7 (PR). Structural plus one behavioural step. Drag sources = `draggable=true`, `[data-sj-drag]`, computed
  `cursor: grab`, `touch-action: none`. Each must declare `data-sj-drag-alt` (id) and `data-sj-drag-scope`; the alt
  must exist, be visible, enabled, focusable, and ONE plain click must change the scope's markup. Fails with no
  candidates (a gate with nothing to drag proves nothing). Does not prove: that the alternative is equivalent in
  outcome (only that it changes the scope), or detect drag implemented purely with pointer listeners and no
  marker/cursor/touch-action. Every real drag component must carry the marker (a rule for the component authors).
- 2.5.8 (PR). axe `target-size` plus measured bounds (`getBoundingClientRect`): >= 24 CSS px, or inline link in a
  sentence, or the spacing exception (24px circle on the bounding box meets no other target nor other undersized
  target's circle), or an exact entry in `triage.json -> targetSize` (fixture, selector, kind, reason, owner). Disabled
  controls are skipped. Native, unstyled checkboxes/radios are NOT given the user-agent exemption (conservative). The
  pass fixture exercises 44px defaults, `data-density=compact` (24px), spaced 16px targets and an inline link.
  Does not prove: the "equivalent control exists" exception (only by documented entry), hit areas reached via a
  wrapping `<label>`.
- 3.3.7 (release). A two-step form fixture; step 1 is filled by autocomplete token, then every step-2 field repeating a
  token must be prefilled, or selectable (datalist), or have a `data-sj-reuse-of` control whose activation fills it, or an
  explicit `data-sj-redundant-exempt` of essential/security/invalid. Does not prove: that the exemption is truthful,
  or fields that repeat information under different tokens, or multi-page navigation (a single-page stepper stands in).
- 3.3.8 (release). Per auth field: autocomplete token (`current-password`/`new-password`, `username`/`email`,
  `one-time-code`), a cancelable `paste` event is not default-prevented, a programmatic `fill` (password-manager
  simulation) is kept verbatim (a 6-digit code survives, so `maxlength=1` fails), and no cognitive-test markers
  (captcha class/id/name/sitekey/iframe selectors, puzzle phrases). Does not prove: real password-manager or OTP
  autofill (needs the browser extension / device), segmented OTP inputs, a puzzle with unrecognised wording, or the
  "allowed alternative" clause; the phrase list is a heuristic.
- 3.2.6 (release). Help is the element marked `data-sj-help`. Per page: landmark holding it, landmark order, the
  interactive items in that landmark. Against the first page: same landmark, same relative order of shared landmarks,
  same order of shared items around help. A help-like link (href or name contains help/support/contact) that is NOT
  marked fails, so unmarked help cannot hide from the gate. Does not prove: order for the real preset views (none
  exist yet; the gate is ready for them), help outside landmarks, or that the label/mechanism is the same type.

Per-PR versus per-release follows the ADR table. "PR if changed" for 3.3.7 and 3.3.8 is selection logic for
W1-314; the release script runs everything.

## Decisions
- WebKit on macOS skips buttons on Tab (Safari default), so the helper presses Tab once and then focuses
  programmatically there; `:focus-visible` is asserted by the 2.4.13 verdict rather than assumed.
- The probe host here (`host/a11y-host.html`) loads tokens + `sj.css` + probe.css and has an `h1` and `main`; the L2 host
  is untouched. The first run found `page-has-heading-one` and `region` on my own host, fixed there, not triaged.
- No pixel or ARIA-snapshot work: that is W1-309c / W1-312.

## What CI needs (W1-314 owns ci.yml)
Browsers as for L2; tokens built first; `bun run --filter @ramoslabs/testing test:a11y` (PR) and `test:a11y:release`
(release). Results: `packages/testing/node_modules/.cache/a11y/a11y-results.json`, `retries: 0`. Port 4180 free
(`A11Y_PORT`). Not part of `bun run gate` locally (browsers), same as L2.

## Follow-ups
- Real components must add `data-sj-drag*` and `data-sj-help` markers; unmarked ones are invisible to 2.5.7 beyond the
  cursor/touch-action heuristics.
- When presets exist, point 3.3.7/3.3.8/3.2.6 collectors at them (the fixtures are stand-ins).
- Size report: nothing shipped (test-only), no ADR-011 bytes.
