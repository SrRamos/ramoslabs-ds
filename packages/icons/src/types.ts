/** One SVG child node of an icon: `[tag, attributes]`, Lucide's structured form. */
export type IconNode = readonly [tag: string, attrs: Readonly<Record<string, string>>];

/**
 * Icon data. Structurally compatible with the `IconData` the core `icon` module accepts; the two
 * packages never import each other (ADR-016), a type test asserts the shapes line up.
 */
export interface IconData {
  /** Kebab-case canonical name, for example `chevron-right`. */
  readonly name: string;
  /** SVG children for a 24x24 viewBox, stroke-based. */
  readonly nodes: readonly IconNode[];
  /** True when the glyph means forward/back and flips in right-to-left layouts. */
  readonly mirror?: true;
}
