---
id: multi-step-flows
title: Multi-step Flows
group: patterns
storybookTitle: Patterns/Multi-step Flows
summary: One question per screen with the question as the heading, a stepper that pairs the text 1 de 3 with a segmented bar, grouped display of long numbers over a raw submitted value, and a sticky full-width action
---

A long form is a mountain; a sequence of single questions is a path. This page sets one question per screen, the stepper that shows progress, how long numbers are displayed, and the sticky action at the bottom.

## One question per screen

### ✓ Recommended: One question per screen

**Rule:** Ask **one question per screen** in a multi-step flow and make the question the heading: “¿A quién le envías dinero?”. Move focus to the new heading when the screen changes.
**Why:** GOV.UK’s “one thing per page” lets people focus, keeps errors specific to one answer, and works well on a small screen. Focus on the heading tells a screen reader that the page changed.

### ✕ Avoid: One question per screen

**Rule:** Do not put a long form on one screen when the answers are independent, and do not change the screen without moving focus.
**Why:** A wall of fields is abandoned, and a silent change leaves keyboard and screen reader users stranded.

*Sources: GOV.UK Design System, Question pages; GOV.UK Service Manual, Form structure; NN/g, Wizards. GOV.UK allows a statement heading where several closely related questions share a page.*

## The stepper: text plus a bar

### ✓ Recommended: Flow progress

**Rule:** Show progress as the text **“1 de 3”** plus a **segmented bar**. The text is mandatory. Make the current segment taller as well as coloured, and mark the bar `aria-hidden` because the text already says it.
**Why:** The bar alone is colour only, which fails WCAG 1.4.1 and says nothing to a screen reader. The text gives the exact position and the bar gives a quick sense of how far is left. NN/g finds progress indicators make waits feel shorter.

### ✕ Avoid: Flow progress

**Rule:** Do not show progress with a coloured bar alone, and do not hide the total.
**Why:** People who cannot tell the colours apart, and screen reader users, get no information, and an unknown total makes the flow feel endless.

*Sources: W3C Understanding SC 1.4.1 Use of Color; NN/g, Progress Indicators Make a Slow System Less Insufferable. The “1 de 3” plus segmented bar format is the DS’s own design.*

## Display and submit are two different values

Account numbers and amounts are shown in groups (`0123 4567 8901`, `1.250.000`). The submitted value stays raw digits. The demo reads the form data on submit and prints exactly what would be sent. The rule and its caveats (do not mask phone numbers) are on the Form Elements page.

## The primary action stays in reach

The continue button is full width and sticky at the bottom of the screen, in Indigo 600, with `scroll-padding` so a focused field is never hidden. Fields are 48 px, and 56 px on touch. Both rules live on the Mobile First and Form Elements pages.

Try it. Storybook: Patterns/Demos/Send Money (three steps, with an RTL variant).
