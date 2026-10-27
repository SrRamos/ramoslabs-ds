# Disclosure

## Recommended variant

Use a native button with `aria-expanded` synchronized to visibility and `aria-controls` referencing the controlled region. Keep the revealed content immediately after the trigger in DOM reading order. APG defines this minimal contract and native Enter/Space activation ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)).

## Discarded alternatives

- **A clickable heading or generic element without a native button**: blocked because it removes the required button semantics and native activation contract ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)).
- **A visual-only chevron or hidden state without updating `aria-expanded`**: blocked because the programmatic state then contradicts the visible state ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)).
- **Treating `aria-controls` as the announcement mechanism**: it is only the optional relationship in APG; expanded state and reading order carry the user-facing behavior ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)).

WebKit 284804 is a dated regression lead, not a current universal failure: its original report covered macOS 15.1.1/iOS 18.1.1, while a later macOS 15.4/Safari 18.4 comment passed ([WebKit, 2024-12-17–2025-04-07](https://bugs.webkit.org/show_bug.cgi?id=284804)). Current VoiceOver macOS/iOS tests remain required.
