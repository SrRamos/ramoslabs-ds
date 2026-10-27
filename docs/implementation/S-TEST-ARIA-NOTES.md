# S-TEST-ARIA notes (W1-309c, ARIA snapshots, CDP AX tree, CDP IME)

Branch `feature/m3-aria-snapshots`. Files: `packages/testing/e2e/aria/**` and one script line,
`test:e2e:aria`, in `packages/testing/package.json` (shared-file touch; `playwright test -c e2e/aria/playwright.config.ts`).

## Layout
- `playwright.config.ts`, `serve.mjs`, `build.mjs`: same three engines and `retries: 0` as the runner, own port
  (4180, `E2E_ARIA_PORT`) and results file (`aria-results.json`, or `aria-diagnose.json` when `SJ_E2E_RETRIES` is set).
  `build.mjs` reuses the runner's `buildHost` (probe on three adapters) and adds the IME fixture bundle.
- `snapshots/{off,on,disabled}.yml`: ONE `toMatchAriaSnapshot` template per contract state, read by every adapter and
  every engine (`aria.e2e.ts`). `off` pins `[checked=false]`, `on` pins `[checked]`, `disabled` pins `[disabled]`.
- `cdp.e2e.ts`: `Accessibility.getFullAXTree` on Chromium. Exactly one non-ignored `switch` node with name, `checked`,
  `disabled`, `focusable` per state, on all adapters.
- `ime/host.ts` + `ime.html`, `ime.e2e.ts`: test-only editable host (input + listbox) using core `createTypeahead`
  (W1-107) via `beforeinput` and composition events. CDP `Input.imeSetComposition` / `Input.insertText` drive a real
  composition. Asserted: compositionstart seen, composition `beforeinput` flagged `isComposing`, buffer empty and
  active option unchanged while composing (including a prefix of an item), compositionend releases the guard, typing
  afterwards is typeahead again.

## Seeded regressions (must fail)
- ARIA: `vue-wrong-aria` (existing host defect, aria-checked stuck after the first change). After off -> on the `on`
  snapshot must not match (`not.toMatchAriaSnapshot`); same defect must be visible in the AX tree.
- IME: `?guard=off` unwires composition events and presents every beforeinput as plain `insertText`; the scenario must
  report violations ("while composing").

## Decisions
- Non-Chromium engines run the CDP specs as `test.skip` with a reason (not-applicable for W1-313), rather than omit them.
- Locator is `[data-part="root"]`, so snapshots contain only the component, not the host `<main>`.
- Aria snapshots are partial templates; each state pins the attribute that distinguishes it so `off` cannot match `on`.
- Committed IME text arrives as `insertCompositionText` and is correctly NOT typeahead input (K3 `inputType === 'insertText'`).

## Results
60 ARIA/CDP tests + 6 IME across 3 engines: 42 pass, 24 skipped (CDP specs on firefox/webkit). Runner suite unaffected.

## CI needs (W1-314 owns ci.yml; not edited)
`bun run --filter @ramoslabs/testing test:e2e:aria` after the same browser install as the runner; port 4180 free; read
`node_modules/.cache/e2e/aria-results.json` next to `e2e-results.json`.

## Follow-ups
- W1-309b `path` field: add to the titles here when the host takes `supports` overrides.
- `bun run typecheck` in `packages/testing` needs built `dist/` of core/adapters (same as the other e2e files).
