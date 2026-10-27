# Select-only combobox with listbox

## Recommended variant

For the custom desktop variant, use APG's non-input `role="combobox"` trigger with real DOM focus, `aria-expanded`, `aria-controls`, `aria-haspopup="listbox"`, and `aria-activedescendant` referencing options in a controlled single-select `listbox`. Keep navigation separate from committed selection: arrows move the active option; Enter/Space/Tab commits; Escape cancels. Render the popup inline/adjacent to the trigger, not remotely at the end of `body`. APG defines this model but explicitly warns that mobile/AT support gaps require testing ([APG select-only example, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)).

**Use native `select` by preference on iOS and Android.** This is the widest-support mobile choice and the native tie-break, while preserving the requested custom listbox variant for desktop use cases that genuinely need it.

## Discarded alternatives

- **Remote/top-layer listbox at the end of `body` on iOS**: blocked by WebKit 289338, where VoiceOver skips the remotely mounted options while the inline comparison works ([WebKit, 2025-03-07, NEW at retrieval](https://bugs.webkit.org/show_bug.cgi?id=289338)).
- **Shipping the APG custom example unchanged on TalkBack**: blocked by APG 2855, which reports inability to navigate/choose options on Android/Chrome and remained confirmed on 2025-06-13 ([APG issue, 2023-11-02–2025-06-13](https://github.com/w3c/aria-practices/issues/2855)).
- **Editable text input for a select-only widget**: discarded because APG's select-only variant deliberately uses a non-input trigger and does not accept freeform input ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)).
- **Roving DOM focus into options while keeping the APG select-only contract**: discarded because APG explicitly keeps DOM focus on the trigger and uses active-descendant ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)).

WebKit 231724's later desktop passing comment is not a universal fix and does not cover iOS/TalkBack ([WebKit, 2021-10-14–2025-07-09](https://bugs.webkit.org/show_bug.cgi?id=231724)). VoiceOver macOS/iOS real tests remain pending; native mobile fallback is mandatory unless current evidence supersedes these blockers.
