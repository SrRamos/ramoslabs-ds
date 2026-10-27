// Test-only component shared by the three SSR wrappers (W1-114). It is NOT a design-system component:
// it only renders labelled parts joined by IDREFs (aria-labelledby, aria-describedby, aria-controls,
// aria-activedescendant, label for) so the runner has a real graph to compare. W1-316 supplies the
// real probe later through the same `SsrWrapper` interface.
import { itemId, partId } from '@ramoslabs/core/ids';
import type { Reduction } from '@ramoslabs/core/store';

/** Keys chosen to exercise `encodeKey` (space, non-ASCII, punctuation). */
export const PROBE_KEYS = ['apple', 'b c', 'ñandú', 'x.y'] as const;

export interface ProbeState {
  readonly open: boolean;
  readonly active: string;
}
export type ProbeEvent = { type: 'toggle' } | { type: 'activate'; key: string };

export const probeInitial = (keys: readonly string[] = PROBE_KEYS): ProbeState => ({
  open: false,
  active: keys[0]!,
});

export function probeReduce(s: ProbeState, e: ProbeEvent): Reduction<ProbeState, never> {
  if (e.type === 'toggle') return { state: { ...s, open: !s.open } };
  return e.key === s.active ? { state: s } : { state: { ...s, active: e.key } };
}

/** Framework neutral element description. Boolean `true` renders as a bare attribute, `false` omits it. */
export interface Node {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string | boolean>>;
  readonly children: readonly (Node | string)[];
}

const n = (
  tag: string,
  attrs: Record<string, string | boolean>,
  ...children: (Node | string)[]
): Node => ({ tag, attrs, children });

/** The anatomy for one instance whose base id is `base`. Pure: same inputs, same tree. */
export function probeTree(base: string, s: ProbeState, keys: readonly string[] = PROBE_KEYS): Node {
  const p = (part: string) => partId(base, part);
  return n(
    'div',
    { 'data-probe': true },
    n('span', { id: p('label') }, 'Fruit'),
    n('label', { id: p('input-label'), for: p('input') }, 'Name'),
    n('input', {
      id: p('input'),
      type: 'text',
      'aria-describedby': `${p('hint')} ${p('error')}`,
    }),
    n('p', { id: p('hint') }, 'Hint'),
    n('p', { id: p('error') }, 'Error'),
    n(
      'button',
      {
        id: p('trigger'),
        type: 'button',
        'aria-expanded': String(s.open),
        'aria-controls': p('panel'),
      },
      'Toggle',
    ),
    n(
      'div',
      { id: p('panel'), role: 'region', 'aria-labelledby': p('trigger'), hidden: !s.open },
      'Panel',
    ),
    n(
      'ul',
      {
        id: p('list'),
        role: 'listbox',
        'aria-labelledby': p('label'),
        'aria-activedescendant': itemId(base, s.active),
      },
      ...keys.map((k) =>
        n(
          'li',
          {
            id: itemId(base, k),
            role: 'option',
            'aria-selected': String(k === s.active),
            'aria-describedby': p('hint'),
          },
          k,
        ),
      ),
    ),
  );
}

/** Diagnostics collected from console.error/warn while `fn` runs. */
export async function captureConsole<T>(
  fn: () => T | Promise<T>,
): Promise<{ value: T; messages: string[] }> {
  const messages: string[] = [];
  const { error, warn } = console;
  const grab =
    (kind: string) =>
    (...args: unknown[]) =>
      void messages.push(`${kind}: ${args.map(String).join(' ').split('\n')[0]}`);
  console.error = grab('error');
  console.warn = grab('warn');
  try {
    return { value: await fn(), messages };
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

/** A deliberately nondeterministic id source: a counter shared across the server and client passes. */
export function sharedCounterSource(prefix = 'n'): () => string {
  let i = 0;
  return () => `${prefix}${i++}`;
}

/** A deliberately nondeterministic id source: random every call. */
export function randomSource(): () => string {
  return () => `r${Math.random().toString(36).slice(2, 8)}`;
}
