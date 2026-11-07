---
id: bottom-navigation
title: Bottom Navigation
group: patterns
storybookTitle: Patterns/Bottom Navigation
summary: Icon plus a visible label on three to five destinations, an active tab marked by a filled icon, colour and weight and never colour alone, and an optional centre action only when it is the primary action of the app
---

Bottom navigation puts the main destinations under the thumb. An icon alone is a guess; the active state must be more than a colour. This page sets labels, the active state, the count of destinations and the optional centre action.

## Icon plus a visible label

### ✓ Recommended: Labels

**Rule:** Give every destination an **icon and a visible label**. Keep three to five destinations. Each tab is at least 44 px wide and 64 px tall, and the bar respects the bottom safe area.
**Why:** Icons are ambiguous without words, and NN/g reports that labelled icons are understood faster. Three to five destinations fit a phone width without truncating labels, and Material limits the bar to five.

### ✕ Avoid: Labels

**Rule:** Do not ship icon-only tabs, and do not go beyond five destinations.
**Why:** People guess, and six tabs squeeze labels or targets under 44 px.

## The active tab: shape, colour and weight

### ✓ Recommended: Active state

**Rule:** Mark the active tab with a **filled icon**, the primary colour and a bolder label, and set `aria-current="page"`.
**Why:** WCAG 1.4.1: colour alone does not carry meaning. A filled shape and a heavier label are visible without colour, and `aria-current` tells a screen reader which page is current.

### ✕ Avoid: Active state

**Rule:** Do not show the active tab by colour alone.
**Why:** Someone who cannot tell the hues apart cannot find where they are.

*Sources: NN/g, Icon Usability and Mobile Navigation Patterns; Material Design 3, Navigation bar; W3C Understanding SC 1.4.1. The research file could not confirm the Material and Apple pages directly for the filled-icon convention, so the filled-icon active state is a DS design choice backed by 1.4.1.*

## The optional centre action

### ✓ Recommended: Centre action

**Rule:** A prominent centre action is allowed **only when it is THE primary action of the app** (for example “Registrar” in a tracking app). It needs an accessible name and a visible label. If a design cannot have a visible label, document the exception.
**Why:** One standing action in the bar is a strong promise to the user. Two competing actions, or an unlabelled round button, weaken the bar and fail the label rule.

### ✕ Avoid: Centre action

**Rule:** Do not add a centre action for something that is not the app’s main action, and do not leave it without a label.
**Why:** It takes the most prominent place in the screen, so it must earn it, and an unlabelled round button is a guess.

*The research file found no primary source for the centre-action caveat; it is a DS rule layered on the Material guidance for the single primary action.*

Try it. Storybook: Patterns/Demos/Bottom Navigation (recommended against icon-only, plus a centre action and an RTL variant).
