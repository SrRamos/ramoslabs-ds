# Component library architecture: research brief

Status: **open**. No component code is written until `ARCHITECTURE.md` is certified
(audit verdict PASS). This brief scopes the research that feeds that document.

## Goal

A RamosLabs-owned component library with its own identity, built on `@ramoslabs/tokens`,
where UX and accessibility are the product. Components use the `SJ` prefix.

## Scope

- **In:** Vue 3, React, and vanilla JS / plain HTML.
- **Out (for now):** React Native, Ionic, Svelte, Angular. The architecture must not
  preclude adding Svelte or Angular later.

## Hard constraints

1. **Independence.** RamosLabs DS takes *concepts* from prior work, never names, code, or
   proprietary identifiers. No prior-brand names or prefixes appear in any file in this repo.
2. **Zero runtime dependencies** for behavior. We build our own headless engine. Open-source
   libraries (React Aria, Radix, Ark/Zag, Headless UI, Melt, Floating UI) may be *studied* as
   references — never imported. Note their licenses when citing.
3. **Native-first.** Where the platform already solves the problem (`<dialog>`, `popover`,
   `<details>`, `<select>`, `input type`/`inputmode`/`autocomplete`, form validation), we use
   it. Custom UI must justify itself. On touch devices native controls win by default.
4. **Intent-based fields.** Fields declare the data they hold (`phone`, `otp`, `email`,
   `amount`, `date`, …) and the system sets the correct input attributes so the right
   virtual keyboard and autofill appear. A phone field opening the text keyboard is a defect.
5. **WCAG 2.2 AA floor**, WAI-ARIA APG patterns, full keyboard support, visible focus.
6. **Composition.** Two levels per component: compound primitives (`SJSelect.Root`,
   `.Trigger`, `.Content`, `.Item`) and a batteries-included preset built *from* them.
7. **Agent-native.** Each component ships a machine-readable contract (anatomy, ARIA roles,
   keyboard map, supported `kind`s, native fallback rules) consumable by `registry.json`,
   the MCP server, and lint rules.

## Strong concepts to carry forward and improve (concepts only)

- Layered form fields: Field (label, hint, error with linked ids) → BaseInput (prefix,
  leading, input, trailing, postfix) → concrete inputs.
- One types file per component documenting props, events, slots.
- Headless logic separated from rendering (disclosure, pagination, list search, selection).
- Orthogonal variant axes: `variant` × `tone` × `size`, mapped to tokens.
- Prop-or-slot for label, hint, content; controlled per-part class overrides.
- Data tables that emit intent (sort, filter, page, load-more) instead of owning data.
- "Engine + presets" for complex components (calendar, grid).
- Domain patterns: empty states (three kinds), command palette, hierarchical context select,
  collapsible side nav.

Known defects to design out: shared default ids across instances, no keyboard navigation in
listbox/combobox/menu/tabs, no focus trap or focus return in dialogs, hover-only tooltips,
hand-duplicated color values, hardcoded px, remote font imports.

## Research questions (owner: kimi-ds → `research/`)

1. **Platform primitives (2026 baseline).** Support status and gaps for: Popover API,
   CSS anchor positioning, `<dialog>` + `closedby`, `inert`, invoker commands
   (`command`/`commandfor`), customizable `<select>` (`appearance: base-select`),
   `ElementInternals` / form-associated custom elements, `:user-invalid`, View Transitions,
   `interestfor`. For each: what it replaces, browser support, fallback strategy.
2. **Headless engine design.** State-machine vs reducer vs signals; how one core binds to
   Vue reactivity, React (`useSyncExternalStore`, concurrent/SSR safety), and vanilla DOM.
   Prop-getter vs directive vs attribute-spreading APIs. SSR and hydration-safe id generation.
   Event handling and composition order. Tree-shaking and bundle budget.
3. **Accessibility engine.** APG patterns for combobox, listbox, menu, tabs, dialog,
   tooltip, disclosure, radio group, switch. Focus management, roving tabindex vs
   `aria-activedescendant`, typeahead, IME composition, live regions. Known screen
   reader × browser quirks (VoiceOver iOS/macOS, NVDA, JAWS, TalkBack). Required AT test
   matrix.
4. **Mobile and input UX.** `inputmode`, `type`, `autocomplete`, `enterkeyhint`,
   `autocapitalize`, `autocorrect`, `spellcheck` per intent `kind`; one-time-code; phone
   number formatting without breaking the keyboard or paste; locale-aware numbers; when a
   native picker beats a custom one; touch target and virtual keyboard viewport handling.
5. **Performance against the engine.** Rendering pipeline (style, layout, paint, composite),
   layout thrashing, passive listeners, event delegation, `content-visibility`, observers,
   virtualization; V8 considerations that actually matter for UI code (monomorphism, hidden
   classes, allocation in hot paths). Separate measured wins from folklore.
6. **Math and ML: where they genuinely help.** Positioning and collision geometry, fuzzy
   search ranking, typeahead, virtualization math, predictive prefetch, input-pattern
   detection. Be explicit about what is hype, what adds bundle weight, and what must stay
   deterministic for accessibility.
7. **Testing and certification.** Unit, interaction (Playwright), axe, real-AT manual
   protocol, visual regression, cross-framework parity tests from one shared spec.

Every claim cites a primary source (spec, MDN, web.dev, browser release notes, APG,
WebKit/Chromium/Gecko bug trackers) with a date.

## Process

1. kimi-ds writes `research/01-…md` to `research/07-…md`, one file per question.
2. ds-fable audits each file → `audits/AUDIT-research.md` with a PASS/FAIL verdict per file
   and concrete required fixes. kimi-ds fixes until PASS.
3. The orchestrator synthesizes `ARCHITECTURE.md` (decisions as ADRs: context, options,
   decision, consequences).
4. ds-fable audits `ARCHITECTURE.md` → `audits/AUDIT-architecture.md`. PASS = certified.
5. Only then: implementation plan.
