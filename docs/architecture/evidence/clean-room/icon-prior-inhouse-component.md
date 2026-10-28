# Clean-room notes: prior in-house icon component

Template per ADR-004 (`TEMPLATE.md`). Concepts only. No prior-brand name appears here (BRIEF constraint 1).

| Field | Value |
|---|---|
| Reference | The owner's prior in-house design system, its single icon component (a name-based, lazily loaded SVG wrapper) |
| Repository URL | TBD (private, owner's own repository; not published) |
| Licence (SPDX identifier) | Proprietary (not open source; not redistributable) |
| Licence verified on (date, against the repository) | TBD (nothing is copied, so no redistribution licence is needed) |
| Version studied (tag or commit) | TBD (working copy read on 2026-10-28) |
| Retrieved (date) | 2026-10-28 |
| Concept studied | Four system properties only: glyphs inherit text colour (`currentColor`); three sizes of 14, 20 and 24 CSS px; kebab-case icon names that mostly match Feather; always decorative (`aria-hidden`). Read: the component, its types, its stylesheet and its docs page. The glyph files were not opened for the design. |
| What we do differently | Glyphs come from the pinned `lucide-static` (ISC) through a generator; data-prop API with static per-icon imports instead of lazy dynamic imports (SSR and tree-shaking); sizes are tokens; a labelled mode (`role=img`); RTL mirror flag; no module-scope registry. |
| Code, tests, markup or assets copied | `none` |
| Provenance proof | `generate.mjs --check` fails on any byte of `packages/icons/src/generated/**` not derived from the pinned `lucide-static/icon-nodes.json`, and a test reads the pinned package and asserts every icon's `nodes` equals the upstream entry for its name (W1-C12.g). |
| Measured size, wave 1 (optional) | n/a |
| Measurement caveat | ADR-011 ceilings are our limits, not derived from this reference |
| Reviewer and date | TBD (G-ICON re-audit) |
