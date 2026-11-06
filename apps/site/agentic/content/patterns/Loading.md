---
id: loading
title: Loading
group: patterns
storybookTitle: Patterns/Loading
summary: When to use a skeleton, a spinner, or a button busy state, the 300ms delay and 500ms minimum timing tokens, layout-mirroring shapes with no layout shift, reduced-motion, forced-colors and RTL behavior, and announce-once accessibility for SJSkeleton
---

A loading state is a promise about what arrives next. Keep it honest: wait before showing anything, mirror the final layout so nothing moves when content lands, and say it once to assistive tech. The skeleton is one of three tools, and most loading problems come from reaching for the wrong one.

## 1. Using SJSkeleton

One component, `SJSkeleton`, with a `shape` prop. The `group` shape is the container: it owns timing, `aria-busy`, and the announcement. The other shapes are the placeholders you put in its `skeleton` slot. Stories live under Components/Skeleton in Storybook.

| Part | Values | Notes |
| --- | --- | --- |
| `shape` | `group`, `text`, `circle`, `rect`, `block` | Default `block`. `group` is the container. |
| `lines` (text) | 1 to 12, default 3 | The last line is shorter, `--skeleton-line-last-width` (60%). |
| `ratio` (rect) | `1/1`, `4/3`, `3/2`, `16/9`, `21/9` | Reserves media height from width. |
| `size` (circle) | `sm`, `md`, `lg`, `xl` | `--skeleton-avatar-sm` to `--skeleton-avatar-xl` (32, 40, 48, 64px). |
| `animation` | `shimmer`, `none` | Shimmer is static under reduced motion either way. |
| `loading` (group) | default `true` | Flip to `false` when data arrives. |
| `delay`, `minDuration` (group) | ms; default tokens 300 and 500 | `--motion-skeleton-delay`, `--motion-skeleton-min-duration`. |
| `announce` (group) | string | The single polite announcement once the skeleton becomes visible. |
| slots (group) | `skeleton`, default | `skeleton` holds the placeholder shapes; default holds the loaded content. |

```vue
<SJSkeleton shape="group" :loading="loading" announce="Loading activity">
  <template #skeleton>
    <SJSkeleton shape="circle" size="md" />
    <SJSkeleton shape="text" :lines="2" />
  </template>
  <ActivityList :items="items" />
</SJSkeleton>
```

The group lays the placeholder out immediately but keeps it invisible during the delay, so the space is reserved from the first frame. `SJState` with `variant="loading"` accepts a `skeleton` slot, rendered in a new `skeleton` part.

## 2. Skeleton, spinner, or button busy state

Three indicators answer three different questions. Ask them in order. Did the user just press something? Is a region or page loading with a known layout? Is the wait short, open ended, or very long? The first yes picks the tool.

**Rule:** Use a skeleton only when the final layout is known and a region or page is loading.
**Why:** a skeleton is a promise about structure. NN/g recommends skeletons that match the final layout because they help users build a mental model, and Fluent 2 sends unknown structures to a spinner or progress bar. Polaris says to mirror the loaded layout.

- ✓ Recommended: `<SJSkeleton shape="group" :loading="pending">`. An activity feed whose avatar, title line, and two body lines are known before the data arrives.
- ✕ Avoid: `<SJSkeleton shape="block" />`. A block standing in for search results of unknown shape. The swap changes the layout, which is a shift and a broken promise.

**Rule:** Use a spinner with text for an unknown layout or a short indeterminate wait of roughly 1 to 10 seconds.
**Why:** NN/g recommends looped animation for roughly 2 to 10 seconds, ideally with text explaining the wait, and Atlassian shows a spinner only if the expected wait is more than a second. A spinner makes no structural promise, so it cannot be wrong about the layout.

- ✓ Recommended: `Spinner + "Loading comments"`. The words tell the user what the wait is for, and the spinner shows the system is alive.
- ✕ Avoid: `Static "Loading..." text, or a bare spinner over a known layout`. No motion means no sign of life, and a bare spinner over a known layout wastes the structure a skeleton would show.

**Rule:** Put the busy state on the button for an action the user just triggered.
**Why:** NN/g says an action under about a second needs only an immediate visual change such as a button state change, and that the first click must visibly register. The user is looking at the control, not at a region.

- ✓ Recommended: `Save  ->  Saving (repeat press ignored)`. The control confirms the press instantly, keeps its width, and the result lands where the user is already looking.
- ✕ Avoid: `Replace the form with a skeleton after Save`. A skeleton promises incoming content. After an action there is no content to promise, and the form the user was editing vanishes.

**Rule:** Use a progress bar with an estimate for work over about 10 seconds or any measurable job such as an upload or export.
**Why:** NN/g: "Anything above 10 seconds requires an explicit estimation of duration," and it limits skeletons to loads that are not downloads, uploads, or conversions. Carbon also moves longer processes to a progress indicator.

- ✓ Recommended: `Progress bar + "Exporting 3 of 50" + Cancel`. Percent or step count lets the user decide whether to wait, and a way to stop respects their time.
- ✕ Avoid: `An endless shimmer over a 40 second export`. No end in sight, no way out, and motion that runs far past the 5 second line in WCAG 2.2.2.

## 3. Timing: nothing under 300ms, then at least 500ms

Both numbers are tokens. They are conventions, not laws: NN/g says a load under 1 second needs no skeleton or spinner, and design systems that state a delay use 300ms (Learning Equality) with a 400ms minimum. We chose 300ms and 500ms. No study found backs those exact values.

| Data arrives at | The user sees |
| --- | --- |
| 0 to 300ms | Content directly. The placeholder space was reserved but never painted. |
| 300 to 800ms | Skeleton from 300ms, content at 800ms (the 500ms minimum). |
| After 800ms | Skeleton from 300ms, content the moment data arrives. |

**Rule:** Do not show a skeleton for a load that ends within 300ms, `--motion-skeleton-delay`.
**Why:** under about a second the user's flow of thought is intact, and NN/g notes a flashing placeholder makes a fast page harder to follow. Showing nothing is the fastest-feeling answer.

- ✓ Recommended: `Response at 180ms: content appears, no skeleton was ever painted`. The user sees one state change, from the old view to the new content.
- ✕ Avoid: `Skeleton painted for 180ms, then replaced`. The placeholder flashes in and out, which reads as flicker and costs attention for no information.

**Rule:** Once a skeleton is visible, keep it at least 500ms, `--motion-skeleton-min-duration`.
**Why:** content that arrives just after the delay would show the placeholder for a few frames and remove it. A minimum display time turns that flash into a readable beat. The cost is up to 500ms of extra wait in that narrow band, accepted on purpose.

- ✓ Recommended: `Response at 320ms: skeleton from 300ms, content at 800ms`. The skeleton lasts long enough to register and the swap is clean.
- ✕ Avoid: `Remove the skeleton the moment data arrives, whatever the elapsed time`. A placeholder visible for 20ms is a flash, not a state.

**Rule:** Read both values from the tokens and leave the defaults alone unless a flow has a measured reason.
**Why:** one pair of numbers keeps every surface in the system feeling the same, and the tokens carry the sourcing in their descriptions.

- ✓ Recommended: `<SJSkeleton shape="group" :loading="pending">`. The group reads `--motion-skeleton-delay` and `--motion-skeleton-min-duration` for you.
- ✕ Avoid: `<SJSkeleton shape="group" :delay="150" :min-duration="2000">`. Hand-tuned numbers per screen drift apart, and a long minimum makes fast data feel slow.

## 4. Shape mirrors the layout and reserves its space

The point of a skeleton is that the swap moves nothing. web.dev calls a Cumulative Layout Shift of 0.1 or less good; the target here is 0 for the swap. The demo below renders the placeholder and the loaded content at identical sizes.

**Rule:** Make the placeholder the same size as the content it stands in for, so the swap causes no layout shift.
**Why:** web.dev says to reserve sufficient space in advance with a placeholder or skeleton, and that removing reserved space "can cause just as much CLS as inserting content." The group reserves the space even during the 300ms delay.

- ✓ Recommended: `text lines = expected lines; circle size = avatar size; rect ratio = media ratio`. Three lines in, three lines out. The heading below does not move.
- ✕ Avoid: `One tall block for a three row list, or no placeholder until 300ms`. The content lands at a different height and everything under it jumps.

**Rule:** Build the placeholder from the shape primitives: text lines, a circle for avatars, a rect with a ratio for media.
**Why:** NN/g recommends skeletons whose gray boxes match the text and images of the final layout and warns against frame-only skeletons that show nothing about structure. Polaris matches line count to the content.

- ✓ Recommended: `<SJSkeleton shape="rect" ratio="16/9" />`. The ratio reserves the media height from the width before the image loads, the same idea as CSS `aspect-ratio`.
- ✕ Avoid: `A header, a footer, and an empty middle`. A frame-only skeleton gives no sense of structure and can look like the page is broken.

**Rule:** Keep static content real and skeleton only the parts that load.
**Why:** Polaris says to keep fixed elements, such as a title that never changes, as real content, and not to use placeholder content for titles that will change. A fake title is something the user must unlearn.

- ✓ Recommended: `Real "Recent activity" heading + skeleton rows`. The user orients on the heading immediately and waits only for the rows.
- ✕ Avoid: `Skeleton for a heading that is always the same`. It delays something you already know and adds shimmer for no reason.

Demo (omitted here): a skeleton card and the loaded card at identical size, so the swap shifts nothing. Avatar `--skeleton-avatar-md`, text lines `--skeleton-line-height` with a 60% last line, a 16/9 media block.

## 5. Motion, forced colors, and direction

The shimmer is a hint, not a feature. It signals that work is going on, it is slow (`--motion-skeleton-shimmer`, 1600ms per pass), and it has three fallbacks.

**Rule:** Use a slow, subtle shimmer and make it static under `prefers-reduced-motion`.
**Why:** NN/g says animation signals activity but should stay subtle because it can distract or cause accessibility problems. MDN: the reduce setting asks for motion to be removed, reduced, or replaced. Under reduce the placeholder keeps its flat base fill and still reads as a placeholder.

- ✓ Recommended: `@media (prefers-reduced-motion: reduce) { shimmer off }`. The shape and the announcement carry the meaning, so nothing is lost when the sweep stops.
- ✕ Avoid: `A fast pulse or bounce, or a shimmer that ignores the preference`. Fast or large motion is a vestibular trigger, and an always-on loop is the content WCAG 2.2.2 says needs a stop control.

**Rule:** Under `forced-colors: active`, draw a border and drop the gradient.
**Why:** MDN: in forced colors mode author background colors are ignored, non-url background images become none, and box-shadow becomes none. A fill-only placeholder vanishes. A border in a system color survives.

- ✓ Recommended: `@media (forced-colors: active) { border: 1px solid CanvasText }`. The outline of each block is still drawn in the user's own palette.
- ✕ Avoid: `Fill or shadow as the only way a block is visible`. In Windows High Contrast the user sees an empty page with no sign anything is loading.

**Rule:** Flip the shimmer direction in right-to-left layouts.
**Why:** a sweep should travel the way the user reads. Logical properties flip layout for you, but there is no logical property for an animation, so the sweep is mirrored explicitly.

- ✓ Recommended: `Sweep runs inline-start to inline-end (right to left in RTL)`. The motion agrees with the reading direction in Arabic and Hebrew, as the layout around it does.
- ✕ Avoid: `A hard-coded `translateX(100%)` that always travels left to right`. In RTL it moves against the text, which reads as a mistake.

## 6. Accessibility: hide the shapes, announce once

A skeleton is a picture of loading, and a screen reader cannot use a picture. Support for `aria-busy` is uneven (Roselli found only JAWS honored it in 2020, not re-tested here), so the semantics are set but the announcement never depends on them.

**Rule:** Set `aria-busy="true"` on the container and `aria-hidden="true"` on the placeholder blocks.
**Why:** MDN: `aria-busy` tells assistive tech the region is being modified and that it may wait before announcing, and `aria-hidden` removes decorative content from the accessibility tree. Without the hidden blocks a screen reader can walk through empty boxes. Never hide a focusable element.

- ✓ Recommended: `<div aria-busy="true"> <span aria-hidden="true"> ...shapes... </span> </div>`. Semantics on the region, silence on the shapes, and the group sets both for you.
- ✕ Avoid: ``aria-busy` alone, as the only signal`. Most screen readers ignore it, so the user hears nothing or hears empty placeholders.

**Rule:** Announce once through a polite status message when the skeleton becomes visible, and never ship a skeleton with no text announcement.
**Why:** WCAG 4.1.3 requires status messages to be exposed without moving focus. A silent skeleton tells a screen reader user nothing is happening. Use `announce`, which writes to a polite live region, not an assertive one, once, when the skeleton becomes visible.

- ✓ Recommended: `<SJSkeleton shape="group" announce="Loading activity">`. One short sentence, spoken once, in the user's idle moment.
- ✕ Avoid: ``role="alert"` or assertive on a skeleton, or one announcement per block`. It interrupts, repeats, and shouts about something that is not an emergency.

**Rule:** Inside `SJState` with `variant="loading"`, leave `announce` off the inner group.
**Why:** the state already carries the message that tells the user what is loading. A second live region speaks the same thing twice. The skeleton slot is visual only.

- ✓ Recommended: `<SJState variant="loading"> <template #skeleton>...</template> </SJState>`. One layer speaks, one layer draws.
- ✕ Avoid: `A skeleton group with `announce` inside an SJState that already announces`. The user hears "Loading" twice in a row.

## 7. What a skeleton is not for

A skeleton means content is on the way. If nothing is on the way, or the wait has gone wrong, it says the wrong thing.

**Rule:** Do not use a skeleton for actions, errors, or empty states. Use the button busy state, or `SJState`.
**Why:** Carbon says action components such as buttons and inputs usually do not need skeletons and that toasts, menus, and modals do not get them. An error or an empty result needs words and a next step, which a gray shape cannot give.

- ✓ Recommended: `Load failed: SJState variant="error" with Retry. Zero rows: SJState variant="empty"`. The user learns what happened and what to do.
- ✕ Avoid: `A skeleton left shimmering after the request failed, or as the "empty" view`. It reads as forever loading, with no way out and no explanation.

**Rule:** Time-box the skeleton: when a load runs long, switch to progress or an error.
**Why:** Carbon says skeletons "should only appear for only a few seconds." A looping shimmer that outlasts the wait invites the question whether the page is broken, and WCAG 2.2.2 expects auto-starting motion beside other content to be stoppable after 5 seconds.

- ✓ Recommended: `After a long wait, swap to progress with an estimate, or to an error with Retry`. The state follows what is actually happening.
- ✕ Avoid: `A 30 second shimmer with no timeout`. The user cannot tell slow from stuck.

## 8. Restraint: one level, few blocks

More shimmer is not more helpful. A calm screen shows the structure and keeps motion low.

**Rule:** Use one level of skeleton per region and keep the number of independently shimmering blocks small.
**Why:** Fluent 2 keeps simultaneous skeleton animations in sync so the page does not feel fragmented, and nesting a placeholder in a placeholder adds motion without adding information. The block count is judgment, not research: group rows into one region and let `text` with `lines` stand for a paragraph.

- ✓ Recommended: `One group per region; `text` with `lines="3"` for a paragraph`. A few calm blocks that read as the page layout.
- ✕ Avoid: `Nested groups, or forty independent rows each shimmering on its own clock`. Visual noise that competes with the content that is about to arrive.

## 9. Contrast: the fill is decorative

The placeholder fill, `--skeleton-color-base`, is deliberately low contrast: slate 200 on white is 1.23:1, and the highlight on the base is 1.13:1 (computed with the WCAG relative-luminance formula). This is a decision with a counter-argument, and both are stated here.

**Rule:** Treat the placeholder fill as decorative: do not raise it to the 3:1 non-text floor, and carry the meaning in text and in the forced-colors border.
**Why:** WCAG 1.4.11 excludes graphics "for aesthetic purposes that does not require the user to see or understand it." The shapes are hidden from assistive tech, the announcement carries the loading state, and in forced colors each block gets a `CanvasText` border. Roselli argues skeletons convey state and so fail 1.4.11. W3C does not address skeletons, so the decorative reading is an interpretation. A louder fill would compete with the content it stands in for.

- ✓ Recommended: `Hidden shapes + announced state + forced-colors border`. No meaning depends on the fill, so nothing depends on its contrast.
- ✕ Avoid: `Letting the placeholder be the only place a status or a label appears`. If a block carries meaning, it is content, not a placeholder, and it must pass 4.5:1 or 3:1 as content does.

## Sources

NN/g skeleton screens, response-time limits, and progress indicators. web.dev CLS, Optimize CLS, and aspect-ratio. IBM Carbon loading pattern. Atlassian spinner and skeleton. Shopify Polaris v1 skeleton docs. Microsoft Fluent 2 skeleton. Timing conventions from Learning Equality loaders, spin-delay, and the Doherty threshold. MDN aria-busy, aria-hidden, live regions, prefers-reduced-motion, and forced-colors. WCAG 2.2 Understanding 1.4.11, 2.2.2, and 4.1.3. Adrian Roselli, More Accessible Skeletons. The full research note with unverified claims is docs/research/skeleton-2026.md.
