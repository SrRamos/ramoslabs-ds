# K4 notes: W1-108 placement, W1-110 parity oracle

Branch `feature/m1-k4-placement`. Code: `packages/core/src/overlay/placement/**`, `.../__parity__/**`,
`packages/testing/parity-geometry/**`. W1-109 (overlay behavior) is not started; it waits for W1-106b.
`overlay/index.ts` exports only placement.

## API

- `parsePlacement({ area, fallbacks?, order?, visibility? }, { dir?, tries? })` returns a `Placement` or `null`.
- `evaluatePlacement(placement, { anchor, size, bounds, clip? })` returns `{ index, x, y, visible }`
  (pure; `index` 0 is the base `position-area`).
- `createPlacementScheduler({ enqueue, native })`: `add`, `request`, `run` (the `DrainHost.run` for
  `geometry` effects), `flush`, `observe(visualViewport)`. `viewportRect(vv)` gives the keyboard-aware bounds.

## Ambiguities resolved

| Question | Resolution | Basis |
|---|---|---|
| Which `position-area` values? | Exactly: `top`/`bottom`/`left`/`right`/`center`, two-keyword combinations in any order, `block-start`/`block-end`, `inline-start`/`inline-end` (resolved with `dir`, horizontal writing mode). No `span-*`, `x-`/`y-`, `self-` forms; any unknown token makes `parsePlacement` return `null` (never inferred) | ARCHITECTURE.md Section 2 floor table ("Compile the exact subset; never infer from core Baseline"), ADR-005 step 2 |
| Tactics apply to what? | `flip-block`/`flip-inline` transform the **base** area, not the previous fallback; `flip-start` rejected | css-anchor-position-1 |
| Fit test | The element must fit the area's region (3x3 grid around the anchor, in the containing block). The whole-block track centers on the anchor and is clamped inside the block (safe alignment) | css-anchor-position-1 `position-area` |
| `position-try-order` | non-`normal` stably sorts base + fallbacks by region height/width descending, then first fit; `most-block-size`/`most-inline-size` map to height/width (horizontal writing mode) | css-anchor-position-1 (to be certified by L6) |
| Nothing fits | the base candidate is used (index 0); `no-overflow` then hides it | css-anchor-position-1 |
| `anchors-visible` | hidden when the anchor box has no area overlap with `clip`; `clip` absent means visible. `no-overflow`: hidden when the final box leaves `bounds`. `anchors-valid` accepted as no-op (the anchor exists) | ADR-005 step 2 |
| Degenerate zero-size anchor or clip | out of scope (the property test generates sizes >= 1) | no box to anchor to |
| Scheduler without rAF | `request` marks dirty and enqueues one `geometry` effect (coalesced per target); the first `geometry` effect in a drain flushes every dirty target (all reads, then all writes) | ADR-005 step 4, ADR-003 `EFFECT_ORDER` (`geometry` runs after open/close) |
| Native active | `native: true` (adapter passes `supports.anchorPositioning`): `add` and `request` are no-ops, nothing is enqueued | ADR-005 step 3 |
| Floors needing the fallback | core anchor positioning: Chromium 114-124, Firefox 125-146, Safari 17-25. Per-property floors differ (`position-area` 129/147/26, `position-try-order` 125/148/26, `position-visibility` 125/147/26.2), so a property-level `native` flag from the adapter is needed to be exact; this module takes one boolean and the adapter should AND the properties the contract uses | ARCHITECTURE.md Section 2 table, ADR-005 step 3 ("property-level") |
| visualViewport | adapter passes the object in (core reads no globals); `observe` listens to `resize` and `scroll` and requests re-placement | ADR-005 step 9 |

## Parity oracle (W1-110)

- `packages/testing/parity-geometry/reference.js`: independent evaluator working from the CSS strings and
  explicit grid track lines (no code shared with core).
- `fixtures/v1.json`: 29 versioned fixtures (flip-block, flip-inline, both, ordering, named `@position-try`,
  bare-area fallback, most-height, most-width, anchors-visible, no-overflow, rtl, keyboard viewport, none-fits).
  Expected values were produced by the reference and hand-checked; change them only by adding `v2.json`.
- `core/src/overlay/__parity__/parity.test.ts`: every fixture through fallback and reference, plus a 2000-run
  fast-check property over random rectangles/policies, plus a seeded divergence that must differ.
- `fixtureCss(f)` emits the native CSS for the L6 lane.

## Size (ADR-011, `node packages/testing/size/cli.js`)

overlay row: **1.444 KiB gzip** (3061 B raw) of the 4 KiB ceiling, so **2.556 KiB headroom** for W1-109.

## Open items

- L6 native lane (Chromium >= 125 against `fixtureCss`) is not scripted: the harness needs a browser lane
  that does not exist yet. The reference evaluator is certified against the spec text, not yet a real browser.
- `fixtureCss` is exported but not tested in a browser.
