# @ramoslabs/css

Component stylesheets for RamosLabs. Plain CSS, zero JavaScript, tokens only. MIT licensed, part of the
RamosLabs Design System.

```css
@import '@ramoslabs/tokens/css';
@import '@ramoslabs/css'; /* everything: base + every component */
/* or pick files: */
@import '@ramoslabs/css/base.css';
@import '@ramoslabs/css/button.css';
```

## Cascade layers (public API)

```css
@layer sj.reset, sj.base, sj.component, sj.variant, sj.state;
```

The order is part of the public API (ADR-009). Every file repeats the statement, so importing a single
component still fixes the order. All library rules live inside these layers, which means **any unlayered
consumer CSS overrides the library** with a plain selector: no `!important`, no specificity fights.

### Consumer resets (caveat)

The same property cuts the other way: an **unlayered** consumer reset such as
`button { min-block-size: 0; padding: 0 }` or `* { margin: 0 }` also beats the library. It can remove the
44px touch target, the 16px control text or the focus ring. Put your reset in a layer declared before
`sj.reset`, for example:

```css
@layer reset, sj.reset, sj.base, sj.component, sj.variant, sj.state;
@layer reset {
  button {
    padding: 0;
  }
}
```

(`test/build.test.js` carries the override fixture and the caveat fixture.)

## Authoring

- One file per component in `src/<component>.css`; shared base in `src/base/`. `dist/index.css` is
  **generated** from a glob at build time; never edit it and never add a component to a shared file.
- Every top-level rule is wrapped in `@layer sj.<layer> { }`; the build fails otherwise. `@keyframes`
  and `@property` may sit beside layers. No `@import`, no layer-order statement in a source file.
- Tokens only: `var(--space-*)`, `var(--color-*)`, ... The `sj/*` stylelint rules (see
  `@ramoslabs/testing` lint) reject raw hex, raw px, non-token durations, `outline: none` without a
  replacement, remote URLs and physical (non-logical) properties.
- Start a component from `src/_template/` (`bun run new <name>`); see `src/_template/README.md`.
- Hooks: classes `sj-<component>__<part>`, plus `data-part`, `data-state`, `data-active`,
  `data-disabled`, `data-invalid`; axes `data-variant`, `data-tone`, `data-size`.

## Base styles

| File              | Layer                  | Provides                                                                                                    |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `base/reset.css`  | `sj.reset`             | box-sizing, form-control inheritance, `[hidden]`; scoped to `[data-part]`                                   |
| `base/base.css`   | `sj.base`              | 44px targets (`--sj-target`), `compact` density, 16px control text, scroll margin, `svh`/`dvh`, containment |
| `base/focus.css`  | `sj.state`             | focus ring from `:focus-visible` and `data-active`; forced-colors fallback                                  |
| `base/motion.css` | `sj.base` / `sj.state` | `--sj-duration-*`; collapsed to `0s` under `prefers-reduced-motion`                                         |

Density: default and `data-density="touch"` use `--target-min` (44px). `data-density="compact"` uses
`--target-floor` (24px) and returns to 44px on coarse pointers. `interactive-widget` is a viewport
`<meta>` setting; CSS cannot set it, so apps add
`<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">`.

Fonts are never imported: consumers load their own.
