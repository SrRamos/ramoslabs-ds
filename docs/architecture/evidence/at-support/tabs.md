# Tabs

## Recommended variant

Use APG `tablist` → `tab` → `tabpanel`, reciprocal relationships, one roving tab stop, and `aria-selected`. **Manual activation is the library's conservative default**, not an APG default: APG recommends automatic activation when panels appear without noticeable latency. Automatic mode is permitted only for preloaded latency-free panels; asynchronous panels stay manual ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)).

## Measured evidence and alternatives

CANDIDATE ARIA-AT manual-tabs results are recorded per pair: JAWS passed 98/98 MUST assertions but logged three moderate duplicate/verbosity effects; NVDA passed 82/88; VoiceOver macOS passed 49/74 with ten severe cursor/focus side effects, including a hidden-panel case ([ARIA-AT, test plan V25.10.20, results through 2025-11-03](https://aria-at.w3.org/report/163664)). These results require fixture-level focus and reading-order tests; they are not a current VoiceOver certification.

Discarded: automatic activation with noticeable latency, every tab in the page Tab order, and links styled as tabs without the composite semantics/keyboard map, all contrary to APG. TalkBack has no measured evidence; VoiceOver iOS is pending real testing.
