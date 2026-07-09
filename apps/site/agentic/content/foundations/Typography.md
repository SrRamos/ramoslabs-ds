---
id: typography
title: Typography
group: foundations
storybookTitle: Foundations/Typography
summary: Three font families, a ten-step size scale, five role recipes, and the weight, leading, tracking, and measure rules
---

RamosLabs types on three families and one ten-step scale. Every piece of text takes a role (Display, Headline, Title, Body, or Label), and the role hands it a family, size, weight, line-height, and tracking. Pick the role; the type takes care of itself.

## Three voices

- `--font-family-display`, Red Hat Display: geometric, slightly condensed, built to carry weight above 36px. Reserved for Display and Headline. Below the Title role its personality costs legibility.
- `--font-family-sans`, Rubik: humanist, large x-height, open apertures, distinct at small sizes. The default for the whole product. If unsure which family to use, it is this one.
- `--font-family-alt`, Roboto: metric-compatible fallback for dense system UI, embedded documents, or while web fonts load. Use it for a whole block on its own, never mixed with Rubik.

## One scale, ten steps

12px metadata to 60px display, a modular scale. 16px is the floor for body reading. Nothing on a surface sits between these steps.

- `--font-size-6xl`: 3.75rem 60px, Display
- `--font-size-5xl`: 3rem 48px, Display
- `--font-size-4xl`: 2.25rem 36px, Display
- `--font-size-3xl`: 1.875rem 30px, Headline
- `--font-size-2xl`: 1.5rem 24px, Headline
- `--font-size-xl`: 1.25rem 20px, Title
- `--font-size-lg`: 1.125rem 18px, Title
- `--font-size-base`: 1rem 16px, Body, the reading floor
- `--font-size-sm`: 0.875rem 14px, Label, helper and labels
- `--font-size-xs`: 0.75rem 12px, Label, metadata only

## Every role, one recipe

Design and build against the role, never against a raw pixel. Five groups, after the Material 3 model.

| Role | Family | Weight | Leading | Tracking |
| --- | --- | --- | --- | --- |
| Display | Red Hat Display | bold / extrabold | none / tight | tighter / tight |
| Headline | Red Hat Display | bold | tight / snug | tight |
| Title | Display or Sans | semibold | snug | normal |
| Body | Rubik | normal | normal / relaxed | normal |
| Label | Rubik | medium / semibold | none / snug | wide / wider |

## Three axes carry the rest

Weight, line-height, and tracking express hierarchy without inventing a new size.

Weight: the scale runs 100 to 800. Working range of five: 400 body, 500 label, 600 title, 700 head, 800 display. Rule: keep the three light weights for display sizes, and set text at 16px and under in 400 or heavier. Why: below 16px, thin strokes lose effective contrast and fail low-vision readers.

Line height, inverse to size: `--leading-tight` 1.1 for display, `--leading-normal` 1.5 for the body floor. Rule: set body at 1.5 line-height or more, and move long-form to `--leading-relaxed` 1.625. Why: 1.5 within paragraphs is the WCAG 1.4.8 Visual Presentation (AAA) target. WCAG 1.4.12 Text Spacing (AA) is a separate promise: text must stay readable when a reader forces 1.5x spacing, which a rem scale that reflows cleanly already meets.

Tracking, tight for big, wide for caps: headline tighter -0.05em, body normal 0em, label wider 0.05em. Rule: reserve positive tracking for uppercase Labels, and leave lowercase body at 0. Why: extra space restores the legibility all-caps removes, while any tracking on lowercase body distorts word shape.

## The measure

Line length decides whether a paragraph is calm or exhausting. Cap running text between 45 and 75 characters with `max-width` in `ch`. Around 66 is the sweet spot.

- ✓ Recommended, 45 to 75ch: the eye finds the start of the next line without effort. Cap body columns in ch, never leave running text at full container width.
- ✕ Avoid, over 75ch: past seventy-five characters the reader travels too far back, loses their place, and rereads. The single most common readability failure in dashboards and admin tools.

Hierarchy must survive one color. Distinguish levels with size, weight, and space, and back every color step with a real size or weight difference. The scale is defined in `rem`, so text still scales to 200% (WCAG 1.4.4), and body holds at 1.5 line-height or more (WCAG 1.4.8).

## Sources

Role groups after Material 3 type scale. The 45 to 75ch measure from Butterick, Practical Typography, and Baymard. Fluid type with clamp() from Utopia and web.dev. Accessibility floors from WCAG 2.1 SC 1.4.4 Resize Text, 1.4.12 Text Spacing, and 1.4.8 Visual Presentation.
