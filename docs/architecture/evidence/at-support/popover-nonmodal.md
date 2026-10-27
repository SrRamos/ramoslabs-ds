# Nonmodal popover

## Recommended variant

Use native `popover="auto"` with a native button invoker (`popovertarget` or the equivalent API), explicit semantics appropriate to the popover's content, `aria-expanded` synchronized on the invoker, and an explicit close control when the content is interactive. Keep the popover immediately after its invoker in DOM order whenever possible. HTML supplies top-layer rendering, light dismiss, close requests, and focus return, but explicitly says generic popovers need appropriate ARIA semantics and recommends adjacent DOM order ([HTML Standard, updated 2026-10-26](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute)).

## Discarded alternatives

- **`popover="manual"` for an ordinary nonmodal disclosure**: blocked because HTML says manual popovers have neither light dismiss nor close-request behavior, forcing custom dismissal and nested-overlay handling ([HTML Standard, updated 2026-10-26](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute)).
- **A bare top-layer `div` with no content role or label**: blocked because the popover attribute does not add accessibility semantics ([HTML Standard, updated 2026-10-26](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute)).
- **Portaling interactive content without a reading-order plan**: blocked for the shared variant because HTML specifically recommends placement immediately after the trigger for screen-reader reading order ([HTML Standard, updated 2026-10-26](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute)).

WebKit 284804 is relevant to the invoker's changed expanded state but is not a popover certification: a later macOS/Safari comment passed and does not establish current iOS behavior ([WebKit, 2024-12-17–2025-04-07](https://bugs.webkit.org/show_bug.cgi?id=284804)). VoiceOver real tests remain pending.
