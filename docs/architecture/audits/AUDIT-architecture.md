# AUDIT — ARCHITECTURE.md (certification round 1)

Auditor: ds-fable. Input: `ARCHITECTURE.md` at commit 6fb49b5 (14 ADRs, floor, wave 1, risks),
checked against `BRIEF.md`, research 01–07 (R2: 7/7 PASS) and `audits/AUDIT-research*.md`.
New facts verified outside the research: the six reference licences (fetched 2026-10-27:
React Aria/Spectrum Apache-2.0; Radix, Zag, Ark, Headless UI, Melt, Floating UI MIT), the
`packages/vue` scaffold state (0.0.0, unpublished), and a prior-brand name scan of the document
(no hits).

## Global verdict: **NOT-CERTIFIED**

Five MUSTs remain. None is a design reversal: the layered model, the 14 decisions and their
traceability to the research are sound, and every hard constraint of the brief is met in the
text. The MUSTs are (1) an ADR that declares itself not final, (2) an undefined budget that blocks
planning three wave-1 components, (3) an undecided runtime-injection surface that every adapter
needs, (4) factual errors in the floor table, and (5) four rows of the field-kinds table that would
ship the exact class of defect the brief forbids. All five have exact corrections below; a second
round should be a line-by-line check, not a re-audit.

### Constraint compliance (BRIEF hard constraints)

| Constraint | Status | Where |
|---|---|---|
| 1 Independence, no prior-brand names | met | scan clean; references are the brief's allowed list, concepts only, licences verified |
| 2 Zero runtime deps | met | ADR-002 table: every package `none`/peer only; test tools dev-only (ADR-013) |
| 3 Native-first | met | ADR-001/005/008/014; capability statement required for custom |
| 4 Intent-based fields | met in structure, table has defects | ADR-007; see MUST 5 |
| 5 WCAG 2.2 AA, APG, keyboard, visible focus | met, with internal floors above AA | ADR-006/009/013 |
| 6 Compound primitives + presets from them | met, CI-enforced | ADR-004 |
| 7 Agent-native contracts | met | ADR-010, registry/MCP/lint consumers named |

### Per-ADR verdicts

| ADR | Verdict | Blocking finding |
|---|---|---|
| 001 Support floor | FAIL | MUST 4 (table errors) |
| 002 Package topology | PASS | SHOULD 9, 10, 11, 15 |
| 003 Headless core | FAIL | MUST 3 (runtime injection undecided) |
| 004 API shape | FAIL | MUST 1 (self-declared not final) |
| 005 Overlay and positioning | PASS | SHOULD 7 |
| 006 Focus and keyboard | PASS | SHOULD 8 |
| 007 Field kinds | FAIL | MUST 5 |
| 008 Native vs custom on touch | PASS | — |
| 009 Styling | PASS | SHOULD 13 (risk) |
| 010 Contract schema | PASS | SHOULD 12 |
| 011 Performance budgets | FAIL | MUST 2 (kernel ceilings unset) |
| 012 Math and ML | PASS | — |
| 013 Testing and certification | PASS | — |
| 014 Forms and validation | PASS | SHOULD 11 |
| §2 floor table | FAIL | MUST 4 |
| §4 wave 1 | PASS | NICE 16 |
| §5 open questions / risks | PASS | SHOULD 6, 13, 14; NICE 18 |

---

## Findings

### MUST

**MUST 1 — ADR-004 is not final by its own words.** "Task before this ADR is final: measure
comparable select, dialog and tabs builds of the references" plus "the auditor verifies [licences]
before certification" (Q1). An ADR cannot be certified while it declares a precondition unmet.
*Correction:* (a) record the verified licences in the table as "verified 2026-10-27" (values above
are correct as written); (b) delete the "Task before this ADR is final" sentence and restate the
measurement as a wave-1 evidence task: "Reference-library sizes are measured during wave 1 and
recorded in `docs/architecture/evidence/`; they may revise ADR-011 ceilings only through an ADR."
The ceilings are the library's own limits (ADR-011 says so); nothing in the architecture depends on
the reference numbers, so they must not gate certification.

**MUST 2 — ADR-011 leaves the shared-kernel ceilings unset (Q2).** "To be set by the first
measurement" means wave-1 `SJPopover`, `SJTooltip` and `SJSelect` have no byte budget, and the
"one-component fixture reports the total including shared modules" rule has no number to fail
against. Every other ceiling in the document is provisional-by-ADR; these must be too.
*Correction:* add provisional ceilings in the ADR-011 table, revisable only by ADR: overlay +
geometry fallback **4 KiB**, collection/focus kernel **3 KiB**, live-region registry **1 KiB**,
field-kinds resolver + number parser **2 KiB** (minified + gzip each). State the derived consumer
cost: a one-component `SJPopover` fixture therefore caps at 3 + 1 + 4 = 8 KiB and `SJSelect` at
8 + 1 + 4 + 3 = 16 KiB. Close Q2.

**MUST 3 — Runtime injection has no decided surface.** ADR-003 says the core "receives an injected
scheduler", ADR-013 says feature detection "is an injected `supports` map", ADR-003 requires
`identifierPrefix`/`idPrefix` for multiple roots and an injected id factory for vanilla SSR,
ADR-007/012 need an "active locale" for the number parser, case folding and `Intl.Segmenter`, and
ADR-009 needs `dir` for logical properties and a density preset. None of the ADRs says how a
consumer supplies these, and SSR determinism requires locale and id prefix to be identical on
server and client, so they cannot default silently to `navigator.language`. Each wave-1
component would otherwise invent its own injection.
*Correction:* add to ADR-003 (or a new ADR-015 "Runtime configuration") one decision: a root
**runtime object** `{ locale, dir, idPrefix, density, supports, scheduler, idFactory? }` created
once per app/request by `createRuntime(config)` in the core; React and Vue expose it through
`SJProvider` (context / `provide`), vanilla passes it to `mount(el, runtime)`; the live-region
registry hangs off the runtime's document. Defaults: `locale` from `<html lang>` on the server
render input and the same value serialized to the client; `supports` from real detection on the
client and all-false on the server; `scheduler` platform timers in production. Add
`runtime` to the contract's `props` provenance so lint can flag components used outside a provider.

**MUST 4 — Section 2 floor table contradicts certified research 01.** (a) Row "View Transitions:
same-doc 126 / - / 18.2" is wrong: same-document is Chromium 111 / Firefox 144 / Safari 18;
cross-document (`@view-transition`) is Chromium 126 / Firefox none / Safari 18.2 (01 §Decision
summary, BCD). (b) The "-" cell is undefined: in `position-try-order` and `position-visibility` it
means "same as the core (Chromium 125 / Firefox 147)", in `scheduler.yield()` it means "no
support", in View Transitions it means "omitted". The table is "the reference table other ADRs
cite" and ADR-013 generates support claims from these numbers.
*Correction:* split View Transitions into two rows with the values above; replace every "-" with
the explicit version (`position-try-order` 125 / 148 / 26; `position-visibility` 125 / 147 / 26.2;
`scheduler.yield()` 129 / 142 / none) and use the word "none" for no support.

**MUST 5 — Four field-kind rows would ship the defect the brief defines.** Checked per type,
inputmode, autocomplete and enterkeyhint against research 04 and the HTML spec:
(a) **`address` (`textarea`) with Enter = "position".** In a textarea Enter inserts a newline;
labelling the key `next`/`done` is wrong and the form owner must not treat Enter as navigation.
Fix: textarea kinds use `enterkeyhint="enter"` and are excluded from the owner's position
computation.
(b) **`cc-exp` with `inputmode="numeric"` and "accept contract-supported separators".** The iOS
numeric keypad has no `/`; the user cannot type the separator the row says it accepts. Fix: the
engine accepts digits-only `MMYY`/`MMYYYY` and inserts the display separator itself (or uses the
`cc-exp-month`/`cc-exp-year` pair); never require the user to type `/`.
(c) **`amount` with `inputmode="decimal"` and no sign handling.** Research 04 §Attribute semantics
records that `decimal` may omit minus on iOS. Credit notes and refunds in the library's own
consumer domain (invoicing) are negative amounts. Fix: add a `signed` option to the `amount` kind;
when `signed`, render an explicit sign control (toggle or prefix part) and keep `decimal`; the
parser accepts a leading `-` or `−` only when `signed`.
(d) **`country` as `type="text"` with `autocomplete="country"`.** The `country` token autofills an
ISO 3166-1 alpha-2 code ("CO"); a free-text field should take `country-name`. Fix: `country` kind
defaults to `choice` (`<select>` with `autocomplete="country"`); a text variant uses
`country-name`.

### SHOULD

**SHOULD 6 — Q6 contradicts ADR-002.** ADR-002 decides "the Vue peer range is raised to
`>=3.5.0`"; Q6 asks whether to. `packages/vue` is 0.0.0 and unpublished, so no consumer exists on
3.4. *Correction:* close Q6 as decided; note the devDependency is already `^3.5.0`.

**SHOULD 7 — ADR-005 step 8 keys `listboxMount` on the primary pointer.** `(pointer: coarse)`
is false on an iPad with a trackpad, yet the evidence (WebKit 289338) is about VoiceOver on iOS, not
pointer coarseness. *Correction:* key on `any-pointer: coarse` (touch-capable) and say explicitly
that the class is a proxy for the AT populations in the evidence, with Q4 as the revision path.

**SHOULD 8 — ADR-006 limits `data-active` to active-descendant.** Research 03 applies the
independent indicator to pointer-opened roving menus too, because `:focus-visible` may not match
after programmatic focus following a pointer open. *Correction:* "The engine sets `data-active`
on the active item in every composite; roving composites additionally carry real focus."

**SHOULD 9 — ADR-002 leaves compound naming per framework undecided** ("`SJSelectTrigger` or
dotted `SJSelect.Trigger`"). *Correction:* React exports a namespace object (`SJSelect.Root`,
`.Trigger`, …) plus flat named exports; Vue exports flat `SJSelectRoot`, `SJSelectTrigger`
components (Vue has no namespace components in templates); vanilla custom elements are
`sj-select`, `sj-select-trigger`. The contract's `anatomy[].part` is the single name source.

**SHOULD 10 — CSS delivery is ambiguous.** ADR-009 says consumers get zero-JS styles; ADR-002 says
`sideEffects` metadata "preserves CSS", implying JS entry points import CSS. *Correction:* decide
that adapters never import CSS; consumers import `@ramoslabs/css` (full or per-component files);
`sideEffects` is set only in `@ramoslabs/css`. This keeps vanilla/SSR parity and the layer order
under consumer control.

**SHOULD 11 — Vanilla custom elements need a light-DOM rule.** With a shadow root, IDREF-based
ARIA (`aria-activedescendant`, `aria-controls`, `commandfor`) and the `@layer` styling model break
at the boundary, which is the reason ADR-002 rejected option C. *Correction:* ADR-002/014 state
that `sj-*` custom elements render in light DOM, no shadow root, FACE via `attachInternals()`
only.

**SHOULD 12 — The field-kinds table has no home in `@ramoslabs/contracts`.** ADR-007 says the
table is "in the contract"; ADR-010 shows component contracts only. *Correction:* add
`packages/contracts/kinds.contract.json` (validated by `kinds.schema.json`) as the source of
`resolveKind`, the generated `kind` union, lint and MCP `get_kind`.

**SHOULD 13 — Risk omitted: consumer unlayered resets win over every `sj.*` layer.** ADR-009's
promise cuts both ways: a Tailwind v3 preflight or any unlayered reset overrides component styles.
*Correction:* add to §5.2: consumers must place resets in a layer declared before `sj.*` (Tailwind
v4 already layers); document the required `@layer` declaration order in `@ramoslabs/css`.

**SHOULD 14 — Risk omitted: injection surface in the vanilla adapter.** Labels, hints, errors and
option content are consumer strings rendered by library code. *Correction:* add the rule to
ADR-002/004: the vanilla adapter writes text nodes only, never `innerHTML` with consumer strings;
rich content is supplied as elements. Add a test in ADR-013 layer 2.

**SHOULD 15 — §1.1 says each layer depends only on the layer above, but `@ramoslabs/contracts`
"feeds core".** *Correction:* state that contracts are a build-time input (code generation) to
core/adapters/tests, not a runtime dependency; the diagram's arrow is "generates", not "imports".

### NICE

**NICE 16 — `SJDisclosure` exclusive accordions.** `<details name>` is Chromium 120 / Firefox 130 /
Safari 17.2, below the floor on Chromium 114–119 and Safari 17.0–17.1; note the owned
exclusive-open fallback in the wave-1 row.

**NICE 17 — `tax-id` `autocomplete="off"`.** Research 04 says `off` is not a generic suppressor;
omit the attribute instead.

**NICE 18 — Floor devices must be kept from auto-updating.** iOS 17 hardware cannot be downgraded;
add to risk 5 that the lab pins OS versions.

**NICE 19 — `$schema` URL.** `https://design.ramoslabs.com/schema/contract.v1.json` must be
served by the site deploy; add to ADR-010 consequences.

**NICE 20 — Pinned, lockfile-verified devDependencies** as part of the provenance gate (risk 8).

---

## Traceability check summary

Every ADR cites research sections that exist and say what the ADR says they say (spot-checked:
ADR-003 ↔ 02 Revision 1; ADR-005 steps 1–7 ↔ 01 nesting rules and 06 placement vocabulary; ADR-006
table ↔ 03 focus engine; ADR-011 gates ↔ 05 ceilings; ADR-013 WCAG table ↔ 07). The two
cross-file conflicts carried from AUDIT-R2 (05 rec. 1 wording; 03 inline-listbox detection) are
resolved explicitly in ADR-005 "Conflicts resolved". Risk 2 correctly refuses to cite the three
tracker items whose dates were pending correction.

**Re-certification trigger:** resubmit with `STATUS: DRAFT-FOR-AUDIT` restored and the five MUST
corrections applied; the auditor checks those lines and the SHOULD dispositions only.

ARCH-AUDIT-1 DONE
