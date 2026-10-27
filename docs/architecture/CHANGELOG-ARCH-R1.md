# CHANGELOG-ARCH-R1

Round 1 audit: `audits/AUDIT-architecture.md` (NOT-CERTIFIED, 5 MUST). Revision status: REVISION-1-FOR-AUDIT.

| Finding | Change | Section |
|---|---|---|
| MUST 1 | Removed "task before this ADR is final"; licences marked verified 2026-10-27; reference-size measurement restated as a wave-1 evidence task that can revise ADR-011 only by ADR; Q1 made informational | ADR-004, Q1 |
| MUST 2 | Provisional shared ceilings added (overlay+geometry 4 KiB, collection+focus 3, live region 1, kinds resolver+parser 2) with rationale, derived totals (Popover/Tooltip 8, Select 16, Input 6) and revision measurement; Q2 reworded | ADR-011, Q2 |
| MUST 3 | `SJRuntime` object, `createRuntime`, `SJProvider`, `mount(el, runtime)`, deterministic server/client defaults, lint provenance; `runtime` added to contract | ADR-003, ADR-010 |
| MUST 4 | View Transitions split into same-document and cross-document; every "-" replaced by explicit versions or "none"; `<details name>` row added; `base-select` and `position-area` cells aligned to research 01 | Section 2 |
| MUST 5 | (a) textarea kinds use `enterkeyhint=enter`, excluded from position; (b) `cc-exp` digits-only, engine inserts separator; (c) `amount-signed` kind with sign control; (d) `country` defaults to `<select>` with `country`, text variant `country-name` | ADR-007 |
| SHOULD 6 | Q6 closed; Vue peer `>=3.5.0` decided | ADR-002, Section 5 |
| SHOULD 7 | `listboxMount` keyed on `any-pointer: coarse`, stated as a proxy for AT populations | ADR-005 step 8, ADR-008 |
| SHOULD 8 | `data-active` set in every composite | ADR-006 |
| SHOULD 9 | Per-framework compound naming decided | ADR-002 |
| SHOULD 10 | Adapters never import CSS; `sideEffects` only in `@ramoslabs/css` | ADR-002 |
| SHOULD 11 | Custom elements in light DOM, FACE via `attachInternals()` | ADR-002, ADR-014 |
| SHOULD 12 | `kinds.contract.json` + `kinds.schema.json` as table home; MCP `get_kind` | ADR-007 |
| SHOULD 13 | Risk added: unlayered consumer resets; layer order documented | Section 5.2 risk 9 |
| SHOULD 14 | Text-nodes-only rule, layer-2 text-safety test, risk added | ADR-002, ADR-013, risk 10 |
| SHOULD 15 | Contracts described as build-time input ("generates", not "imports") | Section 1.1 |
| NICE 16 | `<details name>` floor and owned fallback | Section 2, wave 1 row 6 |
| NICE 17 | `tax-id` omits `autocomplete` | ADR-007 |
| NICE 18 | Floor devices pinned to OS versions | Section 5.2 risk 5 |
| NICE 19 | `$schema` URL served by site deploy (release gate) | ADR-010 |
| NICE 20 | Pinned, lockfile-verified devDependencies in provenance gate | Section 5.2 risk 8 |
| (new) | "Decisions needed from owner" section (D1 floor, D2 device lab); no MUST required one | Section 6 |

## Owner decision D2 revision (2026-10-27)

Owner can test VoiceOver (macOS + iPhone) and has a Windows PC; no JAWS licence. Real testing is VoiceOver only; NVDA, JAWS, TalkBack are evidence-only.

| Change | Section |
|---|---|
| New ADR-015 Evidence-based AT support: registry schema (`evidence/at-support/<pattern>.json`), source tiers T1/T2/T3, decision rule (>=1 T1 or >=2 independent T2, T3 never decides, conservative on conflict), "most recommendable" selection rule, honesty labels, wave-1 certification meaning, 6-month staleness CI gate, optional NVDA lane | ADR-015 |
| Contract schema carries per-AT `atSupport` with `test_status`, `tested_on`, evidence refs; CI gate against labelling evidence-only ATs as tested; registry/MCP expose `test_status` | ADR-010 |
| Layer 4 changed to VoiceOver macOS + iPhone real protocol; evidence gate 4b added; Guidepup cannot upgrade status; real floor lane limited to desktop Chromium 114 / Firefox 125, physical iOS 17 and Android floor reported "not run"; release gates and manifest updated | ADR-013 |
| Support matrix vs evidence level distinguished | Section 2 |
| Risk 5 rewritten (untested ATs); Q4 and ADR-005 evidence wording aligned | Section 5, ADR-005 |
| D2 marked resolved by owner | Decisions needed from owner |
| Last line set to REVISION-2-FOR-AUDIT | end of file |

## Combined audit R1 (audits/AUDIT-combined-R1.md)

| Finding | Change | Section |
|---|---|---|
| A-MUST-1 | Registry schema: added `id`, `kind: contract\|observation` (`impact` required only for observations), `test_status: pending-real-test`, structured `constraints` (`focusStrategy`, `listboxMount`, `nativeOnTouch`, `mustNot`); file shape `{ pattern, recommended, entries[] }`; nullable versions (E-NICE-1) | ADR-015 |
| A-MUST-2 | Evidence-rule unit defined: the pattern's `recommended` variant (`variant`, `constraints`, `supportedBy`, `atEvidence`); contract entries count for the variant; per-AT claims need an observation or `no-measured-evidence` | ADR-015 |
| A-MUST-3 | ADR-010 sample VoiceOver rows now `pending-real-test` without `tested_on`; refs fixed to `select-only-combobox.json#...-apg`; one list of twelve patterns in ADR-015; honesty gate allows empty evidence only for `pending-real-test` | ADR-010, ADR-015 |
| A-MUST-4 | Floor lane, kind certification and device gates reworded for `not run` rows with the `not hands-on verified` label; evidence note under the floor table | ADR-001, ADR-007, ADR-011, Section 2 |
| A-SHOULD-1 | Blocker rule scoped to platforms where the blocker is documented | ADR-015 |
| A-SHOULD-2 | Evidence gate requires entries for primary pairs; secondary optional | ADR-013 4b |
| A-SHOULD-3 | T2 written as "such as", measured consultancy tests named as T2 | ADR-015 |
| A-SHOULD-4 | `listboxMount` defined by DOM placement; portal-to-body forbidden | ADR-005 step 8 |
| A-SHOULD-5 | "in the real-test lane, `pending-real-test` until a logged run" wording | Section 2 |
| A-NICE-1 | D1 kept "awaits confirmation"; plan wording made provisional to match | Owner table, PLAN Section 0 |
| A-NICE-2 | ARIA-AT named as T1 AT support tables | ADR-015 |
| E-SHOULD-5 (cross-ref) | `focus.strategy: native-roving` for native radios | ADR-006 |
| Status | Last line REVISION-3-FOR-AUDIT | end |

## G0 audit editorial (SHOULD-5)

- ADR-002 table, `@ramoslabs/testing` Role: "spec runner, fixtures, lint rules, size and contrast tooling (private, unpublished)", matching the package README (AUDIT-G0 round 2, SHOULD-5).
