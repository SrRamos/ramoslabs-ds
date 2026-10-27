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
