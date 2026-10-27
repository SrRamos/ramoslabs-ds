# Tabs

## Recommended variant

Use APG `tablist` → `tab` → `tabpanel`, bidirectional `aria-controls`/`aria-labelledby`, one roving tab stop, `aria-selected`, and **manual activation by default** with Enter/Space. Left/Right navigate horizontal tabs; do not capture Up/Down in horizontal orientation. Give a panel `tabindex="0"` when its content otherwise cannot receive focus. Prefer native buttons as the tab host where feasible. APG supplies the complete contract ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)).

## Discarded alternatives

- **Automatic activation for asynchronous or noticeably delayed panels**: blocked because APG says latency slows focus movement and significantly hampers navigation; automatic activation is allowed only when panels display without noticeable latency ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)).
- **Every tab in the page Tab order**: blocked because it violates APG's composite model and makes users traverse every tab before reaching the panel ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)).
- **Links styled as tabs without tab semantics and keyboard behavior**: blocked when the UI actually switches layered panels; role and interaction must match the function ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)).

No current pattern-specific AT blocker was established by the verified sources. That absence is not proof of support: all VoiceOver macOS/iOS checks remain pending, and NVDA/JAWS/TalkBack implementation is evidence-only.
