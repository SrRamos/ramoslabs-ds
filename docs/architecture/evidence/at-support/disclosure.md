# Disclosure

## Recommended variant

Use native `<details>` with `<summary>`; exclusive groups use `<details name>`. Do not manually duplicate `aria-expanded` on `summary`. This matches the architecture and the native-first tie-break: HTML defines summary activation, `open`, and named exclusive groups ([HTML Standard, updated 2026-10-26](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element)).

## Evidence comparison

The historical a11ysupport matrix supports `details` role broadly and supports summary name/role/state on JAWS, TalkBack, and VoiceOver macOS. It reports old VoiceOver iOS role/state failures and some old NVDA changed-state gaps; these are degraded observations, not proof of a permanent blocker ([summary matrix, 2022-05-27](https://a11ysupport.io/tech/html/summary_element); [details matrix, 2022-05-27](https://a11ysupport.io/tech/html/details_element)). WebKit 162041 and Chromium 558324 provide historical tracker context ([WebKit, opened 2016-09-15](https://bugs.webkit.org/show_bug.cgi?id=162041); [Chromium 558324](https://bugs.chromium.org/p/chromium/issues/detail?id=558324)).

CANDIDATE ARIA-AT Disclosure FAQ reports measure the **ARIA-button alternative**, not `details`: JAWS passed 93/93 MUST assertions, NVDA 89/93, and VoiceOver macOS 61/71 with two severe harness-cursor effects ([ARIA-AT, test plan V25.11.04](https://aria-at.w3.org/report/163673)). The native variant remains recommended; current VoiceOver iOS expanded-state verification is the deciding real test.

## Discarded alternatives

A generic clickable heading is blocked for lacking native button semantics. The APG button + `aria-expanded` variant is a valid fallback comparison, not silently substituted for the architecture's native choice. Replacing `details` would require an architecture change supported by new AT evidence, not an editorial preference.
