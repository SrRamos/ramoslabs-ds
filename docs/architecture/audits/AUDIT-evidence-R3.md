# AUDIT evidence registry, round 3

Auditor: ds-fable. Date: 2026-10-27. Subject: `docs/architecture/evidence/at-support/` at commit `f9e9fc5` ("registry R2 conformance fixes; validator passes"). Reference: `audits/AUDIT-combined-R2.md` section 3 (E2-MUST-1, E2-MUST-2, E2-SHOULD-1..3, E2-NICE-1..3) and the "R2 conformance fixes" section of `CHANGELOG-EVIDENCE-R1.md`. ADR-015 (CERTIFIED) and PLAN-WAVE-1 (APPROVED) are out of scope except where the registry must agree with them.
Method: (1) entry-by-entry comparison of every JSON file at `474e392` (the R2 subject) against HEAD, flagging any entry or field that disappeared and any field that changed outside the set the R2 corrections were meant to touch; (2) an independent validator (file shape, `id` uniqueness, `supportedBy` and `atEvidence` resolution to observation entries, `kind`/`impact` rule, `test_status`, `focusStrategy` and `platform` enums, `platform_version` presence, review window, duplicate source/AT/browser signatures, derivation sentence on ARIA-AT entries, INDEX completeness); (3) the author's `validate_registry.py` run and read; (4) the six entries that are new since R2 checked against the a11ysupport repository data and the TetraLogical post verified in R1 and R2.

## Verdict: PASS

Both R2 MUSTs are resolved and verified. The parallel edit by kimi-ds and the haiku agent produced no lost data: every R2 entry is either present unchanged outside the corrected fields or replaced by a strictly better observation entry with the same AT and platform, and `recommended.variant` and `supportedBy` are byte-identical in all twelve files. Three SHOULDs are required at merge: the changelog does not describe what actually happened in the collision, one `no-measured-evidence` claim is contradicted by the source the same file cites, and the author validator checks less than ADR-015 requires.

## Status per R2 finding

| Finding | Status | Verified how |
|---|---|---|
| E2-MUST-1 `recommended.atEvidence` | **Resolved** | All twelve files carry `atEvidence` with exactly the five keys `nvda`, `jaws`, `voiceover-macos`, `voiceover-ios`, `talkback`; every referenced id exists and is `kind: observation`; no `atEvidence` says `no-measured-evidence` while an observation for that pair exists in the file, and no observation is left unreferenced. The nine `test_status: no-measured-evidence` entries are gone: six were reset to `evidence-only` (popover NVDA, JAWS, TalkBack; select-only NVDA; switch TalkBack; tabs TalkBack) and three (button TalkBack, live-region TalkBack, radio TalkBack) were replaced by observation entries, see E3-SHOULD-1 |
| E2-MUST-2 `focusStrategy` vocabulary | **Resolved** | Values in use are exactly `native`, `roving`, `activedescendant`, `native-roving`; select-only → `activedescendant`, dialog, tooltip and popover → `native`, live-region has no key (recommended and all entries) |
| E2-SHOULD-1 ARIA-AT count derivation | Applied | The sentence "MUST counts exclude ARIA-AT's per-command negative-side-effect assertions; side effects are reported separately" is appended to all 27 ARIA-AT `behavior` texts and stated once in INDEX; the numbers themselves are unchanged from R2 (verified then) |
| E2-SHOULD-2 INDEX ids | Applied | All 81 ids are listed in INDEX |
| E2-SHOULD-3 `platform` enum | Applied | Every entry uses `windows | android | macos | ios | cross` and carries `platform_version` (nullable); the OS versions that R2 had inside `platform` are preserved in `platform_version` (`11`, `12, 13, and 14 reported`, `18`, `16`, `15.7.3`, `18.5`, `10 original; Windows 11 later log`, `7`) |
| E2-NICE-1 WebKit 162041 | Applied | `source_date` now ends "RESOLVED FIXED 2016-09-19" |
| E2-NICE-2 JAWS 662 | Applied | `source_date` is "opened 2022-08-17 …" and `behavior` states the wontfix closure and the `aria-labelledby` resolution |
| E2-NICE-3 native NVDA summary row | Applied | `nvda-chrome-a11ysupport-summary` added (observation, degraded, NVDA 2021.1 fails the changed expanded state on Chrome and Edge, passes on Firefox: matches the `details-summary` test data dated 2022-05-27) and referenced from `atEvidence.nvda` |

## Collision check (kimi-ds and the haiku agent editing in parallel)

- **No entry lost.** Five R2 ids are absent from HEAD, each replaced in the same file by an observation for the same AT and platform: `talkback-chrome-apg-button` → `talkback-chrome-a11ysupport-button`; `vo-ios-safari-apg-button` → `vo-ios-safari-a11ysupport-button`; `talkback-chrome-waiaria-status` → `talkback-chrome-tetralogical-live`; `talkback-chrome-apg-radio` → `talkback-chrome-a11ysupport-radio`; `talkback-chrome-apg-tooltip` → `talkback-chrome-a11ysupport-describedby`. In every case a contract entry became a measured one; INDEX and the md notes were updated accordingly (button.md, tooltip.md, radio-group.md, live-region.md).
- **No field lost, no silent rewrite.** Across the 75 surviving entries the only changed fields are `test_status` (the six resets), `constraints.focusStrategy`, `platform`, the new `platform_version`, `behavior` (appended, never rewritten) and the two `source_date` corrections. `recommended.variant` and `supportedBy` are identical in all twelve files; the four blockers are the same four as in R2; no duplicate source/AT/browser signature exists.
- **One formatting divergence.** `dialog-modal.json` was re-serialised pretty-printed (236 lines) while the other eleven files keep one entry per line; that is the 238-line diff. Content is intact (E3-NICE-1).
- **The six new entries say what their sources say.** The native-button matrix (TalkBack 7.3.0/Chrome 76 in 2019 and 13.5/116 in 2023; VoiceOver iOS 12.3.1 to 16.6) passes name, role and shortcuts as stated; the radio test page cited for TalkBack is TalkBack 7.3.0/Chrome 76/Android 7, 2019-08-21, role and checked state pass as stated; the TetraLogical fixtures include TalkBack on Chrome and Firefox as stated; the describedby matrix's TalkBack row (initial contribution pass, change while focused fail) is as stated; the NVDA summary row is as stated.

## Findings

### SHOULD (required at merge)

- **E3-SHOULD-1. The changelog does not match the files.** The "R2 conformance fixes" section says six `no-measured-evidence` entries were reset (there were nine; three were replaced instead), never mentions the five contract-to-observation replacements, says of E2-SHOULD-2 that "the five named ids were already present" (they were in INDEX but not in any JSON at `474e392`), and carries two contradictory lines on the JAWS 662 date ("left unchanged" and "2022-08-17 … added"; the file has 08-17). The changelog is the audit trail for the six-month reviews. Correction: one bullet per replacement (old id → new id, source, who made it), the count "nine: six reset, three replaced", and a single JAWS 662 line.
- **E3-SHOULD-2. `atEvidence.voiceover-ios: no-measured-evidence` in radio-group.json is contradicted by the file's own source.** The a11ysupport native-radio test cited for `talkback-chrome-a11ysupport-radio` also carries a VoiceOver iOS 12.3.1/Safari 12.3.1 row (2019-08-21) passing name, role, checked and unchecked state, state change, position in set and shortcuts. Correction: add `vo-ios-safari-a11ysupport-radio` (observation, `none`, `pending-real-test`, historical) and reference it from `atEvidence.voiceover-ios`. The other `no-measured-evidence` claims hold: a11ysupport has no TalkBack or VoiceOver iOS rows for `switch`, `tab` or `tablist`, ARIA-AT has no select-only report, and the popover attribute has no measured rows.
- **E3-SHOULD-3. The author validator checks less than ADR-015 requires**, so "validator passes" is weaker than it sounds. It does not check `supportedBy` resolution, the `kind`/`impact` rule (`impact` absent on contracts, present on observations), the review window, that `atEvidence` ids are observations (not contracts), or that a pair declared `no-measured-evidence` has no observation in the file. All of these pass today (my validator), but W1-315 must encode them; until then the script should not be described as the conformance gate. Correction: add the five checks, or label the script "schema subset" in the changelog.

### NICE

- **E3-NICE-1.** Re-serialise `dialog-modal.json` in the one-entry-per-line style of the other files (or all twelve pretty-printed) so future diffs show content, not formatting.
- **E3-NICE-2.** `talkback-chrome-a11ysupport-radio` has `impact: none`, but the same result row fails `convey_posinset` (position in group not announced), which matters for a group named by `fieldset`/`legend`; `degraded` with that sentence is more accurate.
- **E3-NICE-3.** The native-button matrix also records `convey_name_change` failing on TalkBack 8.2/Chrome 84 and on NVDA and JAWS with Chrome and Edge (2020-2021), which is direct measured support for the `changing-toggle-label` prohibition in button.json; worth an observation entry.
- **E3-NICE-4.** `nvda-chrome-a11ysupport-summary` has `browser_version: null` although the source row is Chrome 101 and Edge 101; record "101 (Chrome and Edge)".

## Findings index

| ID | Severity | Where | Correction in one line |
|---|---|---|---|
| E3-SHOULD-1 | SHOULD (at merge) | CHANGELOG-EVIDENCE-R1 | Document the five replacements, the nine-entry count and one JAWS 662 line |
| E3-SHOULD-2 | SHOULD (at merge) | radio-group.json | Add the VoiceOver iOS a11ysupport radio observation; reference it from `atEvidence` |
| E3-SHOULD-3 | SHOULD (at merge) | validate_registry.py, changelog | Add the five missing checks or label the script a subset |
| E3-NICE-1..4 | NICE | dialog-modal.json, radio-group.json, button.json, disclosure.json | As listed |

The registry may be merged with the three SHOULDs applied in the same commit; no further audit round is needed for them, a file-level check of radio-group.json and the changelog suffices.

EVIDENCE-AUDIT-3 DONE
