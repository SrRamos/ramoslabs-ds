---
id: cards-metrics
title: Cards and Metrics
group: patterns
storybookTitle: Patterns/Cards and Metrics
summary: One hero figure per card, number and muted-unit typography with tabular figures, context placed next to its datum, the metadata line, and a compact overflow button with a 44px hit area
---

A card that shows an activity, an order or a balance has to be read in a glance. The reader should find one figure first, then the figures that explain it, then the picture. This page sets the hierarchy, the number typography, the proximity of context to data, and the small buttons a card carries.

## One hero figure per card

Order the card as three tiers: one **hero figure** (primary), a row of **label and value** metrics (secondary), then a visual or tertiary block such as a map or chart.

### ✓ Recommended: Card hierarchy

**Rule:** Give each card **one hero figure**, set at `--metric-hero-value`. Follow it with a row of label and value metrics at `--metric-value`, then the visual block.
**Why:** The eye needs a single entry point. Two big numbers compete, and the reader has to decide which one the card is about. NN/g’s guidance is page level and tolerates up to two large elements; “exactly one per card” is the DS’s stricter extension.

### ✕ Avoid: Card hierarchy

**Rule:** Do not give every number on the card the same size and weight, and do not put two hero figures side by side.
**Why:** When everything is emphasised, nothing is. The reader scans the whole card for the point.

*Sources: NN/g, Visual Hierarchy in UX. See item 1 of the research file.*

## Number and unit typography

A metric reads as a large number with a smaller, muted unit: `35 min 37 s`, `5:05 /km`. Numbers use `font-variant-numeric: tabular-nums` so columns of digits line up and a live value does not jitter. Plus Jakarta Sans ships the `tnum` feature: with `tabular-nums` every digit is 86.41 px wide at 36 px bold, while the default figures vary from 57.97 px (1111) to 90.98 px (8888). The check was run in Chromium against the self-hosted font.

| Token | Value | Use |
| --- | --- | --- |
| `--metric-hero-value` | 36 px (`--font-size-4xl`) | The one hero figure of a card. |
| `--metric-hero-unit` | 20 px (`--font-size-xl`) | The unit beside the hero figure. |
| `--metric-value` | 24 px (`--font-size-2xl`) | A secondary metric value. |
| `--metric-unit` | 16 px (`--font-size-base`) | The unit beside a secondary value. |

### ✓ Recommended: Number and unit

**Rule:** Set the number in `--metric-*-value` with `tabular-nums`, baseline-aligned, and the unit in the matching `--metric-*-unit` and `--color-text-muted`. The unit colour is never lighter than slate-500.
**Why:** The number carries the meaning, so it leads; the unit only qualifies it. Tabular figures keep digits aligned. Slate 500 is the muted-text floor (4.8:1 on white), so the small unit stays legible.

### ✕ Avoid: Number and unit

**Rule:** Do not set the unit in slate 400 or lighter, and do not set a unit at the same size and weight as its number.
**Why:** A light small unit fails 4.5:1, and a unit as loud as the number blurs where the value ends.

*Sources: MDN, font-variant-numeric (it does nothing if the font lacks the feature, hence the check above); AGENTS.md muted-text floor. The unit steps down the scale by about 55 percent of the value rather than one raw step, which keeps a clear hierarchy at 36 px.*

## Proximity: context sits next to its data

### ✓ Recommended: Context next to the datum

**Rule:** Put context and metadata next to the datum it explains. A location chip belongs **on the map**, not in the card header. Use `--space-related` inside a group and `--space-group` between groups.
**Why:** Gestalt proximity: things that sit together are read as belonging together. A chip on the map says “this is where”. The same chip in the header makes the reader link the two.

### ✕ Avoid: Context next to the datum

**Rule:** Do not use one spacing value everywhere, and do not park a datum’s context in the header, far from the datum.
**Why:** Equal spacing erases the groups, and distant context makes the reader do the joining.

*Sources: NN/g, Proximity Principle in Visual Design; IxDF, Proximity principle.*

Try it. Storybook: Patterns/Demos/Activity Card (recommended and equal-spacing counter-example side by side, with an RTL variant).

## The metadata line and the overflow button

Under the title, a metadata line joins who, when and where with a `•` separator (`aria-hidden`) and a `<time datetime>` for the relative time. The rule is on the Voice and Tone page. A card’s overflow `•••` button stays visually small but keeps a 44 px hit area on touch (Mobile First page).

Try it. Storybook: Patterns/Demos/Overflow Button.
