# AT support evidence — first wave, revision 1

Retrieved 2026-10-27. Each JSON is an object with a pattern-level `recommended` block and an `entries` array. The evidence-rule unit is the recommended variant: `recommended.supportedBy` resolves to T1 contract entry IDs. `recommended.atEvidence` maps each primary AT/platform to observation entry IDs or the explicit value `no-measured-evidence`, rendered as "no measured evidence; implemented to the contract". Contracts alone are not presented as measurements.

Entries have unique IDs, `kind: contract | observation`, structured `constraints`, and a test status. `impact` exists only on observations: `none` means no failure was observed in the cited fixture, `degraded` means the task remains possible with defects, and `blocker` means the observed task cannot be completed. Blocker avoidance applies on the platform where it is observed. VoiceOver entries remain `pending-real-test` even when an external published observation exists. NVDA, JAWS, and TalkBack are evidence-only and are not real-tested by this project.

| Pattern | Recommended variant | Known observed blockers and limits |
|---|---|---|
| [button](button.md) | Native button, stable name and native state | ARIA-AT candidate results differ by pair; no universal support claim. |
| [disclosure](disclosure.md) | Native `details/summary`; `details name` for exclusive groups | Historical VoiceOver iOS summary-state failures require current real verification; ARIA-AT button results are only a comparison baseline. |
| [dialog-modal](dialog-modal.md) | Native `dialog.showModal()`, real inertness and APG focus/naming | TalkBack 13.5/Chrome 108 modal containment blocker; other pairs have dated verbosity/cursor degradations. |
| [popover-nonmodal](popover-nonmodal.md) | Native `popover="auto"`, explicit semantics and adjacent DOM order | NVDA/JAWS/TalkBack have no measured evidence; WebKit invoker result is not a popover certification. |
| [tooltip](tooltip.md) | Noninteractive tooltip + `aria-describedby`; explicit touch alternative | APG is work in progress; ARIA-AT button reports measure only the trigger; historical dynamic-description gaps. |
| [tabs](tabs.md) | APG relationships and roving focus; conservative manual default | VoiceOver macOS candidate report has substantial MUST failures and cursor/hidden-panel effects; current real tests pending. |
| [radio-group](radio-group.md) | Native radios, labels and `fieldset/legend`; `native-roving` | NVDA 12718 no longer misapplied: it concerns checkbox groups, while radios behaved as expected. |
| [switch](switch.md) | Native checkbox + `role="switch"` + native `checked` | Candidate reports include MUST failures/no-output/cursor effects; no universal claim. |
| [checkbox](checkbox.md) | Native checkbox + visible label + native `checked` | ARIA-AT custom results are comparison evidence; historical native and group-description results remain dated. |
| [select-only-combobox](select-only-combobox.md) | APG active-descendant; DOM-adjacent top-layer/inline mounts; native select on touch | **Blockers:** WebKit 289338 on iOS and APG 2855 on TalkBack. No ARIA-AT select-only report. |
| [text-field](text-field.md) | Native input + label + `aria-describedby` + `aria-invalid`; errormessage additive only where tested | **Blocker:** NVDA/Edge errormessage-only. VoiceOver macOS and JAWS Firefox fail pertinent-error announcement; iOS/TalkBack published fixtures pass. |
| [img-role](img-role.md) | WAI-ARIA `role=img` plus `aria-label` for meaningful inline SVG; `aria-hidden` for decorative; never focusable | Historical (2019-2021) cross-AT fixture only; NVDA Firefox omits an SVG named without an explicit role (nvda 13863); JAWS Firefox 73 role not exposed. |
| [live-region](live-region.md) | Persistent `status`/`alert`, primed and deduplicated | Alert candidate reports pass, but do not prove polite/current reliability; JAWS duplicate-channel and iOS timing degradations remain. |

## Entry IDs by file

- **button:** `crossat-crossbrowser-apg-button`, `nvda-chrome-ariaat541`, `jaws-chrome-ariaat567`, `vo-macos-safari-ariaat539`, `talkback-chrome-a11ysupport-button`, `vo-ios-safari-a11ysupport-button`.
- **disclosure:** `crossat-crossbrowser-html-details`, `nvda-chrome-ariaat550`, `jaws-chrome-ariaat551`, `vo-macos-safari-ariaat549`, `talkback-chrome-a11ysupport-summary`, `vo-ios-safari-a11ysupport-summary`, `vo-ios-safari-webkit162041`, `nvda-chrome-chromium558324`, `nvda-chrome-a11ysupport-summary`.
- **dialog-modal:** `crossat-crossbrowser-apg-dialog`, `nvda-chrome-ariaat265`, `jaws-chrome-ariaat506`, `vo-macos-safari-ariaat263`, `talkback-chrome-a11ysupport-modal`, `vo-ios-safari-a11ysupport-modal`, `nvda-chrome-nvda17395`, `jaws-chrome-jaws662`.
- **popover-nonmodal:** `crossat-crossbrowser-html-popover`, `nvda-chrome-html-popover`, `jaws-chrome-html-popover`, `talkback-chrome-html-popover`, `vo-macos-safari-webkit284804`, `vo-ios-safari-webkit284804`.
- **tooltip:** `crossat-crossbrowser-apg-tooltip`, `nvda-chrome-ariaat541-tooltip-trigger`, `jaws-chrome-ariaat567-tooltip-trigger`, `vo-macos-safari-ariaat539-tooltip-trigger`, `talkback-chrome-a11ysupport-describedby`, `vo-ios-safari-a11ysupport-describedby`.
- **tabs:** `crossat-crossbrowser-apg-tabs`, `nvda-chrome-ariaat517`, `jaws-chrome-ariaat518`, `vo-macos-safari-ariaat516`, `talkback-chrome-apg-tabs`, `vo-ios-safari-apg-tabs`.
- **radio-group:** `crossat-crossbrowser-apg-radio`, `nvda-chrome-ariaat528`, `jaws-chrome-ariaat526`, `vo-macos-safari-ariaat529`, `talkback-chrome-a11ysupport-radio`, `vo-ios-safari-a11ysupport-radio`, `vo-ios-safari-apg-radio`.
- **switch:** `crossat-crossbrowser-apg-switch`, `nvda-chrome-ariaat562`, `jaws-chrome-ariaat563`, `vo-macos-safari-ariaat561`, `talkback-chrome-apg-switch`, `vo-ios-safari-apg-switch`.
- **checkbox:** `crossat-crossbrowser-apg-checkbox`, `nvda-chrome-ariaat559`, `jaws-chrome-ariaat558`, `vo-macos-safari-ariaat560`, `talkback-chrome-a11ysupport-native-checkbox`, `vo-ios-safari-a11ysupport-native-checkbox`, `nvda-chrome-nvda12718`.
- **select-only-combobox:** `crossat-crossbrowser-apg-select-only`, `nvda-chrome-apg-select-only`, `jaws-chrome-a11ysupport-haspopup`, `talkback-chrome-apg2855`, `vo-macos-safari-webkit231724`, `vo-ios-safari-webkit289338`.
- **text-field:** `crossat-crossbrowser-html-label`, `nvda-edge-a11ysupport-errormessage`, `jaws-chrome-a11ysupport-errormessage`, `jaws-firefox-a11ysupport-errormessage`, `talkback-chrome-a11ysupport-errormessage`, `vo-macos-safari-a11ysupport-errormessage`, `vo-ios-safari-a11ysupport-errormessage`.
- **live-region:** `crossat-crossbrowser-waiaria-status`, `nvda-chrome-ariaat544`, `jaws-chrome-ariaat565`, `vo-macos-safari-ariaat545`, `talkback-chrome-tetralogical-live`, `vo-ios-safari-tetralogical-live`, `jaws-chrome-jaws469`, `nvda-edge-nvda18721`.
- **img-role:** `crossat-crossbrowser-waiaria-img`, `crossat-crossbrowser-waiaria-hidden`, `nvda-chrome-weboverhauls-svg`, `nvda-firefox-weboverhauls-svg`, `nvda-firefox-nvda13863`, `jaws-chrome-weboverhauls-svg`, `jaws-firefox-jaws373`, `vo-macos-safari-weboverhauls-svg`, `vo-macos-safari-webkit156774`, `vo-ios-safari-weboverhauls-svg`, `talkback-chrome-weboverhauls-svg`, `narrator-edge-weboverhauls-svg`, `crossat-edge-weboverhauls-focusable`.

Routine review is 2027-01-27, or earlier when a linked report/tracker changes or a real VoiceOver run produces evidence. ARIA-AT results are CANDIDATE APG-example measurements; they do not certify this library's fixtures. ARIA-AT MUST counts exclude ARIA-AT's per-command negative-side-effect assertions; side effects are reported separately.

LISTO-EVIDENCE
