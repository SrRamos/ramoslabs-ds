---
id: colors
title: Colors
group: foundations
storybookTitle: Foundations/Colors
summary: Mono-indigo accent, slate neutral ramp, reserved status colors, role tokens over raw hex, and measured contrast floors
---

RamosLabs runs on a single action accent. Indigo carries every deliberate action and nothing else competes for it. One voice for action, a deep neutral ramp for everything else, reserved signals for state. The action accent is `#4f46e5`. Violet appears as a decorative accent only, never for action.

## The accent, up close

Eleven tested steps from light to dark. The interface lives at 600. Everything above tints, everything below deepens for hover and pressed states.

Indigo `--color-indigo-*`: 50 `#eef2ff`, 100 `#e0e7ff`, 200 `#c7d2fe`, 300 `#a5b4fc`, 400 `#818cf8`, 500 `#6366f1`, 600 `#4f46e5` (the accent), 700 `#4338ca` (hover), 800 `#3730a3`, 900 `#312e81`, 950 `#1e1b4b`.

Slate `--color-slate-*` (text, surfaces, borders, the 90% of the interface): 50 `#f8fafc`, 100 `#f1f5f9`, 200 `#e2e8f0`, 300 `#cbd5e1`, 400 `#94a3b8`, 500 `#64748b`, 600 `#475569`, 700 `#334155`, 800 `#1e293b`, 900 `#0f172a`, 950 `#020617`.

Ink `--color-ink-*` (the indigo-tinted neutral behind the neutral tone): 50 `#f6f6fb`, 100 `#ecedf5`, 200 `#e1e3ed`, 300 `#d1d3e0`, 400 `#8e91a2`, 500 `#6d7083`, 600 `#56596e`, 700 `#42465b`, 800 `#303448`, 900 `#222538`, 950 `#151829`.

Reserved for state, never decoration. The status families are authored in OKLCH so the jade, crimson and cerulean solids share one lightness (L 49), one step under Indigo 600, and honey keeps a dark ink label. This is the Harmonic palette (docs/research/status-tones-2026.md).

- Jade `--color-jade-*` (success): 50 `#effaf3`, 100 `#e1f3e8`, 200 `#cce8d7`, 300 `#7ed3a7`, 400 `#3f9a6f`, 500 `#03734a`, 600 `#006641`, 700 `#005636`, 800 `#1c422f`, 900 `#153424`, 950 `#0e271b`.
- Honey `--color-honey-*` (warning, dark label): 50 `#fcf6e9`, 100 `#f8edd5`, 200 `#f3ddb3`, 300 `#f8be52`, 400 `#efb146`, 500 `#e4a038`, 600 `#b66c18`, 700 `#8d4908`, 800 `#723606`, 900 `#442911`, 950 `#331d0b`.
- Crimson `--color-crimson-*` (error): 50 `#fff4f3`, 100 `#ffe7e6`, 200 `#ffd4d1`, 300 `#ffa09c`, 400 `#db5054`, 500 `#ae212f`, 600 `#9e1326`, 700 `#89061d`, 800 `#5f2324`, 900 `#4b1b1b`, 950 `#3b1313`.
- Cerulean `--color-cerulean-*` (info, 32° clear of indigo): 50 `#f0f8ff`, 100 `#e0f0ff`, 200 `#c9e3fb`, 300 `#80c5ff`, 400 `#348dcf`, 500 `#0065a1`, 600 `#00598f`, 700 `#004b7a`, 800 `#183c59`, 900 `#122f46`, 950 `#0c2436`.
- Violet `--color-secondary`: decorative support only.

Deprecated: `--color-emerald-*`, `--color-green-*`, `--color-amber-*`, `--color-red-*` and `--color-blue-*` are still published so nothing breaks, but no role or component uses them. They will be removed in a future major.

## Always reach for a role, not a raw color

The ramps are primitives: raw hues, named by number, never by meaning. Product code never touches them. It consumes a role, a token named for the job it does. Example: `--color-indigo-600` is a primitive (a number, no job); `--color-primary` is the role (what you use). Re-theme by re-pointing roles, not by hunting hex across a codebase. Roles are theme-agnostic: a future dark theme re-points targets, it never renames the role.

## Roles in context

- Primary action: rest `--color-primary`, hover `--color-primary-dark`, focus ring at `--color-focus`. The one accent for submit, confirm, active nav.
- Selected / accent zone: ✓ Recommended: `--color-primary-surface` tint with primary-colored text. ✕ Avoid: white text on the tint, it fails contrast on the pale surface.
- Text scale, one neutral hue: `--color-text-heading` 17.85:1, `--color-text-strong` 14.62:1, `--color-text-body` 10.35:1, `--color-text-secondary` 7.57:1, `--color-text-muted` 4.75:1, `--color-text-disabled` state only.
- Status roles. Each tone T in success, warning, error and info has the same set:
  - Solid control: `--color-T-solid` fill, `-solid-hover`, `-solid-press`, label `--color-T-on-solid` (white, or dark ink for warning). The label holds 4.5:1 on the 12% sheen, hover and press.
  - Soft: `--color-T-surface`, `-surface-hover`, `-surface-press`, with `--color-T-text` (4.5:1 on all three) and `-text-strong` for titles.
  - Edges: `--color-T-border` for alert and badge hairlines, `--color-T-outline` for the outline variant (3:1).
  - `--color-T-strong`: an AA-safe fill for a white glyph (3:1 non-text).
- Neutral tone: `--color-neutral-*` (ink) with the same solid, soft, text and outline roles.
- Feedback, each a full triad (solid + surface + text):
  - Success: `--color-success-solid` + `-surface` + `-text`.
  - Warning: `--color-warning-solid` with `--color-warning-on-solid` (dark ink), never white text. Honey is light, so the label is dark.
  - Error: `--color-error-solid` + `-surface` + `-text`. The destructive button fill is `--color-error-solid`.
  - Info: `--color-info-solid` + `-surface` + `-text`. Cerulean sits 32° from indigo so context never reads as an action.
- Dark surfaces: every role has a `-dark` counterpart (`--color-T-text-dark`, `-surface-dark`, `-border-dark`, `-outline-dark`, `--color-text-*-dark`, `--color-surface-dark`, `--color-background-dark`), checked on slate 900 and 950. Components switch under any `[data-theme='dark']` ancestor. Primary keeps Indigo 600 as the fill; its outline, ghost and link text move to `--color-primary-text-dark` (Indigo 400), because Indigo 600 is 2.83:1 on slate 900.

## Contrast you can see

Contrast is a floor. WCAG 2.2 asks 4.5:1 for normal text, 3:1 for large text and UI edges (AA); 7:1 is AAA. Measured pairings:

- Primary on white: 6.28, AA
- White on primary-dark: 7.90, AAA
- Heading on white: 17.85, AAA
- Body on white: 10.35, AAA
- Muted on white: 4.75, AA
- White on success-solid, lightest sheen pixel: 4.63, AA
- White on error-solid, lightest sheen pixel: 5.55, AA
- White on info-solid, lightest sheen pixel: 4.89, AA
- Ink on warning-solid: 9.44, AAA
- White on warning-solid: 1.68, fail, use the ink label
- Primary text on dark (indigo 400 on slate 900): 5.98, AA
- Indigo 600 on slate 900: 2.83, fail, use primary-text-dark
- Disabled on white: 1.48, by design

Rule: pair every status color with an icon and a label, give every invalid field real text, and make focus a visible ring. Why: color is never the only channel (WCAG 2.2 SC 1.4.1), so meaning survives for color-blind and low-vision users. Color reinforces, it never carries meaning by itself.

## Sources

WCAG 2.2 contrast floors SC 1.4.3 / 1.4.6 / 1.4.11 and use of color SC 1.4.1. Role-token model after Material 3 color roles and Refactoring UI numbered scales. The 60-30-10 accent balance is a common color composition rule.
