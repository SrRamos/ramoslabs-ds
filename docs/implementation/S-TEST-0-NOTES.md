# S-TEST-0 notes: W1-308a spec derivation

Module: `packages/testing/spec/derive/index.js` (`deriveSpec(contract)`), pure data, no fs/DOM/clock.
Output: `{ component, initial, states, focus, steps, movements, scenarios, sequences, unreachable }`.

## Decisions (ADR-013 option B: one semantic spec feeds L1 and L2)
- Step id is `<action>:<from>><to>`; the same action id with different endpoints (switch `toggle`) is two steps. A duplicate id throws (ambiguous, would be non-deterministic).
- `triggers` come only from `keyboard`; keys and parts are sorted in code-unit order, so authoring order cannot change output. Actions keep declared order (it is meaningful). `expect.aria`/`dom` keys are canonicalised.
- Keyboard values that are not an action id (for example `next`) are `movements`; the kernel owns their semantics.
- `initial` = `state.machine[0]`. `sequences` = for each step, the shortest declared-order path from `initial` to its `from`, then the step (feeds W1-308b/W1-309a). Unreachable steps are listed, not dropped.
- `scenarios`: one per fixture; fixture named exactly `disabled` is `interactive: false` (convention, `INERT_FIXTURE`). Open question: promote to a schema field if other inert fixtures appear.
- No pointer triggers are derived: the contract carries no pointer binding, so none is invented.

## Determinism evidence
Inline snapshot for button, structural assertions for switch, repeat/clone serialization equality, no input mutation, and a fast-check property over keyboard authoring order.

## Bytes / deviations
Test-only module, not shipped; no ADR-011 ceiling. No shared-file edits; `spec/index.js` barrel and `exports` untouched (consumers import `spec/derive/index.js` until the barrel owner re-exports it).
