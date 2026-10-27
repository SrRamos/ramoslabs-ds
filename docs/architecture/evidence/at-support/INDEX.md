# AT support evidence — first wave

Retrieved 2026-10-27. Each pattern has a JSON evidence array and a short decision note. T1 sources are specifications, APG, or official AT/browser trackers; T2 sources are published test data. APG and specifications establish implementation contracts, **not measured AT compatibility**. Every decision has at least one T1 source in its JSON. NVDA, JAWS, and TalkBack entries are `evidence-only`; VoiceOver macOS/iOS entries are `pending-real-test`. Historical results retain their original versions and dates and are not presented as current certification. The next routine review is 2027-01-27, or earlier when a linked tracker changes or a real VoiceOver run produces new evidence.

| Pattern | Recommended variant | Known blockers and limits |
|---|---|---|
| [button](button.md) | Native `button`, stable accessible name, native state | No current pattern-specific blocker established; VoiceOver real tests pending. |
| [disclosure](disclosure.md) | Native button + `aria-expanded`/`aria-controls`, adjacent content | WebKit 284804 had missing changed-state reports; later desktop pass does not certify current iOS. |
| [dialog-modal](dialog-modal.md) | Native `dialog.showModal()`, title, real inertness, deliberate focus/return | Historical TalkBack `aria-modal` gaps mean ARIA alone is insufficient; JAWS/NVDA verbosity reports require short-vs-structured description tests. |
| [popover-nonmodal](popover-nonmodal.md) | Native `popover="auto"`, explicit content semantics, adjacent DOM order | Popover adds no semantics by itself; changed invoker-state output needs current VoiceOver verification. |
| [tooltip](tooltip.md) | Noninteractive `role="tooltip"` + `aria-describedby`; explicit touch alternative | APG pattern is still work in progress; historical dynamic-description gaps prohibit relying on late text changes. |
| [tabs](tabs.md) | APG tablist/tab/tabpanel, roving focus, manual activation by default | Automatic activation is blocked for latent panels; current AT speech remains unmeasured. |
| [radio-group](radio-group.md) | Native radios + shared name + labels + `fieldset`/`legend` | NVDA 12718 documents a historical group-description gap; essential instructions cannot rely on that channel alone. |
| [switch](switch.md) | Native checkbox + `role="switch"` + native `checked`, stable label | No current pattern-specific blocker established; do not duplicate native state with `aria-checked`. |
| [checkbox](checkbox.md) | Native checkbox + visible label + native `checked` | Broad published support is historical (approximately 2019–2021), not current certification. |
| [select-only-combobox](select-only-combobox.md) | APG trigger focus + active-descendant + adjacent listbox on desktop; native `select` on mobile | **iOS blocker:** WebKit 289338 remote-listbox navigation failure. **TalkBack blocker:** APG 2855 cannot navigate/choose. Native mobile fallback required. |
| [text-field](text-field.md) | Native input + label + `aria-describedby` + `aria-invalid`, explicit post-submit focus path | `aria-errormessage` alone is blocked by published NVDA failure; dynamic descriptions are not a reliable sole error channel. |
| [live-region](live-region.md) | Persistent `status` for polite updates, `alert` only when urgent, primed before changes | JAWS duplicate-description/live report; platform timing varies; NVDA 18721 was unreproduced and cannot justify a global timer. |

## Real VoiceOver test gate

For each pattern, record exact macOS/iOS and Safari builds, actual speech, touch/keyboard commands, focus before/after, state changes, and pass/fail evidence. Passing a DOM or accessibility-tree assertion does not close a `pending-real-test` entry. A VoiceOver result also does not upgrade NVDA, JAWS, or TalkBack from `evidence-only`.

LISTO-EVIDENCE
