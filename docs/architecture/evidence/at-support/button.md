# Button

## Recommended variant

Use a native `button` with a stable accessible name. Use native `disabled` for unavailable actions and `aria-pressed` only for a true toggle whose label does not change. APG defines Enter/Space activation and the name/role/state contract ([APG, living document, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/button/)); HTML supplies the native control ([HTML Standard, updated 2025-09-17](https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element)). These T1 sources determine the variant, not an assumption that every AT announcement is identical.

## Discarded alternatives

- **Generic `div`/`span` with `role="button"`**: blocked as the default because keyboard activation, focusability, disabled behavior, and native semantics must all be recreated. APG's examples do not make that custom route preferable to the native element ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/button/)).
- **Changing a toggle's label while retaining `aria-pressed`**: blocked because APG explicitly requires the toggle label not to change; use either a stable label plus `aria-pressed` or an ordinary action button with a changing label ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/button/)).

No pattern-specific current AT blocker was found in the verified sources. VoiceOver macOS/iOS remains pending real testing; this is not a certification claim for NVDA, JAWS, or TalkBack.
