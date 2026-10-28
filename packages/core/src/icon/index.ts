// SJIcon core (W1-C12.a, ADR-016). Pure getters over an icon *data* prop; this module never imports
// `@ramoslabs/icons` (consumers pass IconData, ADR-016 boundary).
//   getRootProps(consumer?)  attributes for the `root` part (`<svg>`), built on `mergeProps` (ADR-004)
//   getNodes()               sanitized child nodes (tag and attribute allowlist); render by element
//                            creation, never `innerHTML` (ADR-002 text-safety)
import { mergeProps } from '../merge/index';
import type { Props } from '../merge/index';

declare const console: { warn(message: string): void };
declare const process: { env: { NODE_ENV?: string } } | undefined;

export type IconSize = 'sm' | 'md' | 'lg' | 'fit';

/** One SVG child as Lucide ships it: `[tag, attributes]`. */
export type IconNode = readonly [tag: string, attrs: Readonly<Record<string, string | number>>];

export interface IconData {
  readonly name?: string;
  readonly nodes: readonly IconNode[];
  /** Directional glyph: flipped horizontally when the resolved direction is `rtl`. */
  readonly mirror?: boolean;
}

export interface IconProps {
  readonly icon?: IconData;
  readonly size?: IconSize;
  /** Non-empty: `role="img"` + `aria-label`. Empty or whitespace: decorative (and a dev warning). */
  readonly label?: string;
  /** Resolved direction. Adapters read the runtime only for a mirrored icon without this prop. */
  readonly dir?: 'ltr' | 'rtl';
}

export interface Icon {
  readonly getRootProps: (consumer?: Props) => Props;
  readonly getNodes: () => readonly IconNode[];
}

/** The only SVG tags and (geometry) attributes a node may carry. */
const iconTags = /^(path|circle|ellipse|rect|line|poly(line|gon))$/;
const iconAttrs = /^(d|cx|cy|r[xy]?|[xy][12]?|width|height|points)$/;

export function createIcon(getProps: () => IconProps): Icon {
  // Dev-only warning; the guard is inline (K2 convention) and folds away under a NODE_ENV define.
  const w = (bad: unknown, m: string) =>
    bad &&
    (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production') &&
    console.warn(`[ramoslabs] SJIcon ${m}`);

  return {
    getRootProps(consumer = {}) {
      const p = getProps();
      const label = `${p.label ?? ''}`.trim();
      w(p.label != null && !label, 'empty label');
      w(
        Object.keys(consumer).some((k) => /^on[A-Z]/.test(k)),
        'on*: use SJButton',
      );
      // Every key here is protected, so a spread cannot override it. `tabindex` is set to undefined,
      // which deletes the consumer value with a dev warning (ADR-004, ADR-016). `class` merges.
      const own: Props = {
        'data-part': 'root',
        'data-size': /^(sm|lg|fit)$/.test(p.size as string) ? p.size : 'md',
        'data-mirror': p.icon?.mirror && p.dir === 'rtl' ? 'true' : undefined,
        viewBox: '0 0 24 24',
        width: '1em',
        height: '1em',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        tabindex: undefined,
        tabIndex: undefined,
        role: label ? 'img' : undefined,
        'aria-label': label || undefined,
        'aria-hidden': label ? undefined : 'true',
      };
      return mergeProps(consumer, { class: 'sj-icon', ...own }, { protect: Object.keys(own) });
    },
    getNodes() {
      const nodes = getProps().icon?.nodes;
      const out: IconNode[] = [];
      let dropped = 0;
      w(!nodes, 'no icon');
      for (const node of Array.from((nodes ?? []) as ArrayLike<unknown>)) {
        const tag = `${(node as readonly unknown[] | null)?.[0]}`;
        const attrs: Record<string, string | number> = {};
        const raw = (node as readonly [string, Record<string, unknown> | null] | null)?.[1] ?? {};
        for (const [k, v] of Object.entries(raw))
          if (iconAttrs.test(k) && 'string number'.includes(typeof v))
            attrs[k] = v as string | number;
          else dropped++;
        if (iconTags.test(tag)) out.push([tag, attrs]);
        else dropped++;
      }
      w(dropped, `dropped ${dropped}`);
      return out;
    },
  };
}
