# Modal dialog

## Recommended variant

Use native `dialog.showModal()` with a visible title, actual background inertness, deliberate initial focus, contained Tab/Shift+Tab, Escape, a visible close control, and deterministic focus return. Use `aria-describedby` only for a short simple purpose statement; structured/long content gets static initial focus instead ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/); [HTML Standard, updated 2026-10-26](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)).

## Measured evidence and alternatives

CANDIDATE ARIA-AT results differ materially by pair: JAWS 2025.2508.120/Chrome 143 passed 83/83 MUST assertions with no side effects; NVDA 2024.1/Chrome 125 also passed all MUST assertions but logged repeated severe/moderate verbosity; VoiceOver macOS 14.4.1/Safari 17 passed 50/64 and logged two severe cursor failures ([ARIA-AT, test plan V24.06.07](https://aria-at.w3.org/report/147736)). Historical TalkBack 13.5/Chrome 108 failed both modal presence and reading containment, so `aria-modal` without real inertness is a blocker on that observed platform ([a11ysupport matrix, updated 2025-08-15](https://a11ysupport.io/tech/aria/aria-modal_attribute)).

Discarded: generic `role="dialog"` with `aria-modal` but no actual containment, and large flattened descriptions. NVDA's report is now cited as closed discussion 17395, and JAWS verbosity as original issue 662 rather than closed duplicate 700 ([NVDA, converted 2024-11-12](https://github.com/nvaccess/nvda/discussions/17395); [JAWS 662, 2022-08-16](https://github.com/FreedomScientific/standards-support/issues/662)). Current VoiceOver real tests remain pending.
