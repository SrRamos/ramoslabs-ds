# Modal dialog

## Recommended variant

Use native `dialog.showModal()` with `aria-labelledby` pointing to a visible title, `aria-modal="true"`, a visible close button, deliberate initial focus, contained Tab/Shift+Tab, Escape, and deterministic focus return. HTML's modal algorithm makes the rest of the document inert and stores the previously focused element ([HTML Standard, updated 2026-05-28](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)); APG defines naming and content-dependent initial focus ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)).

Use `aria-describedby` only for a short, simple purpose statement. For structured or long content, initially focus a static heading/container and omit the flattened description, as APG recommends.

## Discarded alternatives

- **Generic `role="dialog"` plus `aria-modal` without actual inertness/focus containment**: blocked because APG warns of severe consequences when content is marked modal but remains operable; historical TalkBack results also show that `aria-modal` alone cannot be the containment mechanism ([APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), retrieved 2026-10-27; [a11ysupport matrix, updated 2025-08-15](https://a11ysupport.io/tech/aria/aria-modal_attribute)).
- **Applying one large `aria-describedby` to structured content**: blocked because it destroys structural navigation in the initial announcement ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)).

Known evidence is mixed rather than a universal defect: JAWS 700 and NVDA 17352 report verbose reading without a description ([JAWS, 2023-02-28](https://github.com/FreedomScientific/standards-support/issues/700); [NVDA, 2024-11-04](https://github.com/nvaccess/nvda/issues/17352)). Do not blindly add a description to every dialog; test short and structured variants. VoiceOver macOS/iOS remains pending real testing.
