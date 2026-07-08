---
id: motion
title: Motion
group: foundations
storybookTitle: Foundations/Motion
summary: Three durations, five easings, the transform-and-opacity performance contract, and reduced-motion as the floor
---

Every animation earns its place by answering one question: where did that come from, are these the same thing, did my tap register. No job, no motion. The system is deliberately small, three durations and five easings, so the whole product moves at one tempo: fast, and quiet.

## Purposeful, not decorative

Motion earns its place by clarifying a change, never by dressing one up.

- ✓ Recommended:
  - Orientation. A menu grows from the button that opened it.
  - Continuity. A row animates to its new spot instead of jumping.
  - Feedback. A control settles after a tap, confirming the press.
- ✕ Avoid:
  - Entrances that animate with nothing to orient.
  - Looping, attention-grabbing movement with no status behind it.
  - Long, cinematic reveals that make the interface wait.

## The three durations

Match the duration to the size of the change. Nothing runs past 300ms, where responsive starts to feel slow.

- `--duration-fast`, 150ms: local state on a control the user is already watching. A hover tint, a focus ring, an icon toggling, a checkbox filling.
- `--duration-normal`, 200ms: the default. Things entering, leaving, or moving a short way: a dropdown, a tooltip, a tab indicator, an accordion.
- `--duration-slow`, 300ms: a large surface that takes over the view and needs a beat to read: a modal, a bottom sheet, a full-screen overlay.

Larger surface or longer travel, longer duration. The ceiling is 300ms, and most motion lives at 200ms.

## Five easings, five jobs

Easing is the shape of speed over time. Each curve has one job.

- `--easing-linear`, `cubic-bezier(0, 0, 1, 1)`: constant speed. Only for continuous loops: spinners, indeterminate progress. On anything that begins and ends it feels robotic.
- `--easing-out`, `cubic-bezier(0, 0, 0.2, 1)`: quick start, gentle landing. The default for anything entering or answering a tap.
- `--easing-in`, `cubic-bezier(0.4, 0, 1, 1)`: slow start, accelerating exit. For elements leaving the screen. Never for entrances, a slow start there reads as lag.
- `--easing-in-out`, `cubic-bezier(0.4, 0, 0.2, 1)`: eased on both ends. For an element moving between two on-screen positions, both visible the whole time: a reordering row, a toggle thumb, a tab indicator.
- `--easing-spring`, `cubic-bezier(0.34, 1.56, 0.64, 1)`: overshoots, then settles. Reserved for a small, discrete success: a checkmark, a like, a badge popping in. Comfort not information, so gate it behind reduced motion and keep it off large surfaces.

## Anatomy of a transition

Every transition names three things: the property, a duration token, an easing token.

```css
transition: opacity var(--duration-normal) var(--easing-out);
```

- property: what changes. Prefer `transform` and `opacity`. Name it, never `all`.
- duration: how long. 150ms local, 200ms to enter or leave, 300ms for a takeover.
- easing: the feel. Out to enter, in to leave, in-out to move, linear to loop, spring to celebrate.

Name the property, never `transition: all`, which animates things you never meant to touch. Reference the tokens instead of hardcoding milliseconds.

## Performance is part of the contract

A frame at 60fps is about 16ms. The browser can animate `transform` and `opacity` on the compositor, off the main thread, with no layout and no repaint. Animating geometry recomputes layout every frame, and that layout thrash is the usual cause of jank.

- ✓ Recommended: `transform`, `opacity`. Handled on the compositor, off the main thread. A slide is `translateY`, not a change to `top`.
- ✕ Avoid: `width`, `height`, `top`, `left`, `margin`. Each frame recomputes layout, then repaints. On a long list or weak device this drops frames.

## Reduced motion is the floor

The browser exposes the OS setting as `prefers-reduced-motion: reduce`, a firm request to hold still that every animation honors. It aligns with WCAG 2.1: 2.3.3 asks that interaction-triggered motion can be disabled, and 2.2.2 covers looping motion.

Honoring it does not mean deleting meaning. Because information rides on color, opacity, and the final state, the interface stays legible without movement: collapse the animation, keep the destination. Keep a spinner turning slowly rather than freezing it, a stopped spinner reads as a hung app.

```css
/* Default: motion is welcome. Enter fast, settle gently. */
.menu {
    transition: opacity var(--duration-normal) var(--easing-out),
                transform var(--duration-normal) var(--easing-out);
}

/* Firm request to hold still: collapse the movement, keep the meaning. */
@media (prefers-reduced-motion: reduce) {
    .menu {
        transition-duration: 1ms;       /* appears, does not fly in */
        transform: none;                /* no slide */
    }
    .spinner {
        animation-duration: 1.4s;       /* slower, not gone */
    }
}
```

## Rules of motion

- Rule: give every animation a job: orientation, continuity, or feedback. Why: decorative motion clarifies nothing and costs the same frame time.
- Rule: animate `transform` and `opacity`. Why: the compositor carries them off the main thread with no layout or paint. Animating `width`, `height`, `top`, `left`, or `margin` recomputes layout every frame.
- Rule: name the property, a duration token, and an easing token explicitly. Why: `transition: all` animates properties you never meant to touch, and hardcoded milliseconds drift from the shared tempo.
- Rule: match the duration to the change: `fast` for local state, `normal` to enter or leave, `slow` for a takeover. Why: anything past 300ms reads as sluggish.
- Rule: pick easing by job: `out` to enter, `in` to leave, `in-out` to move, `linear` to loop. Why: `linear` on anything with a start and an end feels robotic.
- Rule: reserve `spring` for a small, discrete success, and gate it behind reduced motion. Why: an overshooting modal looks broken, and spring is comfort, not information.
- Rule: honor `prefers-reduced-motion`: collapse the movement, keep the meaning. Why: motion alone must never carry meaning; information rides on color, opacity, and the final state.

## Token reference

| Token | Value | Role |
| --- | --- | --- |
| `--duration-fast` | 150ms | Local state on one control: hover, focus, toggle |
| `--duration-normal` | 200ms | Default. Enter, leave, or move a short distance |
| `--duration-slow` | 300ms | A large surface taking over the view. The ceiling |
| `--easing-linear` | cubic-bezier(0, 0, 1, 1) | Continuous loops only: spinners, indeterminate progress |
| `--easing-in` | cubic-bezier(0.4, 0, 1, 1) | Elements leaving the screen |
| `--easing-out` | cubic-bezier(0, 0, 0.2, 1) | Elements entering, and taps. The default |
| `--easing-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Moving between two visible positions |
| `--easing-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | Small discrete successes. Overshoots, then settles |

## Sources

Material 3 Motion: duration buckets and easing sets. Apple HIG Motion: purposeful, communicates status, respects Reduce Motion. web.dev and MDN: animate transform and opacity to stay on the compositor. MDN prefers-reduced-motion. W3C WCAG 2.1: 2.3.3 Animation from Interactions (AAA) and 2.2.2 Pause, Stop, Hide (A). The three durations, five easings, 300ms ceiling, and gating spring behind reduced motion are specific to this system's tokens.
