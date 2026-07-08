---
id: helpers
title: Helpers
group: foundations
storybookTitle: Foundations/Helpers
summary: Single-purpose utility classes sourced from tokens, the token-utility-component decision, and the sr-only and focus-ring infrastructure
---

Utilities are single-purpose classes that do exactly one thing, and every value traces back to a token. This is a curated set, not a dump. If a helper would type `16px` by hand instead of reading `--space-4`, it does not belong here.

## Token, utility, or component

Three layers carry style. Reach for the layer that answers the question you actually have.

- Layer 1, Token: the value, named once. `--space-4`, `--color-primary`, `--radius-lg`. What is the value?
- Layer 2, Utility: one class, one declaration, sourced from a token. `.gap-4` sets `gap: var(--space-4)`. Apply one value, here, now.
- Layer 3, Component: a named pattern with scoped styles, structure, and states. An event card, a button, a checkout row. A whole reusable thing.

Rule: source every utility value from a token, never a hand-typed value. Why: that is what separates a design-system utility from a loose grab bag of CSS.

- ✓ Recommended: `.gap-4 { gap: var(--space-4); }`. Reads the token, so one change to the scale updates every gap at once.
- ✕ Avoid: `.gap-4 { gap: 16px; }`. A hand-typed pixel drifts from the token and quietly breaks the system.

## The catalog

Every class is one declaration, and every sized value traces to a token.

Display: `.d-none` display: none; `.d-block` display: block; `.d-inline` display: inline; `.d-inline-block` display: inline-block; `.d-flex` display: flex; `.d-inline-flex` display: inline-flex; `.d-grid` display: grid.

Flexbox: `.flex-row` flex-direction: row; `.flex-col` flex-direction: column; `.flex-wrap` flex-wrap: wrap; `.flex-1` flex: 1 1 0%; `.flex-auto` flex: 1 1 auto; `.flex-none` flex: none.

Alignment: `.items-start` align-items: flex-start; `.items-center` align-items: center; `.items-end` align-items: flex-end; `.justify-center` justify-content: center; `.justify-between` justify-content: space-between; `.justify-end` justify-content: flex-end.

Layout and overflow: `.w-full` width: 100%; `.h-full` height: 100%; `.min-w-0` lets a flex child shrink so truncation works; `.overflow-auto` overflow: auto; `.truncate` one line, ellipsis (hidden overflow, nowrap, ellipsis together).

Gap (every step is a token): `.gap-1` var(--space-1) 0.25rem; `.gap-2` var(--space-2) 0.5rem; `.gap-3` var(--space-3) 0.75rem; `.gap-4` var(--space-4) 1rem; `.gap-6` var(--space-6) 1.5rem; `.gap-8` var(--space-8) 2rem.

Typography: `.text-center` text-align: center; `.text-sm` var(--font-size-sm); `.text-base` var(--font-size-base); `.text-lg` var(--font-size-lg); `.text-xl` var(--font-size-xl); `.font-medium` var(--font-weight-medium); `.font-semibold` var(--font-weight-semibold); `.font-bold` var(--font-weight-bold).

Text color (semantic tokens only): `.text-primary` var(--color-text-heading); `.text-secondary` var(--color-text-secondary); `.text-muted` var(--color-text-muted); `.text-error` var(--color-error-text); `.text-success` var(--color-success-text).

Border radius: `.rounded-sm` var(--radius-sm) 0.375rem; `.rounded-md` var(--radius-md) 0.5rem; `.rounded-lg` var(--radius-lg) 0.75rem; `.rounded-xl` var(--radius-xl) 1rem; `.rounded-pill` var(--radius-pill) 9999px.

Rule: name each helper after the token it reads, so one vocabulary runs top to bottom. Why: a class named for a value the token layer never uses is exactly the drift that erodes trust in the system.

- ✓ Recommended: `.rounded-pill` reads `var(--radius-pill)`. The class mirrors the token name, so the two stay in sync.
- ✕ Avoid: `.rounded-full`. Describes a scale the tokens never define; the mismatch invites drift.

## Utilities at work

A handful of structural helpers, read in one glance, is fair use. The moment the same cluster becomes a card you build twenty times, give it a name and let the helpers go.

```html
<!-- Ticket status: label left, state right, one token gap -->
<div class="d-flex items-center justify-between gap-4">
    <span class="text-muted text-sm">Ticket status</span>
    <span class="font-semibold text-success">Confirmed</span>
</div>

<!-- Long venue name that must never break the row -->
<div class="d-flex items-center gap-2 min-w-0">
    <span class="truncate">Teatro Metropolitano Jose Gutierrez Gomez</span>
</div>

<!-- Icon-only button: eyes see the X, screen readers hear the label -->
<button class="d-inline-flex items-center focus-ring cursor-pointer">
    <span class="sr-only">Close ticket details</span>
    <svg aria-hidden="true">...</svg>
</button>
```

## The two helpers that matter most

Two exist purely to serve assistive technology. Treat them as required infrastructure, not decoration.

- `.sr-only`: visually hidden, still announced by screen readers. For icon-button labels, form hints, and status that is obvious by sight but silent to the tree.
- `.focus-ring`: applies the system focus treatment on `:focus-visible`, pairing with `var(--color-focus)` so keyboard users always see where they are.

Visually hidden is a solved problem with a canonical recipe. The common shortcut `display: none` is wrong for it: that also drops the element from the accessibility tree, the opposite of the goal. Inside `.sr-only`, declaration by declaration:

- `position: absolute`: pulls the element out of flow so its collapsed box disturbs nothing.
- `width: 1px; height: 1px`: collapses the box to one pixel. Not zero, since a zero-sized box can be dropped from the tree.
- `overflow: hidden`: clips the real content down to that one-pixel box so none of it paints.
- `clip + clip-path: inset(50%)`: clips the visible region to nothing. The clip-path rule does the work in modern engines; the deprecated clip stays as a fallback.
- `white-space: nowrap`: stops the collapsed text from wrapping, which could reintroduce a sliver of layout.
- `margin: -1px; border: 0`: zeroes the box model and nudges it off-screen so nothing leaks.

```css
/* The canonical visually-hidden utility */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
}
```

Rule: use `.sr-only` for meaning that is obvious by sight but silent to the tree, never to stuff invisible keywords. Why: the word behind an icon-only button, the meaning of a required asterisk. A skip link that must reveal itself on keyboard focus uses the focusable variant. See Patterns / Accessibility.

- ✓ Recommended: `<span class="sr-only">Close</span>`. Keeps the pixels hidden while the label still reaches assistive tech.
- ✕ Avoid: `display: none`. Drops the element from the accessibility tree, so a screen reader never hears it.

## Which layer, in five questions

Walk down until one fits.

1. Just need the value, inside a component's own scoped CSS? Reference the token, for example `var(--space-4)`. No utility needed.
2. One structural adjustment in markup, a gap, an alignment, a width? Use the matching utility.
3. The same three or four utilities always travel together on the same kind of element? That pattern has a name. Extract a component.
4. The element needs structure, states, or behavior, a card, a modal, a checkout row? Build it as a named component with its own scoped styles from the start.
5. The need is purely for assistive tech, hiding a label or showing focus? Use `.sr-only` or `.focus-ring`. Infrastructure, not styling.

## Sources

Utility-first model and the extract-to-component threshold: Tailwind CSS and Adam Wathan, CSS Utility Classes and Separation of Concerns. The composition-plus-blocks balance follows Andy Bell, CUBE CSS. The visually-hidden recipe: W3C WAI WCAG technique C7 and Scott O'Hara, Inclusively Hidden. Visible focus is WCAG 2.1 SC 2.4.7. The exact class names, token bindings, and the reading of `.sr-only` and `.focus-ring` as required infrastructure are specific to this system.
