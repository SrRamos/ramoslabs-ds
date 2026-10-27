# Architecture research index

**01 — Platform primitives.** Establishes the 2026 support baseline for Popover, CSS anchor positioning, dialog and `closedby`, `inert`, Invoker Commands, customizable select, `ElementInternals`, `:user-invalid`, View Transitions, and `interestfor`. For each primitive it identifies replaced behavior, support gaps, and an explicit fallback, then recommends native-first capability ladders rather than uniform custom implementations.

**02 — Headless engine.** Compares reducers, explicit state machines, and signals, selecting pure reducers with finite-state metadata and a per-instance immutable snapshot store. Defines React, Vue, and vanilla adapters, canonical prop getters and event composition, controlled/uncontrolled semantics, SSR-safe IDs, side-effect-free ESM boundaries, and provisional bundle budgets.

**03 — Accessibility engine.** Turns the APG contracts for combobox, listbox, menu, tabs, dialog, tooltip, disclosure, radio group, and switch into shared behavioral requirements. Covers roving focus versus active-descendant, focus return, typeahead, IME, live regions, dated AT/browser evidence, and a required real-AT matrix spanning Windows, macOS, iOS, and Android.

**04 — Mobile and input UX.** Maps field intents to concrete `type`, `inputmode`, `autocomplete`, correction, and Enter-key defaults. Recommends single-input OTP, unmasked international phone editing, locale-aware numeric parsing, native touch pickers, a 44-CSS-pixel touch preset over the WCAG 24 floor, and VisualViewport-based keyboard handling without requiring the experimental VirtualKeyboard API.

**05 — Performance.** Separates rendering mechanisms and measured examples from optimization folklore. Covers layout thrashing, passive listeners, delegation, observers, `content-visibility`, virtualization, V8 hidden classes and allocation, and proposes a control-versus-candidate benchmark protocol with tail latency, rendering-stage, memory, and physical-mobile evidence.

**06 — Math and ML.** Identifies deterministic geometry, lexical search ranking, prefix typeahead, and prefix-offset virtualization as useful mathematics. Rejects ML typeahead, learned row heights, runtime field-kind inference, and base-engine neural search; treats predictive prefetch as an application-level heuristic requiring privacy, staleness, resource-waste, and accessibility evaluation.

**07 — Testing and certification.** Defines a shared semantic specification driving reducer invariants, Playwright interaction tests, state-specific axe scans, real-AT manual protocols, hermetic visual regression, and cross-framework parity. Establishes pull-request and release gates plus a reproducible evidence manifest, without presenting automation as external WCAG certification.

LISTO