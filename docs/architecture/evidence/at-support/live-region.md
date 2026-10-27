# Live region

## Recommended variant

Use a persistent `role="status"` region (`aria-live="polite"`, implicit atomic) for nonurgent result/save/loading updates and `role="alert"` only for urgent interruptions. Mount the empty region before changing its text, update only when the user-facing message changes, and deduplicate repeated messages. WAI-ARIA 1.2 defines the status/alert semantics ([status, Recommendation 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#status); [alert, Recommendation 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#alert)). TetraLogical's measured fixtures support priming regions and testing insertion/update timing rather than assuming initial content announces ([TetraLogical, published 2024-05-01, updated 2026-04-07](https://tetralogical.com/blog/2024/05/01/why-are-my-live-regions-not-working/)).

## Discarded alternatives

- **Assertive announcements for routine updates or every active-option movement**: blocked because it interrupts speech and duplicates information already carried by focus/active-descendant; WAI-ARIA reserves alert for important, time-sensitive content ([WAI-ARIA 1.2 alert, 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#alert)).
- **The same changing text as both a focused `aria-describedby` target and a live region**: blocked for the shared variant because JAWS 469 documents duplicate speech in this configuration ([JAWS, 2020-11-06](https://github.com/FreedomScientific/standards-support/issues/469)).
- **Inserting and announcing a brand-new live region as an assumed universal fix**: discarded because published fixtures show timing/initial-content differences; prime the container and test the exact pair ([TetraLogical, updated 2026-04-07](https://tetralogical.com/blog/2024/05/01/why-are-my-live-regions-not-working/)).
- **A global delay based on NVDA 18721**: blocked because maintainers could not reproduce the report on Edge 144 and closed it works-for-me on 2026-01-08 ([NVDA, 2025-08-15–2026-01-08](https://github.com/nvaccess/nvda/issues/18721)).

VoiceOver macOS/iOS remains pending real testing. NVDA/JAWS/TalkBack decisions are evidence-only; no current universal support claim is made.
