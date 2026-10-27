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
