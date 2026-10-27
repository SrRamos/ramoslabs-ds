# Select-only combobox with listbox

## Recommended variant

On fine pointers, use APG's non-input trigger with real DOM focus, `aria-expanded`, `aria-controls`, and `aria-activedescendant`. The listbox is **DOM-adjacent in both mount modes**: `top-layer` means DOM-adjacent and promoted with `popover`; `inline` means DOM-adjacent and not promoted. On coarse pointers use `inline`; on touch use native `select`. Never portal the listbox to `body` ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)).

No ARIA-AT select-only report exists in the verified candidate set; NVDA is explicitly `no-measured-evidence`. The JAWS `aria-haspopup=listbox` observation comes from an editable combobox and is not misrepresented as select-only evidence ([a11ysupport, 2023-08-22](https://a11ysupport.io/tests/apg__aria-1-2-combobox-with-list-autocomplete-example/aria__aria-haspopup_attribute/convey_value_listbox/jaws/chrome)).

## Discarded alternatives and blockers

- **Portal-to-body on iOS:** blocker in WebKit 289338 (iOS 18/Safari 18), while the inline comparison works; the report is about DOM placement, not top-layer promotion itself ([WebKit, 2025-03-07](https://bugs.webkit.org/show_bug.cgi?id=289338)).
- **Custom widget on observed TalkBack/Chrome:** blocker in APG 2855 because options cannot be navigated/chosen; latest activity 2025-10-29 ([APG issue](https://github.com/w3c/aria-practices/issues/2855)).
- **Editable input or roving option focus:** contrary to APG's select-only contract.
- **Claiming a universal desktop fix:** WebKit 231724's later passing comment covers its original macOS case only ([WebKit, updated 2025-07-09](https://bugs.webkit.org/show_bug.cgi?id=231724)).
