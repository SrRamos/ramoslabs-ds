# Button

## Recommended variant

Use a native `button` with a stable accessible name, native `disabled`, and `aria-pressed` only for a true toggle whose label does not change. The T1 contract is [APG's Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) (living document, retrieved 2026-10-27); [HTML's button element](https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element) supplies native behavior (Living Standard updated 2026-10-26).

## Measured evidence and alternatives

The CANDIDATE ARIA-AT Command Button reports are now recorded per pair in `button.json`: JAWS 2025.2508.120/Chrome 148 passed 28/28 MUST assertions with no negative side effects; NVDA 2023.3/Chrome 120 passed 27/28; VoiceOver macOS 15.6.1/Safari 18.6 passed 18/20 and recorded one severe harness-cursor side effect ([ARIA-AT report index, test plan V25.11.02](https://aria-at.w3.org/report/163671)). These dated APG-example observations do not certify this library or current VoiceOver.

The separate native-button a11ysupport matrix supports name, role, and role shortcuts for TalkBack and VoiceOver iOS, with historical results spanning approximately 2019–2026 ([a11ysupport, updated 2025-08-15](https://a11ysupport.io/tech/html/button_element)).

Discarded: generic `div`/`span` buttons because native focus, activation, disabled behavior, and semantics must be recreated; and changing a toggle's label while retaining `aria-pressed`, explicitly prohibited by APG. VoiceOver iOS remains pending real testing despite the published fixture support.
