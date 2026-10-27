# Checkbox

## Recommended variant

Use native `input type="checkbox"` with an associated visible `label`, native `checked`, and `fieldset`/`legend` for a named group. The HTML element supplies checkedness and activation ([HTML Standard, updated 2026-10-14](https://html.spec.whatwg.org/multipage/input.html#checkbox-state-(type=checkbox))); APG defines the custom semantics only when a custom host is unavoidable ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)). The historical a11ysupport native matrix reports supported name, role, current state, and state changes across NVDA, JAWS, TalkBack, and VoiceOver columns, but its results are approximately 2019–2021 and are not current certification ([a11ysupport, 2021-07-29](https://a11ysupport.io/tech/html/input(type-checkbox)_element)).

## Discarded alternatives

- **Generic `div role="checkbox"`**: blocked as the default because native focus, Space activation, and checked state must be recreated without a support benefit ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)).
- **A switch or toggle button for a checklist item**: discarded because APG distinguishes checkbox checked/unchecked semantics from switch on/off and toggle pressed semantics; choose the role matching the UI ([APG switch pattern, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)).
- **Visual checkmark without a programmatic native state**: blocked because the checked state and its changes must be exposed ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)).

No current native-checkbox AT blocker appears in the verified evidence. Historical T2 results justify the native tie-break, while current VoiceOver macOS/iOS remains pending real testing.
