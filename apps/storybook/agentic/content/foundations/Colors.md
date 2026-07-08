---
id: colors
title: Colors
group: foundations
storybookTitle: Foundations/Colors
summary: Mono-indigo accent, slate neutral ramp, reserved status colors, role tokens over raw hex, and measured contrast floors
---

RamosLabs runs on a single accent. Indigo carries every deliberate action and nothing else competes for it. One voice for action, a deep neutral ramp for everything else, reserved signals for state. The accent is `#4f46e5`. No second brand hue, no rainbow.

## The accent, up close

Eleven tested steps from light to dark. The interface lives at 600. Everything above tints, everything below deepens for hover and pressed states.

Indigo `--color-indigo-*`: 50 `#eef2ff`, 100 `#e0e7ff`, 200 `#c7d2fe`, 300 `#a5b4fc`, 400 `#818cf8`, 500 `#6366f1`, 600 `#4f46e5` (the accent), 700 `#4338ca` (hover), 800 `#3730a3`, 900 `#312e81`, 950 `#1e1b4b`.

Slate `--color-slate-*` (text, surfaces, borders, the 90% of the interface): 50 `#f8fafc`, 100 `#f1f5f9`, 200 `#e2e8f0`, 300 `#cbd5e1`, 400 `#94a3b8`, 500 `#64748b`, 600 `#475569`, 700 `#334155`, 800 `#1e293b`, 900 `#0f172a`, 950 `#020617`.

Reserved for state, never decoration:

- Emerald `--color-emerald-*`: success solid.
- Green `--color-green-*`: success surface and text.
- Amber `--color-amber-*`: warning.
- Red `--color-red-*`: error.
- Blue `--color-blue-*`: info.
- Violet `--color-secondary`: decorative support only.

## Always reach for a role, not a raw color

The ramps are primitives: raw hues, named by number, never by meaning. Product code never touches them. It consumes a role, a token named for the job it does. Example: `--color-indigo-600` is a primitive (a number, no job); `--color-primary` is the role (what you use). Re-theme by re-pointing roles, not by hunting hex across a codebase. Roles are theme-agnostic: a future dark theme re-points targets, it never renames the role.

## Roles in context

- Primary action: rest `--color-primary`, hover `--color-primary-dark`, focus ring at `--color-focus`. The one accent for submit, confirm, active nav.
- Selected / accent zone: ✓ Recommended: `--color-primary-surface` tint with primary-colored text. ✕ Avoid: white text on the tint, it fails contrast on the pale surface.
- Text scale, one neutral hue: `--text-heading` 17.85:1, `--text-strong` 14.63:1, `--text-secondary` 7.58:1, `--text-body` 4.76:1, `--text-disabled` state only.
- Feedback, each a full triad (strong solid + surface + text):
  - Success: `--color-success-strong` + `-surface` + `-text`. Strong solid for the icon so the white check clears 3:1.
  - Warning: `--color-warning` + `-surface` + `-text`. Amber is bright, so it carries dark text, never white.
  - Error: `--color-error` + `-surface` + `-text`. For a red button with white text, use `--color-error-strong`.
  - Info: `--color-info` + `-surface` + `-text`. Kept distinct from indigo so context never reads as an action.

## Contrast you can see

Contrast is a floor. WCAG 2.2 asks 4.5:1 for normal text, 3:1 for large text and UI edges (AA); 7:1 is AAA. Measured pairings:

- Primary on white: 6.29, AA
- White on primary-dark: 7.90, AAA
- Heading on white: 17.85, AAA
- Body / muted on white: 4.76, AA
- White on error-strong: 4.83, AA
- White on error (red 500): 3.76, large only
- Dark text on warning: 8.31, AAA
- White on warning: 2.15, fail
- Disabled on white: 1.48, by design

Rule: pair every status color with an icon and a label, give every invalid field real text, and make focus a visible ring. Why: color is never the only channel (WCAG 2.2 SC 1.4.1), so meaning survives for color-blind and low-vision users. Color reinforces, it never carries meaning by itself.

## Sources

WCAG 2.2 contrast floors SC 1.4.3 / 1.4.6 / 1.4.11 and use of color SC 1.4.1. Role-token model after Material 3 color roles and Refactoring UI numbered scales. The 60-30-10 accent balance is a common color composition rule.
