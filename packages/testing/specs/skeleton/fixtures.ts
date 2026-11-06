// SJSkeleton conformance fixtures. Data only: the single map from contract fixture names to the props every
// adapter mounts. The six names in `skeleton.contract.json#fixtures` are required; `EXTRA_FIXTURES` are
// conformance-only. A group renders a real layout on every adapter: a card made of SJSkeleton shapes (an avatar
// circle and a three-line text) while loading, and a card of plain content with the SAME box once loaded, so the
// swap can be measured for layout shift (see `host/ssr-tree.ts`).

// No Node imports: the browser bundle imports this file too.
export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export type Adapter = (typeof ADAPTERS)[number];
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

/** Paths that execute: real detection and every capability forced false at once (ADR-013 floor combination). */
export const EXECUTED_PATHS = ['native', 'fallback:all'] as const;

export type Shape = 'group' | 'text' | 'circle' | 'rect' | 'block';

export interface FixtureProps {
  shape?: Shape | (string & {});
  lines?: number;
  ratio?: string;
  size?: string;
  animation?: 'shimmer' | 'none';
  loading?: boolean;
  delay?: number;
  minDuration?: number;
  announce?: string;
  /** Consumer attributes passed through the ADR-004 merge on the root (`data-*` only here). */
  attrs?: Record<string, string>;
}

export const FIXTURES: Record<string, FixtureProps> = {
  // A text placeholder: three lines, the last one shorter.
  text: { shape: 'text', lines: 3 },
  // An avatar placeholder (md = the control size token).
  circle: { shape: 'circle', size: 'md' },
  // A media placeholder with a reserved 16/9 box.
  rect: { shape: 'rect', ratio: '16/9' },
  // A free box (default height from the token).
  block: { shape: 'block' },
  // The container while loading. `delay: 400` keeps the pending window wide enough to observe on a loaded
  // runner; the token default (300 ms) is exercised by its own spec.
  'group-loading': { shape: 'group', loading: true, announce: 'Loading activity', delay: 400 },
  // The container once loaded: the content shows at once, nothing is busy, nothing is announced.
  'group-loaded': { shape: 'group', loading: false, announce: 'Loading activity' },
  // Conformance-only.
  'text-single': { shape: 'text', lines: 1 },
  'text-clamped': { shape: 'text', lines: 99 },
  'circle-xl': { shape: 'circle', size: 'xl' },
  'rect-square': { shape: 'rect', ratio: '1/1' },
  'block-static': { shape: 'block', animation: 'none' },
  'unknown-shape': { shape: 'hexagon' },
};

/** Fixture names that exist only for conformance. */
export const EXTRA_FIXTURES = [
  'text-single',
  'text-clamped',
  'circle-xl',
  'rect-square',
  'block-static',
  'unknown-shape',
];

/** The drawn shapes (every fixture that is not a group). */
export const SHAPE_FIXTURES = Object.keys(FIXTURES).filter((f) => FIXTURES[f]!.shape !== 'group');

/** Element per part (the contract anatomy). */
export const PART_ELEMENT = { root: 'div', line: 'div' } as const;

/** Expected effective shape (an unknown value falls back to block). */
export const shapeOf = (p: FixtureProps): Shape =>
  (['group', 'text', 'circle', 'rect'] as const).find((s) => s === p.shape) ?? 'block';

/** The announcement a fixture produces once the group is visible: null means silent. */
export const EXPECTED_ANNOUNCEMENT: Record<string, { role: 'status'; text: string } | null> = {
  text: null,
  circle: null,
  rect: null,
  block: null,
  'group-loading': { role: 'status', text: 'Loading activity' },
  // Loaded before it was ever shown: nothing to announce.
  'group-loaded': null,
  'text-single': null,
  'text-clamped': null,
  'circle-xl': null,
  'rect-square': null,
  'block-static': null,
  'unknown-shape': null,
};

/** Text of the loaded layout (the three lines of the content card). */
export const LOADED_LINES = ['Ramos Labs', 'Design system', 'Updated today'] as const;
/** What follows the component in the host page: used to detect layout shift. */
export const FOLLOWER_TEXT = 'Content after the skeleton';
