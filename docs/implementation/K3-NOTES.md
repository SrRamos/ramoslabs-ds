# K3 notes: collection, focus, typeahead (W1-106a, W1-106b, W1-107)

Branch `feature/m1-k3-collection-focus-typeahead`. Sources: PLAN-WAVE-1 rows, ADR-003, ADR-006, ADR-011, ADR-012.

## Decisions

- **Collection (106a).** `createCollection(base, items)` is data-first: ids come from `itemId(base, key)` (K1 ids), never positions.
  `register(key, el)` stores mounted elements (structural `E`, no DOM types); unregister is idempotent and does not drop a replaced element.
  `set(items)` drops registrations of keys that left. `compareDocumentPosition` is not used (ADR-003).
- **Successor.** `successor(prev, next, removed)`: the key itself if still enabled; else nearest enabled survivor after its old
  position; else nearest before; else `undefined` (the caller focuses its declared container fallback, so focus never reaches `<body>`).
- **Focus (106b).** `STRATEGY` encodes the ADR-006 table; `assertStrategy` throws when roving and activedescendant are declared together.
  `createFocus(collection, strategy)` tracks the active key; `apply(container)` sets `data-active` in every composite,
  `tabindex` for roving (tab stop = active, else first enabled), writes `aria-activedescendant` only when the active element is
  mounted (virtual items), then one `focus({preventScroll:true})` and one `scrollIntoView({block:'nearest'})`. `release` clears the
  active id before unmount. `restoreTarget(opener, fallback, advanced)` implements scope return (connected, visible via
  `checkVisibility` when present, enabled, not `inert`; else fallback; `advanced` suppresses). `native-roving` and `native` apply no
  tabindex or activedescendant (ADR-006 native roving: the browser owns arrows).
- **Typeahead (107).** `normalize` = NFC + trim/collapse + `toLocaleLowerCase(locale)`, diacritics kept. `nextMatch` cycles: a
  one-character or repeated-character buffer searches after the current item, a longer buffer includes it; wraps; skips disabled.
  `createTypeahead` guards both `isComposing` and a session flag (`compositionstart`/`end`), ignores `keyCode 229` on keydown,
  and `beforeinput` accepts only `insertText` with data. Buffer timeout 500 ms on the injected runtime `Scheduler`. Bare space with an
  empty buffer is not typeahead (it activates).
- Focus effects can flow through the K1 effect queue as `{type:'focus', target:id}`; the kernel itself applies via `apply`.

## Bytes (min + gzip, `node packages/testing/size/cli.js`)

collection row (all three together): 1.544 KiB gzip (3177 B raw min) vs 3 KiB ceiling: pass.

## G1 fixes

- SHOULD-3: `createFocus().apply()` now focuses per ADR-006 strategy: `roving` and `native-roving` focus the active item (container only as fallback); `activedescendant` focuses the container; `native` makes no `focus()` call. `native-roving` still writes no `tabindex`. One table test per strategy (`it.each`).
- NICE-8: `release()` now also removes `data-active` from every registered item, so a reused element does not keep the attribute (separate seeded test; same commit as the apply fix because it is the same function pair, noted for traceability).
