# Form (enterkeyhint and redundant entry)

## Recommended variant

Use a native `form` whose owner computes `enterkeyhint` from field order (next, done, go, send, search) as a keyboard cue only, keeps an explicit submit control, and retains or offers previously entered values within the process. HTML defines `enterkeyhint` as the action label or icon for the enter key on virtual keyboards, with the user agent presenting the cue and choosing a default when it is unset ([HTML Standard, updated 2026-11-05](https://html.spec.whatwg.org/multipage/interaction.html#input-modalities:-the-enterkeyhint-attribute)). WCAG 2.2 SC 3.3.7 Redundant Entry (Level A) requires previously entered information to be auto-populated or selectable, with exceptions for essential re-entry, security and invalid data ([Understanding SC 3.3.7, updated 2025-09-17](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)).

## Measured evidence

None. No source read documents how VoiceOver iOS, TalkBack or desktop AT expose or announce the `enterkeyhint` label (the HTML spec is silent on AT), and no AT-specific test of prior-value offers was found. All five primary pairs are explicitly `no-measured-evidence`; VoiceOver pairs stay `pending-real-test`. Both behaviors are verified by the manual assertions `manual-form-enter-key-label` and `manual-form-prior-values-offered`.
