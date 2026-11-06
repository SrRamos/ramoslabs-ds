# Skeleton and loading states: research note (2026)

Scope: evidence behind SJSkeleton and the Loading pattern. Every URL below was fetched on 2026-11-06. Quotes are short and taken from the fetched text. Anything not confirmed is marked **unverified**.

## Summary and decisions

| Decision | Value | Source |
| --- | --- | --- |
| Show nothing for loads that finish quickly | `--motion-skeleton-delay` = 300ms | Convention, not a study: Learning Equality "Apply 300ms delay" [S14]; Firefox/Queensland cite 200ms via search only (unverified, see Timing). NN/g: under 1s skip both skeleton and spinner [S1]. Doherty 400ms feedback target [S8] |
| Keep it visible once shown | `--motion-skeleton-min-duration` = 500ms | Convention: Learning Equality 400ms minimum [S14]; spin-delay defaults 500ms delay, 200ms minDuration [S15]; React keeps skeleton "up to 500 ms" for images [S9]. 500ms is our choice, no study found |
| Skeleton only when final layout is known and a region/page loads | Region or page | NN/g: full-page loads [S1]; Fluent 2: unknown structure uses progress bar or spinner [S19]; Polaris: mirror loaded layout [S12] |
| Spinner for unknown layout or short indeterminate waits | About 1 to 10s | NN/g: looped animation for roughly 2 to 10s with text [S3]; Atlassian: spinner only if wait is more than a second [S13] |
| Progress bar for long or measurable work | Over about 10s, or uploads and conversions | NN/g [S2][S3], Carbon [S5] |
| Button busy state for an action the user just triggered | Immediate change on the control | NN/g: "Immediate visual change only (e.g., a button state change)" under 1s [S3]; Atlassian LoadingButton [S13]; Carbon inline indicator [S5] |
| Not for actions, errors, empty | Use SJState | Carbon: action components and modals do not get skeletons [S5]; Polaris: static content stays visible [S12] |
| Reserve space so swap causes no shift | CLS 0 target, at most 0.1 (good) | web.dev CLS [S4][S6] |
| Shimmer subtle, static under reduced motion | `--motion-skeleton-shimmer` = 1600ms | NN/g subtle animation [S1]; MDN prefers-reduced-motion [S20]; WCAG 2.2.2 [S18] |
| forced-colors: draw a border | `CanvasText` border | MDN forced-colors [S21] |
| RTL: flip shimmer direction | Logical direction, mirror sweep | MDN logical properties [S22]; rtlstyling.com mirrors directional animation [S23] |
| Container `aria-busy="true"`, blocks `aria-hidden`, one polite announcement | Single live region message | MDN aria-busy/aria-hidden/live regions [S16][S17][S24]; Roselli [S11]; WCAG 4.1.3 [S25] |
| Placeholder fill is decorative, exempt from 1.4.11 | slate-200 on white is 1.23:1 | W3C Understanding 1.4.11 [S26]. **Contested**: Roselli treats low-contrast skeletons as a 1.4.11 failure [S11] |
| One level of nesting, few shimmering blocks | Flat placeholder | Fluent 2: sync animation, wave default [S19]. "Few blocks" threshold is a DS decision, no source |

## Per-topic findings

### NN/g: skeleton screens, response times, progress indicators

- Response-time limits [S2]: 0.1s feels instantaneous (only the result needs showing); 1s keeps flow of thought but the user notices the delay; about 10s is the limit for keeping attention, and beyond it users need percent-done feedback plus a clearly signposted way to interrupt.
- Skeleton screens [S1]: use a skeleton for full-page loads; a spinner for single modules (about 2 to 10s); a progress bar for downloads, uploads, conversions; "Anything above 10 seconds requires an explicit estimation of duration." Loads under 1 second: skip both, because the flashing placeholder makes the page harder to follow. Static-content and image skeletons that match the final layout are recommended; frame-only skeletons (header, footer) are not. Animation signals activity but should stay subtle. Skeletons make waits feel shorter but do not replace performance work.
- Progress indicators [S3]: "Use a progress indicator for any action that takes longer than about 1.0 second." Under 1s: immediate visual change only, no looped animation. 1 to 10s: looped animation, ideally with text such as "Loading comments". 10s or more: percent-done. Avoid static "Loading..." text.
- Tension to note: NN/g puts modules at spinner and full pages at skeleton [S1]; Fluent 2 and Polaris use skeletons for regions inside a page [S12][S19]. The DS rule follows the layout-known test (Fluent, Polaris) and keeps NN/g's spinner for unknown layout.

### web.dev: layout shift

- CLS: "0.1 or less" is good, above 0.25 is poor, measured at the 75th percentile [S4]. Common causes include images or videos with unknown dimensions and content added dynamically before existing content [S4].
- Reserving space [S6]: use `min-height`; use `aspect-ratio` for responsive content; "Removing the space set aside for elements can cause just as much CLS as inserting content"; for UI that appears later, "reserve sufficient space in the viewport for it in advance," such as with a placeholder or skeleton UI; if content takes more than 500 ms to arrive, reserve the expected space up front.
- `aspect-ratio` "can create placeholder space to prevent Cumulative Layout Shift" [S7].
- web.dev says it is best to "create some space right away and show a loading indicator" for user-initiated loads [S4]. This supports SJSkeleton laying the placeholder out immediately and keeping it invisible during the delay.
- Reduced shift budget: the DS target of CLS 0 for the swap is stricter than the 0.1 threshold; it is a DS choice.

### Material Design 3

- **Unverified.** m3.material.io progress-indicator and loading-indicator guideline pages returned only a title (client-rendered), and the guidelines URL path I tried for progress indicators returned 404. No M3 text was read.
- What was read: the Material Web progress doc says to add `aria-label` to each progress indicator (e.g. "Download progress") [S27]. A search summary of the older Material 2 guidance says determinate indicators are for when completion rate can be detected and indeterminate for unknown waits (secondary source, not fetched directly: [S28]).
- Material has no skeleton component in the pages read. Treat M3 as unverified for skeleton guidance.

### IBM Carbon

- Loading pattern [S5]: skeletons are simplified placeholders for initial page load that "should only appear for only a few seconds"; for container-based and data-based components; action components such as buttons and inputs usually do not need them; not for toasts, overflow menus, dropdown items, or modals (content inside a modal may use one). Loading indicators signal an action is processing: full-screen when the whole app is busy, inline when one component is. Use a progress indicator when the process takes more than a moment or two. "A screen reader should notify a user if an application is loading, busy, gets stuck, or if a process fails." No millisecond values are given.
- The dedicated skeleton-states usage page returned 404 in two URL forms; **unverified**.

### Shopify Polaris

- Only versioned v1.x docs were reachable (unpkg copies of the Polaris README for SkeletonPage and SkeletonBodyText [S12]); the live polaris-react.shopify.com URLs 301 to shopify.dev, which has no skeleton guidance in the page fetched. Treat as older guidance, **current-version status unverified**.
- Findings [S12]: skeleton for "pages where all content loads at the same time"; skeleton content for dynamic parts, keep static elements (a title that never changes) real; "give merchants an indication of what the page layout will be once loaded"; mirror the loaded layout and match the number of actions; `SkeletonBodyText` `lines` default 3, `lines={1}` for a timestamp; match line count to content; "Don't use placeholder content for titles that will change." Progress bar or spinner for in-context operations.
- `SkeletonDisplayText` is described as representing headings (size small in examples). `SkeletonThumbnail` was not mentioned in any fetched text; its role is **unverified**.
- Accessibility guidance: none in the fetched Polaris text.

### Atlassian

- Skeleton component [S13a]: a placeholder "usually while the content loads"; shape via width, height, borderRadius; shimmer is optional (`isShimmering`). The page has no accessibility or reduced-motion guidance.
- Spinner usage [S13]: "Only show a spinner if the expected wait time is more than a second"; one spinner per page at a time; place it in the part of the page that is updating; use `LoadingButton` for button-triggered loading. The atlassian.design/foundations/loading and skeleton usage URLs returned 404 or no skeleton content.

### Timing: "show nothing under about 300ms, then keep at least about 500ms"

Evidence is convention plus general response-time research, not a controlled study of skeleton timing. I did not find a peer-reviewed or NN/g source for 300ms or 500ms specifically.

- Nielsen limits [S2]: 0.1s, 1s, 10s as above. Under 1s the flow of thought is intact, so an indicator is optional.
- Doherty threshold [S8]: 400ms feedback target (Doherty and Thadani, IBM Systems Journal, 1982, as summarized by Laws of UX, a secondary source). Supports keeping any visible loading feedback prompt once it is needed, not a delay value.
- Design systems that state numbers [S14]: Learning Equality design system says wait 300ms before showing a loading indicator and keep it at least 400ms; its skeleton card grid applies both by default.
- Libraries [S15]: spin-delay defaults delay 500ms, minDuration 200ms, with the rationale that a very fast request can make a spinner do "more harm than good" and that flicker "can be annoying."
- React [S9]: Suspense reveals content at most once every 300ms; React keeps a skeleton visible up to 500ms while a ViewTransition image loads; Transitions keep already-revealed content instead of hiding it behind a fallback. These are internal React timings, not UX guidance.
- Firefox Acorn (200ms delay, 400ms minimum) and Queensland Design System (about 200ms delay) were only seen through a web search summary; their pages returned no usable text or 403. **Unverified.**
- GOV.UK: not found stating a delay. **Unverified.** Luke Wroblewski: no source found. **Unverified.**
- Known tradeoff: a delay can still produce a flash when the load ends just after the delay, and a minimum display time lengthens perceived load (developer commentary found via search, not primary research). The DS accepts that cost for the 300ms to 500ms band because a flicker is worse than a short extra wait; this is a judgment call.

### Accessibility

- `aria-busy` [S16]: MDN says it indicates "whether an element is currently being modified," helps assistive tech "wait before informing users of the update," is used with live regions, and tells a feed to suppress non-user-initiated announcements. MDN does not document per-AT behavior.
- AT support caveat [S11]: Roselli (2020) found "only JAWS 2020 honors it"; NVDA, Narrator, TalkBack, VoiceOver "treat this content as any other." That data is from 2020 and was not re-tested here; current support is **unverified**. Fluent 2 still recommends `aria-busy` with skeletons inside a live region [S19]. Decision: set `aria-busy` as semantics, never rely on it for the announcement.
- Hiding placeholders [S17][S11]: `aria-hidden="true"` on the shapes removes decorative content from the accessibility tree; never on or above focusable elements; it does not visually hide anything. Roselli pairs `aria-busy` with `aria-hidden` and keeps a visually hidden "Loading" text.
- Live region [S24][S25]: use `role="status"` (implicit polite live region); the region must exist before its content changes; the announcement must not move focus (WCAG 4.1.3). MDN warns `role="alert"` plus `aria-live` double-speaks in VoiceOver on iOS. Roselli warns against `alert` with `polite` on skeletons [S11]. Decision: one polite status message when the skeleton becomes visible; never announce a skeleton that has no text announcement; when inside SJState do not announce twice.
- WCAG 1.4.11 [S26]: 3:1 applies to UI components and graphics needed to understand content; excludes graphics "for aesthetic purposes that does not require the user to see or understand it." Placeholder fill `--skeleton-color-base` (slate-200) against white is 1.23:1, and highlight on base is 1.13:1 (computed with the WCAG relative-luminance formula). DS position: the fill is decorative because it is hidden from AT and meaning is carried by the text announcement and the surrounding labels. Contested: Roselli argues skeletons convey state and fail 1.4.11 [S11]. The W3C Understanding page does not mention skeletons; whether a loading placeholder is "decorative" is an interpretation, **unverified by W3C**.
- WCAG 2.2.2 Pause, Stop, Hide [S18]: auto-starting moving content that lasts more than 5 seconds and is presented in parallel with other content needs a pause, stop or hide mechanism. Exception: a loading animation that is the only content on the page. A region skeleton sits beside other content, so the exception does not clearly cover it. Roselli stops his animation after 5 seconds and notes the loader exemption is not a blanket rule [S11]. Open item for the component: stop the shimmer after 5s, or rely on reduced motion plus short loads. **Not verified in SJSkeleton.**
- `prefers-reduced-motion` [S20]: `reduce` means the user wants motion removed, reduced or replaced. Decision: the shimmer is static (flat base fill) under `reduce`.
- `forced-colors` [S21]: author `background-color` is ignored, non-url `background-image` becomes none, `box-shadow` becomes none, border colors become system colors. MDN's own example swaps a shadow for a `ButtonText` border. Decision: under `forced-colors: active` draw a `CanvasText` border, drop the gradient.
- RTL [S22][S23]: logical properties flip inline layout automatically, but a gradient sweep or `translateX` animation has no logical property; it must be mirrored explicitly (rtlstyling.com mirrors an animation with `scaleX(-1)` and a flipped `translateX`). Decision: the sweep travels inline-start to inline-end, so it runs right to left in RTL. The component implementation of this was not checked.

### Skeleton vs spinner vs button busy state: decision rule

1. Did the user just trigger an action on a control (save, submit, send)? Put the busy state on that control, keep its label, disable repeat activation, announce progress through the live region. NN/g: show that the first click was accepted [S3]; Atlassian `LoadingButton` [S13]; Carbon inline indicator [S5].
2. Else, is a region or page loading and is the final layout known (rows, cards, text, media)? Use a skeleton that mirrors it [S1][S12][S19].
3. Else, is the layout unknown, or is it a short indeterminate wait (about 1 to 10s)? Use a spinner with text [S3][S13][S19].
4. Else, is the wait over about 10s or measurable (upload, export)? Use a progress bar with an estimate and a way to stop [S2][S3].
5. Under about 1s (DS: under 300ms): show nothing [S1][S3].
6. Errors and empty results are never a skeleton: use SJState [S5].

## Sources

- [S1] NN/g, Skeleton Screens 101: https://www.nngroup.com/articles/skeleton-screens/
- [S2] NN/g, Response Times: The 3 Important Limits: https://www.nngroup.com/articles/response-times-3-important-limits/
- [S3] NN/g, Progress Indicators Make a Slow System Less Insufferable: https://www.nngroup.com/articles/progress-indicators/
- [S4] web.dev, Cumulative Layout Shift: https://web.dev/articles/cls
- [S5] IBM Carbon, Loading pattern: https://carbondesignsystem.com/patterns/loading-pattern/
- [S6] web.dev, Optimize Cumulative Layout Shift: https://web.dev/articles/optimize-cls
- [S7] web.dev, aspect-ratio: https://web.dev/articles/aspect-ratio
- [S8] Laws of UX, Doherty Threshold: https://lawsofux.com/doherty-threshold/
- [S9] React docs, Suspense: https://react.dev/reference/react/Suspense
- [S11] Adrian Roselli, More Accessible Skeletons (2020, updated 2023): https://adrianroselli.com/2020/11/more-accessible-skeletons.html
- [S12] Shopify Polaris v1.x docs (older versions): https://unpkg.com/@shopify/polaris@1.12.2/docs/components/SkeletonPage/README.md and https://unpkg.com/@shopify/polaris@1.8.3/docs/components/SkeletonBodyText/README.md
- [S13] Atlassian, Spinner usage: https://atlassian.design/components/spinner/usage
- [S13a] Atlassian, Skeleton examples: https://atlassian.design/components/skeleton/examples
- [S14] Learning Equality design system, Loaders: https://design-system.learningequality.org/loaders
- [S15] spin-delay README: https://cdn.jsdelivr.net/npm/spin-delay@2.0.1/README.md
- [S16] MDN, aria-busy: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy
- [S17] MDN, aria-hidden: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden
- [S18] W3C, Understanding SC 2.2.2: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- [S19] Microsoft Fluent 2, Skeleton usage: https://fluent2.microsoft.design/components/web/react/core/skeleton/usage
- [S20] MDN, prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- [S21] MDN, forced-colors: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors
- [S22] MDN, CSS logical properties and values: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values
- [S23] RTL Styling 101: https://rtlstyling.com/posts/rtl-styling
- [S24] MDN, ARIA live regions: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions
- [S25] W3C, Understanding SC 4.1.3 Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- [S26] W3C, Understanding SC 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- [S27] Material Web, progress docs: https://github.com/material-components/material-web/blob/main/docs/components/progress.md
- [S28] Material 2 progress indicators (seen via search summary only): https://m2.material.io/go/design-progress-indicators

Not fetched successfully (unverified): m3.material.io progress and loading indicator guidelines, carbondesignsystem.com skeleton-states usage, Polaris current docs, atlassian.design loading foundation, Firefox Acorn loading indicators, Queensland Design System loading spinner, GOV.UK, Luke Wroblewski.
