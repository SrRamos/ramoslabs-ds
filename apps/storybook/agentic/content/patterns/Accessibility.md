---
id: accessibility
title: Accessibility
group: patterns
storybookTitle: Patterns/Accessibility
summary: The POUR taxonomy, semantic-HTML-before-ARIA, contrast ratios, keyboard and focus, target size, name-role-value, and a pre-ship checklist keyed to WCAG 2.2
---

Our floor is WCAG 2.2 Level AA on every surface, and Level AAA wherever a pattern reaches it without hurting the experience.

## 1. The Four Pillars: POUR

Every WCAG success criterion hangs off four principles. Miss one and the interface locks out a real person.

- Perceivable (SC 1.1 to 1.4): reaches every sense. Text alternatives for images, captions for audio, contrast that survives low vision, never color alone.
- Operable (SC 2.1 to 2.5): works from a keyboard. Nothing traps focus, targets are big enough to hit, motion can be turned down.
- Understandable (SC 3.1 to 3.3): reads clearly and behaves predictably. Labels stay put, errors explain themselves, focus never surprises.
- Robust (SC 4.1): valid markup, and every control exposes a name, a role, and a value that assistive technology can read.

## 2. Semantic HTML Before ARIA

The first rule of ARIA is: do not use ARIA. Reach for the native element first.

**Rule:** Reach for the native element first, and add ARIA only to fill a gap it leaves.
**Why:** a native `<button>`, `<nav>`, or `<a href>` ships with a role, an accessible name, keyboard behavior, and focus already wired in. ARIA changes only what a screen reader announces, so anything you build on a bare `<div>` you also have to make operable and focusable by hand.

- ✓ Recommended: `<button type="button">Buy tickets</button>`. Role, accessible name, focus stop, and keyboard activation come for free, and it behaves the same in every browser and assistive tech.
- ✕ Avoid: `<div onclick="buy()">Buy tickets</div>`. No role, no keyboard, no focus stop. You would have to rebuild `tabindex`, key handling, and the focus ring by hand.

1. Prefer the native element whenever it carries the semantics and behavior you need. A real `<button>` beats `<div role="button" tabindex="0">`.
2. Keep native semantics intact: nest a real element inside rather than repainting one with a role.
3. Keep every interactive ARIA control keyboard operable. Add `role="button"` and you own `Enter`, `Space`, focus, and the ring.
4. Keep focusable elements visible to assistive tech: `aria-hidden="true"` and `role="presentation"` belong only on content that cannot receive focus.
5. Give every interactive element an accessible name: a visible `<label>`, its text, `aria-label`, or `aria-labelledby`.

No ARIA is better than bad ARIA. Unsure? Drop to semantic HTML.

## 3. Contrast, Color, and Dark Mode

SC 1.4.3 asks 4.5:1 on text and 3:1 on large text (18pt, or 14pt bold). SC 1.4.11 asks 3:1 on interactive edges and meaningful graphics. SC 1.4.1 means color is never the only signal: an error is red and carries an icon and text.

Brand pairings, all clearing their floor:

| Pairing | Ratio | Level |
|---------|-------|-------|
| Heading on White (`#0f172a` on `#ffffff`) | 17.85:1 | AAA |
| Muted on White (`#64748b` on `#ffffff`) | 4.76:1 | AA |
| White on Primary (`#ffffff` on `#4f46e5`) | 6.29:1 | AA |
| White on Primary Dark (`#ffffff` on `#4338ca`) | 7.90:1 | AAA |

Dark mode is not a reskin. Both themes are tuned by hand, both clear the floor, and both are wired to `prefers-color-scheme`.

Measure pairings in Foundations / Color Picker; token ratios in Foundations / Colors.

## 4. Keyboard and Focus

SC 2.1.1 Keyboard asks that every control be reachable and operable from the keyboard. The activation key follows the role: Tab moves focus, Space activates buttons and checkboxes, Enter activates links and buttons. SC 2.1.2 No Keyboard Trap is a separate promise: focus that lands somewhere can always move away again through a standard mechanism, not necessarily Escape. Escape-to-close is a dialog and menu convention from the ARIA APG, not part of 2.1.1. Focus stays visible (SC 2.4.7) and is never hidden behind sticky UI (SC 2.4.11).

**Rule:** Keep a visible focus indicator on every focusable control.
**Why:** the focus ring is how a keyboard user knows where they are. If a design has to drop the default outline, replace it with something at least as clear, never with nothing.

Skip links let a keyboard user jump straight to `<main>` instead of tabbing through the whole nav. `.sr-only` keeps a label in the accessibility tree while hiding it on screen.

Helpers to add to `main.css`:

- `.focus-ring`: visible focus indicator: outline plus offset plus soft ring
- `.skip-link`: hidden link that appears on focus and jumps to main content
- `.sr-only`: visually hidden but present in the accessibility tree

## 5. Target Size and Motion

A control has to be big enough to hit. SC 2.5.8 sets a floor of 24 by 24 CSS pixels; we aim for 44 by 44, the size Apple and WCAG AAA both recommend. Honor `prefers-reduced-motion` as a floor, collapse the motion, keep the meaning (SC 2.3.3, SC 2.2.2).

- `.touch-target`: pads the hit area to a minimum 44 by 44px without changing the visual
- `.no-motion`: disables animation and transition on an element and its children

Target and spacing scale in Foundations / Spacing; reduced-motion tokens in Foundations / Motion.

## 6. Screen Readers: Name, Role, and Value

SC 4.1.2 requires all three off every control. A native `<input type="checkbox">` with a label supplies them for free; a `<div>` styled to look like one supplies none, so a custom widget must set each by hand and keep the value in sync.

- Name: what it is called. "Search", "Buy tickets", "Close dialog".
- Role: what kind of thing it is. Button, checkbox, tab, dialog.
- Value / State: where it stands now. Checked, expanded, "3 of 10".

Live regions announce changes away from focus: a cart count, a validation error, results loading. Use `role="alert"` to interrupt, and `role="status"` or `aria-live="polite"` to wait for a pause.

## 7. Before You Ship

Run this before every PR.

- Semantic HTML elements (button, nav, main, header, article) (SC 1.3.1)
- Color contrast: 4.5:1 normal text, 3:1 large text and UI (SC 1.4.3 / 1.4.11)
- Visible focus, never obscured behind sticky UI (SC 2.4.7 / 2.4.11)
- Accessible name on every control, including icon-only buttons (SC 4.1.2)
- Labels connected to form inputs (for/id) (SC 3.3.2)
- Touch targets: 24x24px floor (AA), 44x44px target (AAA) (SC 2.5.8)
- Live regions announce dynamic status messages (SC 4.1.3)
- prefers-reduced-motion respected (SC 2.3.3)
- Keyboard: Tab reaches every control, Space and Enter activate by role, focus can always move away (SC 2.1.1 / 2.1.2)
- Screen reader pass (VoiceOver or NVDA) (SC 4.1.2)

## Code Reference

Focus states and motion preferences:

```css
/* Global focus ring - applies to all focusable elements */
:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}

/* Custom focus ring utility */
.focus-ring:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15);
}

/* Respect motion preferences globally */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* Manual motion disable (for JS toggle) */
.no-motion, .no-motion * {
    animation: none !important;
    transition: none !important;
}

/* Dark mode - automatic based on system preference */
@media (prefers-color-scheme: dark) {
    :root {
        --color-text-heading: #f1f5f9;
        --color-text-body: #cbd5e1;
        --color-surface: #1e293b;
        --color-background: #0f172a;
    }
}

/* Manual dark mode toggle (via class or data attr) */
.dark, [data-theme="dark"] {
    --color-text-heading: #f1f5f9;
    --color-text-body: #cbd5e1;
    /* ... all dark tokens ... */
}
```

Skip links and screen reader utilities:

```css
/* Skip link - hidden until focused */
.skip-link {
    position: absolute;
    top: -100%;
    left: 1rem;
    padding: 1rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-md);
    font-weight: 600;
    text-decoration: none;
    z-index: 9999;
}
.skip-link:focus { top: 1rem; }

/* Screen reader only - visually hidden but accessible */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* Touch target - ensures minimum clickable area */
.touch-target { position: relative; }
.touch-target::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 44px;
    min-height: 44px;
}
```

ARIA live regions:

```html
<!-- Error - interrupts immediately -->
<div role="alert">Payment failed. Please try again.</div>

<!-- Status - waits for pause in speech -->
<div role="status">3 items in cart</div>

<!-- Loading state -->
<div role="status" aria-busy="true">Loading events...</div>

<!-- Search results - announces full content -->
<div aria-live="polite" aria-atomic="true">Showing 24 events</div>
```

Accessible forms:

```html
<div class="form-field">
    <label for="email">
        Email <span aria-hidden="true">*</span>
        <span class="sr-only">(required)</span>
    </label>
    <input type="email" id="email" autocomplete="email"
        aria-required="true" aria-describedby="email-error" />
    <p id="email-error" role="alert" hidden>Enter a valid email</p>
</div>
```

Accessible modals:

```html
<!-- Modal dialog: traps focus, closes on Escape, returns focus -->
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <h2 id="modal-title">Confirm Purchase</h2>
    <p>Buy 2 tickets for $150?</p>
    <button>Cancel</button>
    <button autofocus>Confirm</button>
</div>

<!-- Background becomes inert -->
<div id="app" inert>...</div>
```

## Sources

WCAG 2.2 success criteria (w3.org/TR/WCAG22): contrast 1.4.3 / 1.4.11, use of color 1.4.1, keyboard 2.1.1 / 2.1.2, focus 2.4.7 / 2.4.11 / 2.4.13, target size 2.5.8 / 2.5.5, motion 2.3.3 / 2.2.2, name-role-value 4.1.2, status messages 4.1.3. POUR and the five rules of ARIA from W3C WAI and Using ARIA; widget patterns from the ARIA Authoring Practices Guide. The one-in-six disability figure is WHO; the 44px touch target follows the Apple Human Interface Guidelines. Ratios use the WCAG relative-luminance formula.
