# Component CSS template

Start a component stylesheet with the generator:

```sh
bun run new -- select --parts root,trigger,content,item   # or omit --parts to read the contract
```

It writes `src/<name>.css`; the build picks it up from the glob, so no shared file changes.

Naming (ADR-002, ADR-009), identical to the contract `anatomy[].part`:

- class `sj-<component>__<part>` and attribute `data-part="<part>"`
- state hooks `data-state`, `data-active`, `data-disabled`, `data-invalid`
- axes `data-variant`, `data-tone`, `data-size`

Rules enforced by the build and by stylelint: every rule inside an `sj.*` layer, tokens only, logical
properties, no `outline: none`, no remote URLs. Focus ring, target size, motion and forced-colors come
from `base/`; do not redo them.

Contract check: `packages/contracts/contracts/<name>.contract.json` must exist and the parts must equal
`anatomy[].part` exactly; a missing contract or a mismatch fails. `checkStylesheets` (in `generate.mjs`)
runs the same check over every `src/*.css` in the test suite.

## Required markers for the a11y gates (WCAG 2.5.7 and 3.2.6)

The release a11y lane scans the component's pages for these attributes. Missing them fails the gate
(2.5.7 also fails when a page has no drag candidates at all), so add them while authoring, not at review.

- **Dragging (2.5.7).** Every drag source (`draggable="true"`, `cursor: grab`, `touch-action: none`, or
  an explicit `data-sj-drag`) must carry `data-sj-drag-alt="<id>"`: the id of a single-pointer
  alternative (a button) that is present, visible, enabled and focusable. It must also carry
  `data-sj-drag-scope="<id>"`: the id of the element whose content one click on the alternative changes,
  so the gate can observe the effect. Example: `<span draggable="true" data-sj-drag-alt="swap1"
data-sj-drag-scope="list">` plus `<button id="swap1">Move Alpha down</button>`.
- **Consistent help (3.2.6).** Any help, support or contact link or button gets `data-sj-help` so the gate
  can compare its landmark and relative order across pages. A help-like link without the marker fails
  ("not marked data-sj-help"), and a marked help item must appear on at least two pages of the set.

Reference fixtures: `packages/testing/a11y/fixtures/dragging/` and `fixtures/help/` (pass and fail pages).
