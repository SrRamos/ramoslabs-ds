# Clean-room notes: `<reference name>`

Template per ADR-004. One file per studied reference. Concepts only: a reference is read for the
idea it demonstrates, and nothing from it (code, tests, markup, CSS, assets, names of internal
APIs) is imported or copied. Leave a field empty only with the word `TBD`; never invent a value.

| Field | Value |
|---|---|
| Reference | |
| Repository URL | |
| Licence (SPDX identifier) | |
| Licence verified on (date, against the repository) | |
| Version studied (tag or commit) | |
| Retrieved (date) | |
| Concept studied | |
| What we do differently | |
| Code, tests, markup or assets copied | `none` (must stay `none`; any change requires review) |
| Measured size, wave 1 (optional) | minified+gzip and tree-shaken bytes; bundler and version; reference version; recorded in `docs/architecture/evidence/` |
| Measurement caveat | ADR-011 ceilings are our limits, not derived from this reference |
| Reviewer and date | |

Rules carried from the architecture:

- Reference-library sizes may revise an ADR-011 ceiling only through an ADR (ADR-004).
- Licence and provenance are checked by the licence gate (W1-509) against these notes (ADR-013).
