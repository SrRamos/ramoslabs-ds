// SJSkeleton x SJState composition fixtures. A state in the `loading` variant renders its `skeleton` slot in an
// aria-hidden `skeleton` part; its own heading (or `announce`) speaks once. What fills the slot varies: plain shapes,
// a silent group (the documented usage), a group whose `announce` repeats the heading (the registry drops the
// duplicate) and a group with a different `announce` (two messages: why the docs say to omit it). No Node imports.
import type { StateCompositionProps } from '../host/ssr-tree';

export const HEADING = 'Loading projects';

export const COMPOSITIONS: Record<
  string,
  { props: StateCompositionProps; spoken: Array<{ role: 'status'; text: string }> }
> = {
  // Shapes straight in the slot: the heading speaks once, the shapes are silent.
  'shapes-in-state': {
    props: { heading: HEADING, inner: 'shapes' },
    spoken: [{ role: 'status', text: HEADING }],
  },
  // The documented usage: a group with timing and no announce of its own.
  'group-silent': {
    props: { heading: HEADING, inner: 'group-silent', delay: 60, minDuration: 5000 },
    spoken: [{ role: 'status', text: HEADING }],
  },
  // The group repeats the heading as its announce: identical text is deduplicated by the registry (within its
  // 1000 ms clear window), so the user still hears it once.
  'group-announce-same': {
    props: {
      heading: HEADING,
      inner: 'group-announce',
      groupAnnounce: HEADING,
      delay: 60,
      minDuration: 5000,
    },
    spoken: [{ role: 'status', text: HEADING }],
  },
  // A different announce is a different message: both are spoken (the reason to omit `announce` inside a state).
  'group-announce-different': {
    props: {
      heading: HEADING,
      inner: 'group-announce',
      groupAnnounce: 'Loading activity',
      delay: 60,
      minDuration: 5000,
    },
    spoken: [
      { role: 'status', text: HEADING },
      { role: 'status', text: 'Loading activity' },
    ],
  },
};
