# Image role (inline SVG icons)

## Recommended variant

This is WAI-ARIA role `img`, not an APG pattern, so the pattern slug `img-role` stands for the role itself ([WAI-ARIA, retrieved 2026-10-28](https://www.w3.org/TR/wai-aria-1.0/roles#img)). A meaningful inline SVG icon gets `role="img"` and a non-empty `aria-label`; a decorative one gets `aria-hidden="true"` and no role. Neither is focusable (`focusable="false"` where legacy engines need it, no `tabindex`). A control that contains only an icon is named on the control, never on the SVG.

## Measured evidence and alternatives

The cross-AT fixture at weboverhauls.github.io reports the name and image role announced for `role="img"` plus `aria-label` and the decorative SVG skipped, for NVDA, JAWS, VoiceOver macOS and iOS, TalkBack and legacy Narrator; all results are historical (2019 to 2021 versions) and certify nothing current. Firefox announced the name twice with NVDA, and JAWS with Firefox 73 did not expose the role (issue closed 2024-03-31 without a verified fix). NVDA issue 13863 (open, reproduced 2026-08-05) shows an SVG with a name but no explicit role omitted from Firefox browse mode, so the explicit role is required.

Discarded: `<title>` as the only name (failed in the same fixture on Firefox and iOS), `role="img"` on a decorative icon, `aria-hidden` on a focusable SVG. VoiceOver macOS and iOS rows stay `pending-real-test`; NVDA, JAWS and TalkBack are evidence-only.
