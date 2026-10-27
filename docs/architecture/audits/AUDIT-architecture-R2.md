# AUDIT — ARCHITECTURE.md (certification round 2)

Auditor: ds-fable. Input: `ARCHITECTURE.md` at commit b873e74 (STATUS: REVISION-1-FOR-AUDIT) and
`CHANGELOG-ARCH-R1.md`, diffed against the round-1 draft (6fb49b5). Scope: the 20 round-1
findings, every changed line, the independent licence verification the orchestrator requested,
and the coherence of the new ADR-011 ceilings with research 02 and 05.

## Global verdict: **CERTIFIED**

No MUST is open. All five round-1 MUSTs are resolved and verified; all ten SHOULDs and five NICEs
are applied. One new defect was found in a changed line (S-21, a single floor-table cell about an
enhancement that is disabled on the floor); it does not change any decision and is listed as a
required correction to apply at merge, not as a certification blocker, by the same rule used in
`AUDIT-research-R2.md`. Certification carries two stated assumptions: owner decision D1 = A
(which ADR-001 already decides) and D2 funded before wave-1 certification (ADR-013 requires the
floor lane).

---

## Independent licence verification (ADR-004)

The author's "verified 2026-10-27" claim was re-derived from three sources that do not share a
code path with the author's tools: (1) each repository's rendered LICENSE page, (2) the `license`
field of the published npm packages, (3) the raw LICENSE text and its copyright line. All three
agree with the ADR-004 table.

| Reference | ADR-004 says | npm `license` (package, version) | Raw LICENSE (copyright line) |
|---|---|---|---|
| React Aria / React Stately | Apache-2.0 | `react-aria` 3.53.1, `react-stately` 3.51.0: Apache-2.0 | Apache License 2.0 (adobe/react-spectrum) |
| Radix UI Primitives | MIT | `@radix-ui/react-primitive` 2.2.0, `@radix-ui/react-select` 2.4.1: MIT | MIT, © 2022 WorkOS |
| Zag.js / Ark UI | MIT | `@zag-js/core` 1.47.0, `@ark-ui/react` 5.39.3: MIT | MIT, © 2021 Chakra UI; MIT, © 2024 Chakra Systems Inc. |
| Headless UI | MIT | `@headlessui/react` 2.2.10, `@headlessui/vue` 1.7.23: MIT | MIT, © 2020 Tailwind Labs |
| Melt UI | MIT | `@melt-ui/svelte` 0.86.6: MIT | MIT, © 2023 Thomas G. Lopes |
| Floating UI | MIT | `@floating-ui/core` 1.8.0, `@floating-ui/dom` 1.8.0: MIT | MIT, © 2021 Floating UI contributors |

All retrieved 2026-10-27. The ADR-004 statement stands. Recommendation (NICE, not blocking): record
the npm package versions above in `docs/architecture/evidence/licences.md` so the claim is
reproducible without re-fetching.

## Byte-ceiling coherence (ADR-011 vs research 02 and 05)

- **Research 02 budgets are preserved unchanged:** 1 KiB store, 3 KiB simple primitive, 8 KiB
  complex engine, 0 KiB unused component. ADR-011 keeps all four verbatim.
- **The four shared ceilings are additive artifacts** (overlay + geometry 4, collection + focus 3,
  live region 1, kinds resolver + parser 2), not re-interpretations of 02's numbers. The one
  narrowing (02's "3 KiB excluding framework and styles" becomes "excluding framework, styles and
  shared kernel modules") is recorded under "Conflict resolved" with its reason (01's mandatory
  geometry and close fallbacks cannot fit in 3 KiB). Consistent with 02's rule that unused code
  must be 0 KiB: shared modules are only pulled by components that use them.
- **Derived totals are arithmetically correct:** `SJPopover` 3+1+4 = 8; `SJTooltip` 3+1+4 = 8;
  `SJSelect` custom listbox 8+1+4+3 = 16 (uses 02's "complex combobox" class, correct for a
  select-only combobox with typeahead and active-descendant); `SJInput` 3+1+2 = 6.
- **Research 05 has no byte budgets**, only interaction gates; ADR-011's p95 gates (50 / 100 /
  50 ms, 0 retained after 1,000 cycles, no engine long task > 50 ms at 10,000 rows, named devices,
  30 iterations) and the 250-row virtualization default match 05 §Provisional laboratory ceilings
  exactly.
- The new "no ceiling may rise more than 50 % in one ADR without design review" rule is
  additional governance, not a conflict.
- NICE: add the `SJDialog` derived total (3+1+4 = 8, since the close tiers and opener stack live in
  the overlay module) so every wave-1 overlay component has a stated cap.

---

## Status per round-1 finding

| # | Finding | Status | Verification |
|---|---|---|---|
| MUST 1 | ADR-004 not final | **resolved** | Precondition sentence removed; sizes are a wave-1 evidence task revising ADR-011 only by ADR; Q1 informational. Licences independently confirmed above. |
| MUST 2 | Shared-kernel ceilings unset | **resolved** | Four provisional ceilings with rationale, derived totals, revision rule; Q2 reworded as non-blocking. Coherence with 02/05 confirmed above. |
| MUST 3 | Runtime injection undecided | **resolved** | `SJRuntime` interface, `createRuntime(config)`, `SJProvider` (React/Vue), `mount(el, runtime)` (vanilla); deterministic server/client defaults (`<html lang dir>` from render input, `supports` all-false on server and applied post-hydration, platform timers); `runtime` listed in contract props provenance; components never read `document.documentElement`/`navigator`. ADR-003 records it as an architectural addition justified by 02's SSR rules. |
| MUST 4 | Floor table errors | **resolved** | View Transitions split (111/144/18 and 126/none/18.2); `position-try-order` 125/148/26; `position-visibility` 125/147/26.2; `scheduler.yield()` 129/142/none; "a cell never uses a dash" rule stated; `position-area` "removed 131"; `<details name>` 120/130/17.2 verified against BCD. One new cell is wrong, see S-21. |
| MUST 5 | Field-kind rows | **resolved** | (a) textarea `enterkeyhint="enter"`, excluded from position; (b) `cc-exp` digits-only with engine-inserted separator, month/year pair alternative; (c) `amount-signed` row with sign control and `-`/`−` parsing only when signed; (d) `country` defaults to `<select>` + `country`, text variant `country-name`. |
| SHOULD 6 | Q6 vs ADR-002 | resolved | Q6 closed; ADR-002 states scaffold 0.0.0, unpublished, devDependency `^3.5.0`. |
| SHOULD 7 | `listboxMount` pointer class | resolved | `any-pointer: coarse`, `byAnyPointer` in ADR-005 step 8, ADR-008 rule 3 and the ADR-010 example; stated as a proxy for AT populations with Q4 as revision path. |
| SHOULD 8 | `data-active` scope | resolved | Set in every composite; roving composites additionally carry real focus. |
| SHOULD 9 | Compound naming | resolved | React namespace + flat exports; Vue flat components + preset; vanilla `sj-select-*`; `anatomy[].part` as the single name source. |
| SHOULD 10 | CSS delivery | resolved | Adapters never import CSS; `sideEffects` only in `@ramoslabs/css`; layer order documented there. |
| SHOULD 11 | Light-DOM custom elements | resolved | ADR-002 and ADR-014: no shadow root, FACE via `attachInternals()`. |
| SHOULD 12 | Kinds table home | resolved | `kinds.contract.json` + `kinds.schema.json`; source of `resolveKind`, `kind` union, lint, MCP `get_kind`. |
| SHOULD 13 | Unlayered resets risk | resolved | Risk 9 with the Tailwind v3/v4 distinction and the documented `@layer` order. |
| SHOULD 14 | Vanilla injection surface | resolved | Text-nodes-only rule in ADR-002; layer-2 text-safety test in ADR-013; risk 10. |
| SHOULD 15 | Contracts dependency direction | resolved | §1.1: build-time input, "generates" not "imports". |
| NICE 16 | `<details name>` | resolved | Floor row and wave-1 row 6 fallback; versions verified. |
| NICE 17 | `tax-id` `autocomplete` | resolved | Attribute omitted. |
| NICE 18 | Floor devices pinned | resolved | Risk 5. |
| NICE 19 | `$schema` served | resolved | ADR-010 consequences, release gate. |
| NICE 20 | Pinned devDependencies | resolved | Risk 8 / provenance gate. |

## New findings in changed lines

**S-21 (SHOULD, required correction at merge) — `base-select` Firefox cell.** The Section 2 row
now reads "135 / flag only in 149-153 / 27". BCD 8.1.7 records Firefox `appearance: base-select`
as version 149 behind two preferences (`dom.select.customizable_select.enabled`,
`layout.css.appearance-base.enabled`) with **no upper bound**, and Firefox 158 is current; the
"-153" implies unflagged support from 154, which no source supports, and `::picker(select)` has no
Firefox support at all. Research 01 says "Firefox 149 behind flags". *Correction:* "135 / 149
behind flags / 27". No decision depends on it (the feature is disabled on the floor; Q8 keeps the
contract flag off), which is why it does not block certification.

**N-22 (NICE) — `supports` post-hydration switch.** "All-false on the server, applied after
hydration" is correct for markup parity; add one sentence that overlays are closed at hydration
so no placement path runs before the switch, which is why there is no visible fallback flash.

**N-23 (NICE) — `SJDialog` derived byte total** (see coherence section).

**N-24 (NICE) — licences evidence file** (see licence section).

No regressions found elsewhere in the 131 inserted / 50 deleted lines: the renumbered risks
(9 resets, 10 injection, 11 tokens) are consistent; the "Decisions needed from owner" section does
not reopen any ADR; D1's recommendation equals ADR-001's decision.

---

## Certification statement

`ARCHITECTURE.md` revision 1 (commit b873e74) is **CERTIFIED** for implementation planning,
subject to applying S-21 at merge and to the two owner confirmations D1 (floor, recommended A as
decided in ADR-001) and D2 (device lab funded before wave-1 certification). All 14 ADRs PASS.
The implementation plan may start with wave 1 as listed in Section 4; Q3–Q5, Q7 and Q8 are
tracked open questions with owners and do not block wave 1.

ARCH-AUDIT-2 DONE
