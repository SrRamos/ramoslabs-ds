// SJState conformance fixtures (W1-C11.f). Data only: the single map from contract fixture names to the props
// every adapter mounts. The six names in `state.contract.json#fixtures` are required; `EXTRA_FIXTURES` are
// conformance-only. The icon part holds a real SJIcon (composition) and the actions part a real SJButton, on
// every adapter, so the rendered DOM is the one a consumer gets. Icon data comes from the generated
// `@ramoslabs/icons` modules by relative path (the testing package does not depend on the data package).

// No Node imports: the browser bundle imports this file too.
import type { IconData } from '@ramoslabs/core/icon';
import { CircleAlert } from '../../../icons/src/generated/icons/circle-alert';
import { Folder } from '../../../icons/src/generated/icons/folder';
import { LoaderCircle } from '../../../icons/src/generated/icons/loader-circle';
import { Search } from '../../../icons/src/generated/icons/search';
import { Trash } from '../../../icons/src/generated/icons/trash';

export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export type Adapter = (typeof ADAPTERS)[number];
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

/** Paths that execute: real detection and every capability forced false at once (ADR-013 floor combination). */
export const EXECUTED_PATHS = ['native', 'fallback:all'] as const;

export type Variant = 'first-use' | 'no-results' | 'cleared' | 'loading' | 'error';

export interface FixtureProps {
  variant?: Variant;
  /** Heading copy as the `heading` prop. */
  heading?: string;
  /** Heading copy as the `title` slot (a string), instead of the prop. */
  titleSlot?: string;
  /** Heading copy as an element in the `title` slot (`<b>` around the first word). */
  titleElement?: { strong: string; rest: string };
  description?: string;
  announce?: string;
  interrupt?: boolean;
  /** An SJIcon in the icon part. `spin` sets `data-spin` on it (the loading spinner); `label` is the SJIcon's own label. */
  icon?: { data: IconData; spin?: boolean; label?: string };
  /** A real SJButton in the actions part, with this visible label. */
  action?: string;
  /** Consumer attributes passed through the ADR-004 merge on the root (`data-*` only here). */
  attrs?: Record<string, string>;
}

export const FIXTURES: Record<string, FixtureProps> = {
  // Never had data: onboarding with the first action. Static (silent).
  'first-use': {
    variant: 'first-use',
    heading: 'No projects yet',
    description: 'Create your first project to get started.',
    icon: { data: Folder },
    action: 'Create project',
  },
  // A search matched nothing: polite status with the heading; the action changes the search.
  'no-results': {
    variant: 'no-results',
    heading: 'No results for "invoice"',
    description: 'Try a different search or clear the filters.',
    icon: { data: Search },
    action: 'Clear filters',
  },
  // The user emptied it: confirm, never onboard. Static (silent).
  cleared: {
    variant: 'cleared',
    heading: 'Trash emptied',
    description: 'Everything was removed.',
    icon: { data: Trash },
  },
  // Polite status with the heading; the spinner is a static glyph under reduced motion.
  loading: {
    variant: 'loading',
    heading: 'Loading projects',
    icon: { data: LoaderCircle, spin: true },
  },
  // A failure that does not interrupt the task: polite status.
  error: {
    variant: 'error',
    heading: 'Could not load projects',
    description: 'Check your connection and try again.',
    icon: { data: CircleAlert },
    action: 'Try again',
  },
  // An interrupting error: the only case that uses role=alert.
  'error-interrupt': {
    variant: 'error',
    heading: 'Connection lost',
    description: 'Your changes were not saved.',
    interrupt: true,
    icon: { data: CircleAlert },
    action: 'Reconnect',
  },
  // Conformance-only. The heading arrives as the `title` slot (a string), the announcement parity case (#100).
  'title-slot': {
    variant: 'no-results',
    titleSlot: '3 results found',
    description: 'Showing every match.',
    icon: { data: Search },
  },
  // Conformance-only. An element in the `title` slot: announced identically on all adapters.
  'title-element': {
    variant: 'no-results',
    titleElement: { strong: '3', rest: ' results found' },
    icon: { data: Search },
  },
  // Conformance-only. Copy only: no icon, description or action (parts exist only with content).
  minimal: { variant: 'cleared', heading: 'All clear' },
  // Conformance-only. An explicit `announce` on a static kind; the heading is not what is spoken.
  'announce-static': {
    variant: 'first-use',
    heading: 'Welcome',
    announce: 'Workspace ready',
  },
};

/** Fixture names that exist only for conformance. */
export const EXTRA_FIXTURES = ['title-slot', 'title-element', 'minimal', 'announce-static'];

/** The five variants, one fixture each (the contract fixture of the same name, `error` for the plain error). */
export const VARIANT_FIXTURES = ['first-use', 'no-results', 'cleared', 'loading', 'error'] as const;

/**
 * What each fixture announces after mount: role of the live region and the text. `null` means silent. The text
 * is the heading (or the `announce` text), never the description.
 */
export const EXPECTED_ANNOUNCEMENT: Record<
  string,
  { role: 'status' | 'alert'; text: string } | null
> = {
  'first-use': null,
  'no-results': { role: 'status', text: 'No results for "invoice"' },
  cleared: null,
  loading: { role: 'status', text: 'Loading projects' },
  error: { role: 'status', text: 'Could not load projects' },
  'error-interrupt': { role: 'alert', text: 'Connection lost' },
  'title-slot': { role: 'status', text: '3 results found' },
  'title-element': { role: 'status', text: '3 results found' },
  minimal: null,
  'announce-static': { role: 'status', text: 'Workspace ready' },
};

/** Element per part (the contract anatomy). */
export const PART_ELEMENT = {
  root: 'div',
  icon: 'span',
  title: 'p',
  description: 'p',
  skeleton: 'div',
  actions: 'div',
} as const;

/** The visible heading text of a fixture. */
export const headingOf = (p: FixtureProps): string | undefined =>
  p.heading ??
  p.titleSlot ??
  (p.titleElement ? `${p.titleElement.strong}${p.titleElement.rest}` : undefined);
