// SJIcon conformance fixtures (W1-C12.f). Data only: the single map from contract fixture names to the props
// every adapter mounts. Icon data comes from the generated `@ramoslabs/icons` modules by relative path (the
// testing package does not depend on the data package, and the adapters never import it: ADR-016 boundary).
// The five names in `icon.contract.json#fixtures` are required; `EXTRA_FIXTURES` are conformance-only.

// No Node imports: the browser bundle imports this file too.
import type { IconData } from '@ramoslabs/core/icon';
import { ChevronRight } from '../../../icons/src/generated/icons/chevron-right';
import { Search } from '../../../icons/src/generated/icons/search';

export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export type Adapter = (typeof ADAPTERS)[number];
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

/** Paths that execute: real detection and every capability forced false at once (ADR-013 floor combination). */
export const EXECUTED_PATHS = ['native', 'fallback:all'] as const;

export interface FixtureProps {
  icon: IconData;
  size?: 'sm' | 'md' | 'lg' | 'fit';
  label?: string;
  dir?: 'ltr' | 'rtl';
  /** Consumer attributes passed through the ADR-004 merge (`data-*` only here). */
  attrs?: Record<string, string>;
  /** Direction supplied by the runtime provider (the `dir` prop stays unset). */
  runtimeDir?: 'ltr' | 'rtl';
}

/**
 * Hostile icon data: a script node, a foreignObject, an inline handler, a style and an id. The core allowlist
 * keeps the two `path` nodes with their `d` only; nothing else may reach the DOM.
 */
export const HOSTILE: IconData = {
  name: 'hostile',
  nodes: [
    ['path', { d: 'M4 12h16', onload: 'window.__pwned = 1' }],
    ['script', {}],
    ['foreignObject', { width: 24, height: 24 }],
    ['path', { d: 'M12 4v16', style: 'stroke:red', id: 'injected', 'data-x': '1' }],
  ],
};

export const FIXTURES: Record<string, FixtureProps> = {
  default: { icon: Search },
  // The size scenarios loop over sm | md | lg | fit through MountOptions.props; the fixture itself is lg.
  sizes: { icon: Search, size: 'lg' },
  labelled: { icon: Search, label: 'Search' },
  'rtl-mirror': { icon: ChevronRight, dir: 'rtl' },
  'unknown-node': { icon: HOSTILE },
  // Conformance-only: the direction arrives from the runtime (SJProvider / vanilla host), not from a prop.
  'rtl-runtime': { icon: ChevronRight, runtimeDir: 'rtl' },
};

/** Fixture names that exist only for conformance. */
export const EXTRA_FIXTURES = ['rtl-runtime'];

/** The visible words next to the icon, so the ARIA snapshot shows what a decorative icon leaves out. */
export const CONTEXT_TEXT = 'Inline text';

export const SIZES = ['sm', 'md', 'lg', 'fit'] as const;
