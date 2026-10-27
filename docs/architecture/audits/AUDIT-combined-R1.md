# AUDIT combined, round 1: ARCHITECTURE revision 2 (ADR-015), PLAN revision 1, AT evidence registry

Auditor: ds-fable. Date: 2026-10-27. Branch `feature/component-architecture`, commits `6df7824` (ADR-015), `7b1021f` (plan audit R1), `7153174` (plan R1), `34fde60` (registry).
Scope: (1) only the changed text of ARCHITECTURE.md per `CHANGELOG-ARCH-R1.md` "Owner decision D2 revision", plus the unchanged text it now contradicts; (2) PLAN-WAVE-1.md R1 against `audits/AUDIT-plan.md`; (3) `docs/architecture/evidence/at-support/` (12 JSON, 12 md, INDEX.md) against ADR-015, research 03 and ARCHITECTURE.
Method for (3): every entry checked for the ADR-015 field set, tier, status and coverage; 16 of the 22 distinct source URLs fetched and compared with the claim; a11ysupport.io rows verified against the project's repository data (`accessibilitysupported/a11ysupport.io`, `data/tests/**`) because the site is client-rendered; ARIA-AT coverage read from its public GraphQL API (`testPlanVersions`, `testPlanReports`); research 03 re-read for tabs, radio, disclosure and the combobox evidence.

## Verdicts

| Subject | Verdict | Why in one line |
|---|---|---|
| ADR-015 and the revised ADR-010, ADR-013, Section 2 | **NOT-CERTIFIED** | The registry schema cannot carry what ADR-010 and ADR-013 4b consume (`id`, contract-versus-observation, structured constraints, a pre-test status); the evidence rule has no unit; the ADR-010 sample breaks its own honesty gate; ADR-001, ADR-007 and ADR-011 still mandate lanes the revision removed |
| PLAN-WAVE-1.md revision 1 | **APPROVED** | All five MUSTs and all SHOULD/NICE items of AUDIT-plan are applied as described; three follow-through edits fall out of the ADR-015 corrections |
| AT evidence registry | **FAIL** | Every contract entry carries `impact: blocker`, which under ADR-015 forbids shipping every pattern; no entry has an `id`; the ARIA-AT measured reports that exist for nine of the twelve patterns are not cited while APG contract pages stand in as "evidence"; disclosure omits the `<details>` path the architecture chose; one T1 source is misstated |

---

## 1. ARCHITECTURE revision 2

### What is right

The D2 revision is coherent where it was rewritten: Section 2 separates the support matrix from the evidence level; ADR-013 layer 4 is VoiceOver macOS + iPhone with the field list unchanged; 4b adds a CI gate; Guidepup cannot upgrade status; the release gate and manifest carry `test_status`; risk 5, Q4, ADR-005 step 8 and the owner table are aligned; ADR-015 options A, B, C are honest and C is the right call. The tier definitions and the six-month staleness rule are sound.

### MUST

**A-MUST-1. The registry schema lacks four things its consumers need.**
- `id`: ADR-015 says contracts reference entries by `file#id` and ADR-010's sample does (`#nvda-chrome`), but the field table has no `id`. Nothing can resolve.
- Entry kind: the table forces `impact` on every entry, so an APG or HTML contract entry (no observed behavior) must still say `blocker`, `degraded` or `cosmetic`. The delivered registry chose `blocker` for all of them, and the selection rule "a variant with a documented `blocker` on any AT is never shipped if an alternative exists" then rejects every pattern. Add `kind: contract | observation`; `impact` is required for `observation` and absent for `contract`; the blocker rule reads observations only.
- `test_status` enum: the registry (correctly) uses `pending-real-test` for VoiceOver rows before the lane runs; the ADR allows only `tested-real | evidence-only`. Add `pending-real-test` ("in the real-test lane, not yet logged; treated as evidence-only by the honesty gate").
- Structured constraints: ADR-013 4b and plan W1-317 fail CI when "a `decision` conflicts with the component's `focus.strategy` or `overlay.listboxMount`", but `decision` is prose. Add `constraints: { focusStrategy?, listboxMount?, nativeOnTouch?, mustNot?: string[] }` using the contract vocabulary so the check is computable.

**A-MUST-2. The rule of evidence has no unit.** "A `decision` requires at least one T1 source or at least two independent T2 sources" is per entry by the table, where each entry has exactly one source, so it is unsatisfiable per entry; the registry's INDEX reads it per pattern ("every decision has at least one T1 source in its JSON"). Define it: the unit is the pattern's recommended variant, carried in a pattern-level `recommended` block (`variant`, `constraints`, `supportedBy: [entry ids]`); T1 contract entries (APG, HTML, WAI-ARIA) establish the variant's requirements and count toward the rule for the *variant*; a per-AT support claim (`evidence-only` for NVDA, JAWS, TalkBack) requires at least one `observation` entry for that AT (T1 tracker or ARIA-AT report, or T2 data) or the explicit value `no-measured-evidence`, which the docs render as "no measured evidence; implemented to the contract". Without this, "evidence-only" with only a contract page behind it is option A under another name.

**A-MUST-3. The ADR-010 sample and the pattern list contradict the rules and the registry.**
- The sample's VoiceOver entries say `tested-real`, `tested_on: 2026-10-27`, `evidence: []`. No VoiceOver run has happened and the AT honesty gate in the same ADR requires a log reference for `tested-real`. Plan W1-301 asserts "the ADR-010 sample validates", so the fixture would pass a label the gate must reject. Correction: `test_status: pending-real-test`, no `tested_on`, `evidence: []` allowed only for that status.
- The sample references `at-support/combobox-select-only.json#nvda-chrome`; the file is `select-only-combobox.json` and has no ids. ADR-015's list names ten patterns including wave-2 ones (combobox-editable, listbox, menu-button) and omits five that wave 1 needs and the registry delivered (button, checkbox, text-field, popover-nonmodal, live-region). Correction: one list, the twelve registry names, in ADR-015; sample ref `at-support/select-only-combobox.json#nvda-chrome-apg`.

**A-MUST-4. Three unchanged ADRs now contradict the revised ADR-013.**
- ADR-001 consequences: "A real floor test lane is mandatory (ADR-013)" while ADR-013 now reports iOS 17 and the Android floor as `not run`. Correction: "mandatory for desktop Chromium 114 and Firefox 125; the iOS 17 and Android floor rows are verified by forced-false path parity and labelled `not hands-on verified` in the manifest and docs until a device exists". Section 2's floor table gets the same one-line evidence note.
- ADR-007: "Each kind row is certified on physical iOS Safari and Android Chrome". Correction: "on physical iOS Safari; Android Chrome rows are `not run` and labelled so until a device exists".
- ADR-011 interaction gates name Moto G Power 5G (2024) and iPhone 15. Correction: the Android row is `not run` with the honesty label; the iPhone row is the owner's device as recorded in the manifest; the named devices stay as the reference targets for when hardware exists.

### SHOULD

- **A-SHOULD-1.** Scope the blocker-avoidance rule by platform or pointer class ("never shipped *on the platforms where the blocker is documented*"); as written, the TalkBack blocker alone would forbid the desktop custom listbox, which the worked example in the same paragraph ships.
- **A-SHOULD-2.** ADR-013 4b "an entry for each AT in the support matrix": the matrix includes secondary pairs (Narrator + Edge, VoiceOver + Chrome, JAWS + Firefox) that the registry does not carry. State "each primary pair: NVDA, JAWS, VoiceOver macOS, VoiceOver iOS, TalkBack; secondary pairs optional".
- **A-SHOULD-3.** T2 reads as a closed list. Write "such as", and either name measured consultancy write-ups (TetraLogical's live-region tests are measured across NVDA, JAWS, Narrator, Orca, VoiceOver macOS and iOS, TalkBack; verified) as T2 or state they are T3; the registry classifies them T2.
- **A-SHOULD-4.** Define `listboxMount` by DOM placement. WebKit 289338 (verified) is about a listbox mounted outside the combobox container (end of `<body>`); the inline comparison works; it says nothing about top-layer rendering. Define `top-layer` as "DOM-adjacent to the trigger, promoted via `popover`" and `inline` as "DOM-adjacent, not promoted"; forbid portal-to-body in both. The registry's desktop decision then maps onto the contract instead of conflicting with `byAnyPointer.fine: top-layer`.
- **A-SHOULD-5.** Section 2: "for now only VoiceOver … is `tested-real`" reads as a current state. Write "is in the real-test lane; its entries are `pending-real-test` until a logged run".

### NICE

- **A-NICE-1.** The owner table still says D1 "awaits confirmation" while the plan applies it as decided; record the confirmation or keep the plan's wording provisional.
- **A-NICE-2.** ADR-015 sources: name ARIA-AT explicitly as the "AT support tables" of T1 (research 07 already cites it) so the registry cannot miss it again.

---

## 2. PLAN-WAVE-1.md revision 1

### AUDIT-plan findings, verified against the text

| Finding | Status | Where verified |
|---|---|---|
| MUST-1 runtimes, controlled pipeline, probe | Resolved | W1-115, W1-120/121/122 with ADR-003 bridge rows and retention criteria; W1-316; G1 and G2 wording; template `.c/.d/.e` depend on W1-12x; W1-006 rule 4 |
| MUST-2 S-TEST start, codegen input, missing rows | Resolved | Section 1 start rules; W1-308a/b; W1-304 depends on W1-112b; Section 9 lists K1b, R1-R3, G-CODE, S-TEST-0, PROBE, CLOSE |
| MUST-3 shared files | Resolved | W1-001 owns root files and all P0 devDependencies; lockfile rule in Section 0; W1-201 glob; W1-007 shared rows only; W1-005 testing devDependencies; `testing/lint/{boundaries,stylelint,contract}` and raw values removed from W1-307 |
| MUST-4 W1-107 | Resolved | Typeahead counts toward the 3 KiB kernel; a miss goes to W1-113 |
| MUST-5 registry location | Resolved | W1-305 extends `apps/site/agentic/integration.ts` and `apps/site/package.json`; no root file |
| SHOULD-1 to SHOULD-12 | Applied | 6.3 blocking column; W1-203 light only and forced-colors fixtures; W1-205 dependency; W1-502a/b with the two not-applicable reasons; W1-006 rules 5-6 and `.e`; W1-511 channels and `retries: 0`; W1-304 types file and `.c/.d` `classes`/prop-or-slot; C03s/C03c, C02.a1/a2, C10.a1/a2 and the ceilings paragraph; W1-106a/b, W1-112a/b, W1-309a/b/c; `.c` retention; `src/generated/`; Section 1.2 citations |
| NICE-1 to NICE-8 | Applied | G0..G5 without gaps; counts removed; storybook in W1-001 and W1-312; D1 both labels; Dialog 8 KiB; iPhone pin and vanilla `idFactory`; `testing/{licence,bcd}` and workflow ownership; W1-204 additions |

The ADR-015 wiring is complete and in the right places: W1-315 schema, W1-317 staleness/conflict/coverage, W1-318 `test_status` wiring, W1-319 honesty scan, W1-301 schema field, W1-314 jobs, W1-505 VoiceOver packs, W1-512/513 owner tasks, W1-514 optional NVDA lane, W1-503 floor lane, W1-508 manifest, G5 condition, Section 0 ownership of `at-support/` with fixtures to decouple.

### Follow-through edits (SHOULD; they fall out of Section 1 above)

- **P-SHOULD-1.** W1-114 is listed inside S-TEST and also as one of S-TEST's start preconditions, and its "Depends on" (W1-102, W1-103) omits the adapter runtimes it needs to render twice. Make W1-114 the first S-TEST task with dependencies W1-102, W1-103, W1-120..122, and drop it from the precondition sentence.
- **P-SHOULD-2.** W1-315 enumerates the ADR-015 field list and W1-317 checks `decision` prose. After A-MUST-1/2: W1-315 validates "the ADR-015 field table and the pattern-level `recommended` block" (including `id` uniqueness, `kind`, the `pending-real-test` status and `no-measured-evidence`); W1-317 compares the entry `constraints` with `focus.strategy` and `overlay.listboxMount`.
- **P-SHOULD-3.** W1-301 "the ADR-010 sample validates" depends on A-MUST-3; note it so the fixture is not copied before the sample is fixed.

### NICE

- **P-NICE-1.** Section 0 presents D1 as applied; ARCHITECTURE still lists it as pending (A-NICE-1).
- **P-NICE-2.** W1-505 "a pack exists for every component before M4 ends" needs each component's `.a` contract; add the dependency.

---

## 3. AT evidence registry

### Checks that pass

- **Field set:** every one of the 65 entries carries the fifteen ADR-015 fields; `retrieved` is 2026-10-27 and `next_review` 2027-01-27 (three months, within the six-month cap).
- **Coverage:** every one of the twelve patterns has NVDA, JAWS, TalkBack, VoiceOver macOS and VoiceOver iOS entries (checkbox, dialog-modal and text-field have a sixth).
- **Tiers:** APG, HTML Standard, WAI-ARIA 1.2, NV Access, Freedom Scientific, WebKit and w3c/aria-practices trackers as T1 and a11ysupport.io as T2 match ADR-015; TetraLogical as T2 is defensible (A-SHOULD-3).
- **Status labels:** NVDA, JAWS and TalkBack are `evidence-only` throughout; VoiceOver rows are `pending-real-test`; the md notes never say tested or certified.
- **URLs and claims, 16 verified:** NVDA 17352 and 18721; JAWS standards-support 700 and 469; WebKit 284804, 231724 and 289338; aria-practices 2855; a11ysupport checkbox-two-state NVDA/Edge 2024.4/130/2024-12-06, modal-dialog JAWS 2023.2212.23/Chrome 108, NVDA 2024.3/Chrome 129, TalkBack 13.5/Chrome 108 (presence and limit-reading both fail), VoiceOver macOS 13.1 (partial), VoiceOver iOS 16.2 (presence pass, limit partial), editable-combobox JAWS 2023.2307.37/Chrome 116 `aria-haspopup=listbox` fail, aria-errormessage NVDA 2023.1/Edge 114 pertinent fail, aria-describedby matrix (JAWS pass; TalkBack change fail; VoiceOver iOS change fail; VoiceOver macOS change partial, 2021-10-19), native checkbox matrix (JAWS, TalkBack 8.1, VoiceOver iOS 13.2.3, VoiceOver macOS 10.15 all pass, 2019-2021); TetraLogical (published 2024-05-01, updated 2026-04-07, measured); HTML Standard popover text; APG tabs. All say what the entries claim except the four items in E-MUST-5 and E-SHOULD-1/3/6 below.

### MUST

**E-MUST-1. `impact: blocker` on every contract entry.** 31 entries whose source is an APG pattern page, the HTML Standard or WAI-ARIA 1.2 (all five rows of button, switch and tabs; four of radio-group; three of disclosure and popover-nonmodal; two of tooltip; one each in checkbox, select-only-combobox, text-field, live-region) describe no observed failure, say so in `behavior` ("this is a design contract, not an NVDA test result"), and still set `impact: blocker`. ADR-015 then forbids shipping every pattern. Correction (with A-MUST-1): `kind: contract`, no `impact`, for those 31; `blocker` only where a task cannot be completed by observation: WebKit 289338 (VoiceOver iOS), APG 2855 (TalkBack), aria-modal TalkBack 13.5 (presence and limit both fail), aria-errormessage NVDA/Edge.

**E-MUST-2. No entry has an `id`.** ADR-010 contracts and plan W1-317 reference `file#id`; nothing in the registry can be referenced. Correction: `id` = `<at>-<browser>-<source>` per entry, unique per file (`nvda-chrome-apg`, `talkback-chrome-apg2855`, `vo-ios-safari-webkit289338`), listed in INDEX per file.

**E-MUST-3. ARIA-AT measured reports exist and are not cited.** ADR-015 T1 names "WAI-ARIA APG and its AT support tables". The ARIA-AT API (2026-10-27) lists CANDIDATE reports for JAWS + Chrome, NVDA + Chrome and VoiceOver macOS + Safari on: Modal Dialog Example; Checkbox Example (Two State); Switch Example, Switch Example Using HTML Checkbox Input, Switch Example Using HTML Button; Disclosure of Answers to FAQ Example and Disclosure Navigation Menu Example; Accordion; Tabs with Manual Activation; Radio Group Example Using Roving tabindex and Using aria-activedescendant; Alert Example; Command Button Example; Toggle Button. That covers button, checkbox, switch, disclosure, tabs, radio-group, dialog-modal, live-region (alert) and tooltip's trigger semantics: nine of twelve patterns. The registry cites none, and its NVDA and JAWS entries for button, switch, tabs, disclosure, radio-group (JAWS), popover-nonmodal, tooltip and live-region (TalkBack) rest on a contract page alone. Select-only combobox has no ARIA-AT report (confirmed), so there the contract-only basis must be stated. Correction: for each (pattern, pair) with a report, one `observation` entry: report URL (`aria-at.w3.org/report/<id>/targets/<n>`), AT and browser versions from the report, must-assertion pass/fail summary and negative side effects, `source_tier: T1`, candidate phase noted in `behavior`; for pairs without a report or T2 data, the explicit `no-measured-evidence` value of A-MUST-2 rather than a contract entry presented as evidence.

**E-MUST-4. Disclosure ignores `<details>/<summary>`.** The recommended variant is the ARIA button pattern; the discarded list never evaluates native `<details>`, which ARCHITECTURE Section 4 row 6 decided ("Built on `<details>`; exclusive groups use `<details name>`"), plan C06 implements, research 03 prefers ("Native `<details>/<summary>` is preferred when its semantics and keyboard behavior fit") and ADR-015's tie-break ranks first ("native element over simpler ARIA"). Correction: evaluate `<details>` + `<summary>` (+ `name`) as the primary candidate with evidence (a11ysupport `details`/`summary` element pages; the ARIA-AT disclosure reports as the comparison baseline; WebKit and Chromium trackers on `summary` role and expanded-state announcement; TalkBack behavior) and either recommend it, with `constraints` matching C06, or document the AT reason it loses, which then becomes an ARCHITECTURE change request, not a silent divergence.

**E-MUST-5. NVDA 12718 is misstated.** The radio-group NVDA entry says the group description "was also absent for radios". The issue (verified, open, NVDA 2021.1) reports the gap for checkbox groups in browse mode and states that radio buttons behaved as expected because focus mode reads the description. Correction: move the observation to checkbox.json with `impact: degraded`, or keep it in radio-group with `impact: none` and the accurate text; back the radio-group NVDA row with the ARIA-AT Radio Group reports.

### SHOULD

- **E-SHOULD-1.** HTML Standard `source_date`s: every multipage page shows "Last Updated 26 October 2026" (verified on popover.html and forms.html). The registry's 2026-05-26 (label), 2026-10-14 (input), 2026-05-28 (dialog) and 2025-09-17 (button) are unsupported; use the single spec date.
- **E-SHOULD-2.** Select-only combobox desktop decision "render the popup inline/adjacent, not remotely at the end of body" conflicts in wording with the contract's `byAnyPointer.fine: top-layer`. After A-SHOULD-4, express it as `constraints: { domAdjacent: true, listboxMount: { coarse: inline } }` so W1-317 passes C10.
- **E-SHOULD-3.** Tabs: "manual activation by default" is attributed to APG, but APG recommends automatic activation when panels display without noticeable latency (verified) and research 03 says the same. State the manual default as the library's own conservative choice with that rationale, or default to automatic for preloaded panels per APG; plan C05 tests both, so the contract default must be explicit either way.
- **E-SHOULD-4.** Text-field: a11ysupport has 2025-12-24 aria-errormessage results the registry omits: VoiceOver macOS 15.7.3 + Safari 18.6 pertinent **fail**; VoiceOver iOS 18.5 pass; TalkBack 16.2 + Chrome 143 pass; JAWS 2023.2306.38 pass on Chrome and Edge, fail on Firefox. Add them; they decide ADR-014's "`aria-errormessage` only where tested" for wave 1.
- **E-SHOULD-5.** Radio-group: the entry says "preserve native arrow behavior rather than double-handling it" while plan C04 says "roving per ADR-006 table". Encode as `constraints: { focusStrategy: "native-roving" }` and have ADR-006/C04 state that for native radios the kernel observes focus for `data-active` and does not reimplement arrows (research 03: "custom code must not double-handle it").
- **E-SHOULD-6.** Status details: NVDA 17352 was closed and converted to discussion #17395 on 2024-11-12; JAWS 700 was closed 2023-06-01 as a duplicate of #662 (cite #662); WebKit 289338 states iOS 18 / Safari 18 (entry says "not stated"); APG 2855's 2025-06-13 is a user confirmation, latest activity 2025-10-29.

### NICE

- **E-NICE-1.** `at_version` and `browser_version` hold free text ("not specified by APG"); the schema should allow `null` so W1-317 can compute staleness per version where one exists.
- **E-NICE-2.** INDEX "every decision has at least one T1 source" is true per pattern; restate it in the A-MUST-2 vocabulary.
- **E-NICE-3.** Dialog VoiceOver macOS "Safari 16.1": the source row stores browser_version `6.1` (a source typo); keep 16.1 and note it.

---

## Findings index

| ID | Severity | Subject | Correction in one line |
|---|---|---|---|
| A-MUST-1 | MUST | ADR-015 | Add `id`, `kind: contract\|observation` (impact on observations only), `pending-real-test`, structured `constraints` |
| A-MUST-2 | MUST | ADR-015 | Unit of the evidence rule = pattern's `recommended` block; per-AT claims need an observation or `no-measured-evidence` |
| A-MUST-3 | MUST | ADR-010, ADR-015 | Sample VoiceOver rows `pending-real-test` without `tested_on`; one pattern list of twelve; fix the sample ref |
| A-MUST-4 | MUST | ADR-001, ADR-007, ADR-011 | Floor lane, kind certification and device gates reworded for `not run` rows with the honesty label |
| A-SHOULD-1..5 | SHOULD | ADR-015, ADR-013, Section 2, ADR-005 | Blocker rule per platform; primary pairs only in 4b; T2 "such as"; `listboxMount` by DOM placement; "in the lane" wording |
| A-NICE-1..2 | NICE | Owner table, ADR-015 sources | D1 status; name ARIA-AT |
| P-SHOULD-1..3 | SHOULD | W1-114, W1-315/317, W1-301 | Move W1-114 into S-TEST with runtime deps; validate the corrected schema; note the sample dependency |
| P-NICE-1..2 | NICE | Section 0, W1-505 | D1 wording; `.a` dependency |
| E-MUST-1 | MUST | 31 contract entries | `kind: contract`, no `impact`; `blocker` only for the four observed failures |
| E-MUST-2 | MUST | all entries | Add unique `id` per entry |
| E-MUST-3 | MUST | nine patterns | Cite the ARIA-AT candidate reports per pair; `no-measured-evidence` where none exists |
| E-MUST-4 | MUST | disclosure | Evaluate `<details>/<summary>` as primary candidate; recommend it or raise an ARCHITECTURE change |
| E-MUST-5 | MUST | radio-group NVDA | Correct NVDA 12718 (checkbox groups, radios fine) |
| E-SHOULD-1..6 | SHOULD | dates, select-only, tabs, text-field, radio, statuses | As listed |
| E-NICE-1..3 | NICE | schema, INDEX, dialog | As listed |

Re-audit trigger: ARCHITECTURE revision 3 resolving A-MUST-1 to A-MUST-4; registry revision resolving E-MUST-1 to E-MUST-5 (the ARIA-AT entries may be added file by file, nine files); plan edits P-SHOULD-1 to P-SHOULD-3 can land in the same commit as the ADR fix. The plan verdict stands; it becomes effective when ADR-015 is certified.

COMBINED-AUDIT-1 DONE
