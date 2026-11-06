# C13 notes (SJSkeleton)

Branch `feature/sj-skeleton`. Source decision: patterns decisions item 13 (skeleton loading). Template: SJState (C11).
The component number is the next free one after C12; it is not in the architecture tables yet.

## Final API

One component, `SJSkeleton`, in all three adapters. `shape` picks what it is.

| Prop | Values | Notes |
| --- | --- | --- |
| `shape` | `group`, `text`, `circle`, `rect`, `block` (default `block`) | unknown falls back to `block` with a dev warning |
| `lines` | 1..12 (default 3) | text only; the last line is shorter (`--skeleton-line-last-width`, 60%) |
| `ratio` | `1/1`, `4/3`, `3/2`, `16/9` (default), `21/9` | rect only; CSS `aspect-ratio` reserves the height |
| `size` | `sm`, `md` (default), `lg`, `xl` | circle only; 32, 40, 48, 64 px from `--skeleton-avatar-*` |
| `animation` | `shimmer` (default), `none` | static under reduced motion and forced colors either way |
| `loading` | boolean (default true) | group only |
| `delay`, `minDuration` | ms | group only; default from the motion tokens |
| `announce` | string | group only; the one polite announcement |

Slots (group only): `skeleton` (Vue slot, React prop, vanilla option) is the placeholder; the default slot (Vue default slot,
React `children`, vanilla option `default`) is the loaded content. A block is sized with `--sj-skeleton-width` and
`--sj-skeleton-height`. `<sj-skeleton>` is available in vanilla through `define(host)` (explicit, never at import).

SJState: `variant="loading"` accepts a `skeleton` slot, drawn in a new `skeleton` part (`div`, `aria-hidden`) after the
description and before the actions. It is ignored for every other variant. The state keeps its own heading/announce, root
`aria-busy` and live registry behaviour; it does no timing.

## Decisions and ambiguities

- **Why one component with a `shape` prop, not five.** Five contracts would mean five adapters times three. The shapes share
  one anatomy (root, plus `line` for text), one stylesheet and one set of a11y rules, so they are one contract, like SJIcon's
  `size`. The group is the same component because it is the same element with extra behaviour; `shape` is the discriminator.
- **Timing lives in core, over the injected scheduler.** `createSkeletonTiming({ after, delay, minDuration, onPhase })` is a pure
  controller: `idle -> pending -> visible -> holding -> idle`. A load that ends in `pending` goes straight to `idle` (the
  skeleton never became visible, so it never flashes and never announces). The minimum duration starts when the skeleton becomes
  visible; a load that ends earlier waits in `holding`. It uses `runtime.scheduler.after` only (the server scheduler never
  fires), so SSR starts no timer. The contract `runtime` lists `scheduler`.
- **Both values are tokens**: `--motion-skeleton-delay` (300ms), `--motion-skeleton-min-duration` (500ms), plus
  `--motion-skeleton-shimmer` (1600ms). The adapters read them from the root with `getComputedStyle` after mount (props win;
  the core constants `SKELETON_DELAY_MS`/`SKELETON_MIN_DURATION_MS` are the no-DOM fallback, and a core test fails if they
  drift from `motion.json`).
- **No layout shift by construction.** The group renders the placeholder from the first render and hides it with
  `visibility: hidden` while `pending`, so it occupies its space during the delay. When the content replaces it, the
  consumer's skeleton (which mirrors the layout) and the content have the same box. `rect` reserves height with
  `aspect-ratio`; text lines have a fixed block size from a token. Asserted with a `layout-shift` observer in the e2e.
  `@media (scripting: none)` shows a pending group (a server render with no script has no timer).
- **Colour.** Fill `--skeleton-color-base` (slate 200) with a `--skeleton-color-highlight` (slate 100) sweep. The placeholder is
  decorative (`aria-hidden`; the loading text and announcement carry the meaning), so WCAG 1.4.11 does not require 3:1, and the
  fill is deliberately quiet (about 1.2:1 on white, as in Material, Carbon and Polaris). Where structure must stay perceivable,
  forced colors replaces backgrounds, so each shape gets a 1px `CanvasText` border (border-box, no size change). If a product
  needs the shapes to carry structure, it should use a border token at 3:1 on those blocks instead; that is a product choice,
  not the default. Recorded as an open question.
- **Motion.** Subtle, a 1600ms pass repeated 3 times (4.8s), then at rest: moving content that starts automatically and lasts more than 5 seconds next to other content needs a pause mechanism (WCAG 2.2.2), so the sweep stops by itself under that limit. Under `prefers-reduced-motion` the sweep and the gradient are removed (a flat fill): the
  base motion net only zeroes durations, which would leave a frozen gradient, so `skeleton.css` removes the animation in
  `sj.state`. This also satisfies WCAG 2.2.2 for content that moves for more than five seconds. Forced colors drops the sweep.
- **RTL.** `animation-direction: reverse` under `:dir(rtl)` (with the `[dir='rtl']` fallback block, as disclosure.css). Layout
  uses logical properties only.
- **A11y.** Shapes are `aria-hidden="true"` and never busy. The group has `aria-busy="true"` in `pending`, `visible` and
  `holding`, never `role` or `aria-live` (core deletes a consumer's). The single announcement goes through the shared live
  registry (`liveRegions: status`, polite, `skeletonLive` is `eager`, imported from the generated file) after mount, when the
  group becomes visible; a load that ends inside the delay announces nothing.
- **No double announcement.** The group announces only when `announce` is set. Inside SJState the state announces its heading, so
  put no `announce` on a skeleton there; the registry also de-duplicates identical consecutive text. Documented, tested.
- **SJState has no timing.** The `skeleton` slot renders whenever the variant is `loading`. A consumer that wants the delay
  wraps the loading region in `SJSkeleton shape="group"` and puts SJState's content in it.
- **Contract machine is `idle` only**, as SJState: the timing phase is derived (like `variant`), not reducer state, so
  `reducer.ts` exists for discovery only.

## Barrels

`@ramoslabs/vue` and `@ramoslabs/react` now export `SJSkeleton`. While adding it I found `SJButton` missing from both barrels
(the per-component subpath existed, the root export did not); it is added in the same change, with the barrel tests updated.
The vanilla barrel is intentionally empty (ADR-002), so vanilla keeps the subpath entries only (`@ramoslabs/vanilla/skeleton`).

## Files

Contract `packages/contracts/contracts/skeleton.contract.json` (and a `skeleton` part and slot in `state.contract.json`); core
`packages/core/src/skeleton/`; tokens `packages/tokens/src/tokens/skeleton.json` and `motion.skeleton.*`; CSS
`packages/css/src/skeleton.css` (+ `.sj-state__skeleton`); adapters `packages/{vue,react,vanilla}/src/skeleton/`;
conformance `packages/testing/specs/skeleton/`; stories `apps/storybook/stories/components/Skeleton.stories.ts`; research
`docs/research/skeleton-2026.md`.
