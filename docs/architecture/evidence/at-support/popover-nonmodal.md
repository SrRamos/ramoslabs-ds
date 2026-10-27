# Nonmodal popover

## Recommended variant

Use native `popover="auto"` with a native invoker, explicit content semantics, synchronized `aria-expanded`, adjacent DOM order, and an explicit close control for interactive content. HTML supplies top-layer rendering, light dismiss, close requests, and focus return but no content role; it recommends placing the popover immediately after its trigger for screen-reader reading order ([HTML Standard, updated 2026-10-26](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute)).

## Measured evidence and alternatives

No ARIA-AT popover report exists in the verified candidate set. NVDA, JAWS, and TalkBack are therefore explicitly `no-measured-evidence`, not implicitly supported by the HTML contract. WebKit 284804 is retained only as related invoker-state evidence: its later macOS/Safari disclosure pass is neither a popover test nor an iOS fix guarantee ([WebKit, 2024-12-17–2025-04-07](https://bugs.webkit.org/show_bug.cgi?id=284804)).

Discarded: `popover="manual"` without a dismissal implementation, bare generic content without semantics, and remote portals without a reading-order plan. VoiceOver macOS/iOS popover tests remain pending real measurement.
