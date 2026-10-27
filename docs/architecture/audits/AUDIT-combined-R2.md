# AUDIT combined, round 2: ARCHITECTURE revision 3, PLAN follow-through, AT evidence registry revision 1

Auditor: ds-fable. Date: 2026-10-27. Branch `feature/component-architecture`, commits `9bb4897` (ADR-015 revision 3 and plan follow-through) and `474e392` (D1 resolved, registry migrated).
Scope: only the findings of `audits/AUDIT-combined-R1.md` and the text those changes touched. Diffs read in full: `56ab478..474e392` for ARCHITECTURE.md and PLAN-WAVE-1.md; `34fde60..474e392` for the registry; the three changelogs.
Method for the registry: a validator was run over all twelve files against the ADR-015 revision 3 rules (file shape, `id` uniqueness, `supportedBy` and `atEvidence` resolution, `kind`/`impact` rule, `test_status` enum, review window, primary-pair coverage, blocker list, `constraints` presence). Web verification: four ARIA-AT reports (disclosure JAWS target 551, modal NVDA 265, disclosure VoiceOver 549, radio JAWS 526) through the ARIA-AT GraphQL API (`metrics` and `finalizedTestResults`) plus the version lists of all eight cited test plans; NVDA 12718; WebKit 162041; JAWS 662; the a11ysupport `summary`/`details` rows from the project's repository data.

## Verdicts

| Subject | R1 | R2 | Why in one line |
|---|---|---|---|
| ADR-015 and the revised ADR-001, 005, 006, 007, 010, 011, 013, Section 2 | NOT-CERTIFIED | **CERTIFIED** | All four MUSTs and all SHOULD/NICE items are applied as described and verified in the diff; two small vocabulary gaps remain as SHOULD/NICE and are required at merge |
| PLAN-WAVE-1.md | APPROVED | **APPROVED** | All five follow-through edits are applied; two NICE wording items |
| AT evidence registry | FAIL | **FAIL** | Seven of the R1 MUST/SHOULD items are resolved and verified, but the migrated files omit the `recommended.atEvidence` map that ADR-015 revision 3 and plan W1-315 define (the registry put `no-measured-evidence` into `test_status` instead, a value the enum rejects), and `constraints.focusStrategy` uses five invented values outside the contract vocabulary, which defeats the W1-317 conflict check the structured field was created for |

Both registry MUSTs are mechanical; a third round can be a file-level check.

---

## 1. ARCHITECTURE revision 3: status per R1 finding

| Finding | Status | Verified where |
|---|---|---|
| A-MUST-1 schema completeness | **Resolved** | ADR-015 field table: `id` with naming rule, `kind: contract\|observation`, `impact` required only for observations with `none` added, `test_status` with `pending-real-test` defined, `constraints` with the CI note "never `decision`", nullable versions; file shape `{ pattern, recommended, entries[] }` |
| A-MUST-2 unit of the evidence rule | **Resolved** | "The unit is the pattern's `recommended` variant"; `recommended.supportedBy` and `atEvidence`; contract entries count for the variant; per-AT claims need an observation or `no-measured-evidence`; "a contract page alone is never presented as evidence of AT support" |
| A-MUST-3 sample and pattern list | **Resolved** (one NICE left) | ADR-010 sample VoiceOver rows `pending-real-test`, no `tested_on`; honesty gate allows empty evidence only for that status; twelve pattern names; refs point at `select-only-combobox.json`. Two of the three sample ids do not exist in the registry (A2-NICE-1) |
| A-MUST-4 unrevised ADRs | **Resolved** | ADR-001 consequence reworded for desktop lane plus `not hands-on verified`; Section 2 evidence note under the floor table; ADR-007 kind certification on the owner's iPhone with Android `not run`; ADR-011 interaction gates with reference targets and the `not run` Android row |
| A-SHOULD-1 blocker rule per platform | Applied | "never shipped on the platforms where that blocker is documented", with the listbox example |
| A-SHOULD-2 primary pairs in 4b | Applied | ADR-013 4b names the five primary pairs, secondary optional, and reads `constraints` |
| A-SHOULD-3 T2 "such as" | Applied | ADR-015 T2 with measured consultancy tests named |
| A-SHOULD-4 `listboxMount` by DOM placement | Applied | ADR-005 step 8: both values DOM-adjacent, `top-layer` = promoted via `popover`, portal-to-body forbidden, WebKit 289338 characterised correctly |
| A-SHOULD-5 "in the lane" wording | Applied | Section 2 |
| A-NICE-1 D1 status | Applied | Owner table: D1 resolved 2026-10-27, option A, owner-delegated; the plan says the same |
| A-NICE-2 ARIA-AT named | Applied | ADR-015 T1 names ARIA-AT with the report phase noted |
| E-SHOULD-5 cross-reference | Applied | ADR-006 "Native roving" bullet, `focus.strategy: native-roving` |

### New findings

- **A2-SHOULD-1. Enumerate the `constraints.focusStrategy` vocabulary.** ADR-015 says the field is "in contract vocabulary" but lists no values; the registry then invented five (`aria-activedescendant`, `modal-trap`, `trigger`, `popover-native`, `unchanged`) that the contract's `focus.strategy` will never equal (ADR-006 table and ADR-010 sample use `roving`, `activedescendant`, `native`, now `native-roving`). Correction: add to the field row "`focusStrategy` takes exactly the ADR-006 values `roving | activedescendant | native | native-roving`; omit the key where no focus strategy applies (live regions)". Also add `domAdjacent?: boolean` to the key list, since the example in the same row already uses it. Required at merge; this is what makes the W1-317 check computable.
- **A2-NICE-1.** The ADR-010 sample references `select-only-combobox.json#nvda-chrome-apg` and `#jaws-chrome-apg`; the registry ids are `nvda-chrome-apg-select-only` and `jaws-chrome-a11ysupport-haspopup` (there is no JAWS APG entry). Align the sample with the registry ids, or rename the registry ids; W1-317 will otherwise flag the sample fixture.
- **A2-NICE-2.** The last line still reads `REVISION-3-FOR-AUDIT`; on merge set `CERTIFIED (ds-fable, audits/AUDIT-combined-R2.md, 2026-10-27)` with A2-SHOULD-1 applied.

---

## 2. PLAN-WAVE-1.md follow-through: status per R1 finding

| Finding | Status | Verified where |
|---|---|---|
| P-SHOULD-1 W1-114 placement | **Applied** | W1-114 depends on W1-102, W1-103, W1-120..122; Section 1 "W1-114 first" and the precondition is "K1 and W1-120..122 merged"; Section 9 S-TEST row matches |
| P-SHOULD-2 W1-315 / W1-317 | **Applied** | W1-315 validates the file shape, `id` uniqueness, `kind` with the `impact` rule, `constraints`, `pending-real-test`, `no-measured-evidence`, nullable versions, and the variant rule over `supportedBy`; W1-317 compares structured `constraints`, "prose `decision` is never compared" |
| P-SHOULD-3 W1-301 sample dependency | **Applied** | Acceptance notes the `pending-real-test` sample and "do not copy the fixture before ADR-010 revision 3 lands" |
| P-NICE-1 D1 wording | **Applied** | Section 0: "resolved 2026-10-27: A, owner-delegated" |
| P-NICE-2 W1-505 dependency | **Applied** | "each component's `.a` contract" added |

### New findings

- **P2-NICE-1.** W1-315 lists `no-measured-evidence` without saying where it lives; after E2-MUST-1 write "`no-measured-evidence` as a value of `recommended.atEvidence`, never of `test_status`", and add the `focusStrategy` enum of A2-SHOULD-1 to the seeded-failure list.
- **P2-NICE-2.** The plan's last line still says `REVISION-1-FOR-AUDIT`; mark it `APPROVED (audits/AUDIT-combined-R2.md)` on merge.

---

## 3. AT evidence registry revision 1: status per R1 finding

| Finding | Status | Verified how |
|---|---|---|
| E-MUST-1 `impact` on contract entries | **Resolved** | Validator: no contract entry carries `impact`; every observation carries one of `none/degraded/blocker`; blockers are exactly the four named in the changelog (TalkBack aria-modal, APG 2855, WebKit 289338, NVDA/Edge errormessage) |
| E-MUST-2 ids | **Resolved** (one SHOULD) | 80 unique ids; every `supportedBy` resolves. INDEX omits five ids although the changelog says all are listed (E2-SHOULD-2) |
| E-MUST-3 ARIA-AT | **Resolved** (one SHOULD) | 27 ARIA-AT observation entries across nine files (button, checkbox, dialog, disclosure, live-region, radio, switch, tabs, tooltip-as-trigger). Sample verified against the API: JAWS disclosure target 551 is JAWS 2025.2506.170 and 2025.2508.120 on Chrome 139 as stated; NVDA modal 265 is NVDA 2024.1 on Chrome 125 with 16 negative side effects (6 severe, 10 moderate) as stated; VoiceOver disclosure 549 is VoiceOver 15.6 on Safari 18.6 with 2 severe side effects as stated; JAWS radio 526 is JAWS 2025.2505.43 on Chrome 137 as stated. All eight cited plans are CANDIDATE with the stated version strings. The MUST counts are derived, not the page's figures (E2-SHOULD-1). Pairs without reports are marked (select-only NVDA, popover, TalkBack) |
| E-MUST-4 disclosure `<details>` | **Resolved** | `recommended.variant` is native `details/summary` with `details name`; constraints `focusStrategy: native`, `mustNot: manual-aria-expanded-on-summary, exclusive-group-without-name`; ARIA-AT entries labelled as the ARIA-button comparison baseline. The new sources check out: a11ysupport `details-summary` test (2022-05-27) shows TalkBack 12.2/Chrome 101 passing name, role, expanded state and change; VoiceOver iOS 15.5 failing role, expanded state and change; VoiceOver macOS 12.2.1 passing; NVDA 2021.1 failing changed-state on Chrome and Edge; WebKit 162041 is "Add accessibility support for details element on iOS", 2016-09-15, RESOLVED FIXED 2016-09-19 (the entry says "historical", which is right; it may add the resolution) |
| E-MUST-5 NVDA 12718 | **Resolved** | Entry `nvda-chrome-nvda12718` now lives in checkbox.json, `observation`, `degraded`, text "a role=group description was not announced for a checkbox group in browse mode … radio buttons behaved as expected because focus mode reads the description", which is what the issue says; radio-group.md explains the move |
| E-SHOULD-1 HTML dates | Applied | All HTML Standard citations read "updated 2026-10-26" |
| E-SHOULD-2 select-only vocabulary | Applied | `domAdjacent: true`, `listboxMount: { fine: top-layer, coarse: inline }`, `nativeOnTouch: true`, `mustNot: portal-to-body`; the md defines promotion versus placement |
| E-SHOULD-3 tabs default | Applied | "Manual activation is the library's conservative default, not an APG default" with the APG latency condition |
| E-SHOULD-4 2025-12-24 errormessage rows | Applied | VoiceOver macOS 15.7.3/Safari 18.6 fail, VoiceOver iOS 18.5 pass, TalkBack 16.2/Chrome 143 pass, JAWS Chrome/Edge pass and Firefox fail; matches the repository data verified in R1 |
| E-SHOULD-5 native roving | Applied | `focusStrategy: native-roving`, `mustNot: double-handle-native-arrows` |
| E-SHOULD-6 statuses | Applied (one NICE) | NVDA discussion 17395 converted 2024-11-12; JAWS 662 cited; WebKit 289338 iOS 18/Safari 18; APG 2855 activity 2025-10-29. JAWS 662 detail in E2-NICE-2 |
| E-NICE-1 null versions | Applied | `at_version`/`browser_version` are `null` where the source gives none |
| E-NICE-2 INDEX vocabulary | Applied | INDEX rewritten in `recommended` terms |
| E-NICE-3 Safari 6.1 typo | Applied | Row replaced by ARIA-AT target 263 |

### MUST (new)

**E2-MUST-1. `recommended.atEvidence` is missing from all twelve files, and `no-measured-evidence` was put into `test_status`.** ADR-015 revision 3 defines `atEvidence` as "a per-AT map of entry ids or the explicit value `no-measured-evidence`", and plan W1-315 validates it. No file has the key. Instead nine entries (button, live-region, radio-group, switch, tabs and tooltip TalkBack; popover NVDA, JAWS and TalkBack; select-only NVDA) carry `test_status: no-measured-evidence`, which is outside the enum `tested-real | evidence-only | pending-real-test`; W1-315 as specified rejects every one of those files, and W1-317's per-AT coverage report has no map to read. Correction, per file: add `recommended.atEvidence` with the five primary keys (`nvda`, `jaws`, `voiceover-macos`, `voiceover-ios`, `talkback`) mapping to observation ids or `no-measured-evidence`; set those nine entries back to `test_status: evidence-only` (they are `kind: contract`, which already says they are not measurements). Example for select-only: `"atEvidence": { "nvda": "no-measured-evidence", "jaws": ["jaws-chrome-a11ysupport-haspopup"], "talkback": ["talkback-chrome-apg2855"], "voiceover-macos": ["vo-macos-safari-webkit231724"], "voiceover-ios": ["vo-ios-safari-webkit289338"] }`. (If the authors prefer the status-based form, ADR-015 must be amended instead; the two documents must agree, and the ADR form is the one the plan already implements.)

**E2-MUST-2. `constraints.focusStrategy` uses values the contract cannot match.** Values in use: `aria-activedescendant` (select-only), `modal-trap` (dialog), `trigger` (tooltip), `popover-native` (popover), `unchanged` (live-region), plus the valid `native`, `roving`, `native-roving`. W1-317 fails CI when `constraints.focusStrategy` differs from the contract's `focus.strategy`, whose vocabulary is ADR-006's; every dialog, tooltip, popover and select component would fail on a string mismatch, and the check would be disabled rather than fixed. Correction: select-only → `activedescendant`; dialog, tooltip, popover → `native` (ADR-006: "Disclosure, switch, dialog, tooltip: native focus; no composite strategy"; the popover does not trap or rove); live-region → remove the key (no focus strategy applies). Apply to both `recommended.constraints` and each entry's `constraints`. Depends on A2-SHOULD-1 landing in the same commit so the enum is written once.

### SHOULD (new)

- **E2-SHOULD-1. ARIA-AT MUST counts are derived, not the page's figures.** The report pages and the API show "N of M passed" including one no-severe-side-effect MUST assertion per command (disclosure JAWS: 129 of 129; modal NVDA: 105 of 111; disclosure VoiceOver: 86 of 98; radio JAWS: 206 of 206). The registry reports 93/93, 83/83 with 0 failed, 61/71 and 151/151: consistently the explicit assertion results with the per-command side-effect assertions stripped out, which is a defensible reading but one a reader following the URL cannot reproduce, and for modal NVDA it turns "6 MUST failed" on the page into "0 failed" in the registry. Correction: state the derivation once in INDEX ("counts exclude ARIA-AT's per-command negative-side-effect assertions; side effects are reported separately") and in each ARIA-AT `behavior`, or cite the page's `mustFormatted` figures and keep the side-effect sentence. Either is acceptable; silence is not.
- **E2-SHOULD-2. INDEX omits five ids** although CHANGELOG-EVIDENCE-R1 says every id is listed: `talkback-chrome-a11ysupport-button`, `talkback-chrome-a11ysupport-describedby`, `talkback-chrome-a11ysupport-radio`, `talkback-chrome-tetralogical-live`, `vo-ios-safari-a11ysupport-button`. Add them.
- **E2-SHOULD-3. Normalise `platform`.** Values include `Windows`, `Windows 11`, `Android`, `Android 12, 13, and 14 reported`, `Android 16`, `iOS 18`, `iOS 18.5`, `macOS 15.7.3`, `cross-platform`. W1-317's pair coverage needs an enum (`windows | android | macos | ios | cross`); move the OS version into a new `platform_version` (nullable) or into `behavior`. With `atEvidence` in place this is a SHOULD; without it the coverage check cannot be computed at all.

### NICE (new)

- **E2-NICE-1.** WebKit 162041: add "RESOLVED FIXED 2016-09-19" to `source_date`; the entry already calls it historical.
- **E2-NICE-2.** JAWS 662 was opened 2022-08-17 (entry says 08-16) and closed 2023-06-01 as "wontfix, not a JAWS bug": the maintainer's resolution was to give the dialog an accessible name with `aria-labelledby`, which the recommended variant already requires. Say so in `behavior`; it is the actual lesson of the issue, stronger than "verbosity observation".
- **E2-NICE-3.** Disclosure: the a11ysupport `details-summary` row for NVDA 2021.1 (changed expanded state fails on Chrome and Edge, passes on Firefox) is summarised in the md but has no entry of its own; the NVDA row for the native variant currently points only at the ARIA-button ARIA-AT report. Add `nvda-chrome-a11ysupport-summary` (observation, degraded) so `atEvidence.nvda` for the native variant has a native measurement.

---

## Findings index (round 2)

| ID | Severity | Subject | Correction in one line |
|---|---|---|---|
| A2-SHOULD-1 | SHOULD (at merge) | ADR-015 constraints | Enumerate `focusStrategy` = ADR-006 values; add `domAdjacent?` to the key list |
| A2-NICE-1 | NICE | ADR-010 sample | Align the two sample ids with the registry |
| A2-NICE-2 | NICE | ARCHITECTURE status line | Set CERTIFIED on merge |
| P2-NICE-1 | NICE | W1-315 | Locate `no-measured-evidence` in `atEvidence`; add the enum to seeded failures |
| P2-NICE-2 | NICE | Plan status line | Mark APPROVED on merge |
| E2-MUST-1 | MUST | all 12 files | Add `recommended.atEvidence`; return nine entries to `evidence-only` |
| E2-MUST-2 | MUST | 5 files | `focusStrategy` to the ADR-006 enum; drop it for live-region |
| E2-SHOULD-1 | SHOULD | 27 ARIA-AT entries, INDEX | Declare the count derivation or cite the page figures |
| E2-SHOULD-2 | SHOULD | INDEX | List the five missing ids |
| E2-SHOULD-3 | SHOULD | all entries | `platform` enum plus `platform_version` |
| E2-NICE-1..3 | NICE | disclosure, dialog | As listed |

Re-audit trigger: registry revision 2 with E2-MUST-1 and E2-MUST-2 (and A2-SHOULD-1 in ADR-015 so the enum is written once). The architecture and plan verdicts stand; the merge may carry A2-SHOULD-1, A2-NICE-1/2 and P2-NICE-1/2 as editorial changes recorded in the changelogs.

COMBINED-AUDIT-2 DONE
