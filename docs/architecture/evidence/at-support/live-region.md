# Live region

## Recommended variant

Use persistent `role="status"` for nonurgent updates and `role="alert"` only for urgent interruptions. Mount empty before changing text, deduplicate messages, and never use a second live region for focus/active-option speech ([WAI-ARIA status, Recommendation 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#status); [alert, 2023-06-06](https://www.w3.org/TR/wai-aria-1.2/#alert)).

## Measured evidence and alternatives

CANDIDATE ARIA-AT Alert reports passed all MUST assertions with no negative side effects: NVDA 4/4, JAWS 4/4, and VoiceOver macOS 3/3 ([ARIA-AT, test plan V25.11.02](https://aria-at.w3.org/report/163670)). These alert results do not establish polite-status or current VoiceOver reliability. TetraLogical's measured fixtures still require priming/timing tests on iOS ([published 2024-05-01, updated 2026-04-07](https://tetralogical.com/blog/2024/05/01/why-are-my-live-regions-not-working/)).

Discarded: routine assertive announcements, duplicate focused-description/live channels, universal insertion/timer hacks, and focus compensation. JAWS 469 documents duplicate two-channel speech; NVDA 18721 was unreproduced and closed works-for-me, so neither justifies a universal workaround ([JAWS, 2020-11-06](https://github.com/FreedomScientific/standards-support/issues/469); [NVDA, closed 2026-01-08](https://github.com/nvaccess/nvda/issues/18721)). TetraLogical's measured fixtures include TalkBack as well as iOS, so both are observations rather than contract-only claims; VoiceOver lanes remain pending.
