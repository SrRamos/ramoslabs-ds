// ID and IDREF graph extraction and comparison (W1-114, ADR-003 "SSR-safe ids", ADR-013 PR gate).
// Pure over a DOM subtree: no framework, no clock, no randomness.

/** Attributes whose value is a space separated list of ids. */
export const IDREF_LIST_ATTRS = [
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-flowto',
  'aria-details',
  'headers',
] as const;
/** Attributes whose value is exactly one id. */
export const IDREF_ONE_ATTRS = [
  'aria-activedescendant',
  'aria-errormessage',
  'for',
  'list',
] as const;

export interface Edge {
  /** Structural path of the referencing element inside its root, e.g. `div[0]/button[1]`. */
  readonly from: string;
  readonly attr: string;
  readonly to: string;
}

export interface GraphSnapshot {
  /** Every element id in document order. */
  readonly ids: readonly string[];
  /** Structural path of each id's element, parallel to `ids`. */
  readonly paths: readonly string[];
  /** Every IDREF token, in document order. */
  readonly edges: readonly Edge[];
  /** Ids that occur more than once inside this root. */
  readonly duplicates: readonly string[];
  /** Edges whose target id does not exist inside this root. */
  readonly dangling: readonly Edge[];
}

function pathOf(el: Element, root: Element): string {
  const parts: string[] = [];
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    const parent: Element | null = n.parentElement;
    const index = parent ? [...parent.children].indexOf(n) : 0;
    parts.unshift(`${n.localName}[${index}]`);
  }
  return parts.join('/') || '.';
}

const tokens = (v: string | null) => (v ?? '').split(/\s+/).filter(Boolean);

/** Snapshot the ids and the IDREF graph of one root. The root element itself is included. */
export function extractGraph(root: Element): GraphSnapshot {
  const all = [root, ...root.querySelectorAll('*')];
  const ids: string[] = [];
  const paths: string[] = [];
  const edges: Edge[] = [];
  for (const el of all) {
    const path = pathOf(el, root);
    const id = el.getAttribute('id');
    if (id !== null && id !== '') {
      ids.push(id);
      paths.push(path);
    }
    for (const attr of IDREF_LIST_ATTRS)
      for (const to of tokens(el.getAttribute(attr))) edges.push({ from: path, attr, to });
    for (const attr of IDREF_ONE_ATTRS) {
      const to = el.getAttribute(attr);
      if (to !== null && to !== '') edges.push({ from: path, attr, to });
    }
  }
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return {
    ids,
    paths,
    edges,
    duplicates: [...dup],
    dangling: edges.filter((e) => !seen.has(e.to)),
  };
}

const edgeKey = (e: Edge) => `${e.from} ${e.attr} -> ${e.to}`;

/** Differences between two snapshots of the same tree. Empty means ids and graph are equal. */
export function diffGraphs(label: string, a: GraphSnapshot, b: GraphSnapshot): string[] {
  const out: string[] = [];
  const n = Math.max(a.ids.length, b.ids.length);
  if (a.ids.length !== b.ids.length)
    out.push(`${label}: id count ${a.ids.length} != ${b.ids.length}`);
  for (let i = 0; i < n; i++)
    if (a.ids[i] !== b.ids[i])
      out.push(`${label}: id #${i} ${JSON.stringify(a.ids[i])} != ${JSON.stringify(b.ids[i])}`);
  const ka = a.edges.map(edgeKey);
  const kb = new Set(b.edges.map(edgeKey));
  const ka2 = new Set(ka);
  for (const k of ka) if (!kb.has(k)) out.push(`${label}: edge only in first: ${k}`);
  for (const k of kb) if (!ka2.has(k)) out.push(`${label}: edge only in second: ${k}`);
  return out;
}

/** Problems inside one snapshot: duplicate ids and dangling references. */
export function lintGraph(label: string, g: GraphSnapshot): string[] {
  return [
    ...g.duplicates.map((id) => `${label}: duplicate id ${JSON.stringify(id)}`),
    ...g.dangling.map((e) => `${label}: dangling ${edgeKey(e)}`),
  ];
}

/**
 * Collisions across roots that share one document. Browsers resolve an IDREF document-wide, so an
 * id defined in two roots, or a reference that would resolve into another root, is a defect.
 */
export function crossRootIssues(
  roots: readonly { name: string; graph: GraphSnapshot }[],
): string[] {
  const owner = new Map<string, string>();
  const out: string[] = [];
  for (const { name, graph } of roots)
    for (const id of new Set(graph.ids)) {
      const prior = owner.get(id);
      if (prior !== undefined && prior !== name)
        out.push(`collision: id ${JSON.stringify(id)} exists in roots ${prior} and ${name}`);
      else owner.set(id, name);
    }
  for (const { name, graph } of roots)
    for (const e of graph.edges) {
      const o = owner.get(e.to);
      if (o !== undefined && o !== name)
        out.push(`cross-root reference: ${name} ${edgeKey(e)} resolves into root ${o}`);
    }
  return out;
}
