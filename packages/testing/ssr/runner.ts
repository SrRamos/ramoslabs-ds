// SSR determinism runner (W1-114, ADR-003 "SSR-safe ids", ADR-013 PR gate).
//
// For each root: render on the "server" (DOM globals hidden), hydrate that markup on the "client",
// and render the same tree fresh on the client. Ids and the full IDREF graph must be equal in all
// three, there must be no hydration diagnostics, and across roots that share one document no id may
// be defined twice nor any reference resolve into another root.
//
// The runner knows nothing about a component: it drives any `SsrWrapper` (one per adapter). The
// W1-316 probe supplies its own wrappers; `components/` holds the minimal test-only ones.
import { crossRootIssues, diffGraphs, extractGraph, lintGraph, type GraphSnapshot } from './graph';

export interface RootSpec {
  /** Stable label used in reports. */
  readonly name: string;
  /** The `idPrefix` of this root (ADR-003: one per root, so ids never collide across roots). */
  readonly idPrefix: string;
}

export interface SsrEnv {
  /** A fresh document for wrappers that build DOM on the "server" (vanilla). */
  newDocument(): Document;
}

export interface MountHandle {
  unmount(): void;
  /** Hydration warnings, recoverable errors and console noise captured while mounting. */
  readonly diagnostics: readonly string[];
}

export interface SsrWrapper {
  readonly name: string;
  /** Server pass. Runs with `window`/`document` hidden. Returns the markup of one root. */
  renderServer(root: RootSpec, env: SsrEnv): string | Promise<string>;
  /** Client pass 1: `container` already holds the server markup. Resolves once hydration committed. */
  hydrate(container: Element, root: RootSpec): Promise<MountHandle>;
  /**
   * Client pass 2 (optional): render the same tree from scratch into an empty `container`. Omit it when
   * the framework's client-only ids are not comparable to server ids by design (React `useId` is
   * `_R_..._` on the server and hydration but `_r_<global counter>_` in a client-only root).
   */
  renderClient?(container: Element, root: RootSpec): Promise<MountHandle>;
}

export interface RootReport {
  readonly name: string;
  readonly server: GraphSnapshot;
  readonly hydrated: GraphSnapshot;
  /** Absent when the wrapper has no `renderClient`. */
  readonly client: GraphSnapshot | undefined;
}

export interface SsrReport {
  readonly adapter: string;
  readonly roots: readonly RootReport[];
  /** Empty when the run is deterministic and collision free. */
  readonly issues: readonly string[];
  readonly ok: boolean;
}

const SERVER_HIDDEN = [
  'window',
  'document',
  'navigator',
  'location',
  'HTMLElement',
  'Element',
  'Node',
];

/** Runs `fn` as a server would see the world: no DOM globals. Always restores them. */
export async function withoutDom<T>(fn: () => T | Promise<T>): Promise<T> {
  const g = globalThis as Record<string, unknown>;
  const saved: [string, PropertyDescriptor][] = [];
  for (const key of SERVER_HIDDEN) {
    const d = Object.getOwnPropertyDescriptor(g, key);
    if (!d) continue;
    saved.push([key, d]);
    try {
      delete g[key];
    } catch {
      /* non-configurable: leave it */
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, d] of saved) Object.defineProperty(g, key, d);
  }
}

function lintMarkup(html: string): string[] {
  return /<(script|style)\b/i.test(html) ? ['server markup contains script/style'] : [];
}

export async function runSsrDeterminism(
  wrapper: SsrWrapper,
  roots: readonly RootSpec[],
): Promise<SsrReport> {
  const issues: string[] = [];
  const doc = document;
  const env: SsrEnv = { newDocument: () => doc.implementation.createHTMLDocument('ssr') };
  const names = new Set<string>();
  for (const r of roots) {
    if (names.has(r.name)) throw new Error(`[ssr] duplicate root name ${r.name}`);
    names.add(r.name);
  }

  // 1. Server pass, root by root, DOM hidden.
  const markup: string[] = [];
  for (const root of roots) markup.push(await withoutDom(() => wrapper.renderServer(root, env)));

  const make = (root: RootSpec, html: string) => {
    const el = doc.createElement('div');
    el.setAttribute('data-ssr-root', root.name);
    el.innerHTML = html;
    doc.body.appendChild(el);
    return el;
  };

  // 2. Hydrate every root into one shared document.
  const containers = roots.map((r, i) => make(r, markup[i]!));
  const server = containers.map((c) => extractGraph(c));
  const handles: MountHandle[] = [];
  const hydrated: GraphSnapshot[] = [];
  try {
    for (const [i, root] of roots.entries()) {
      const h = await wrapper.hydrate(containers[i]!, root);
      handles.push(h);
      for (const d of h.diagnostics) issues.push(`${root.name}: hydration diagnostic: ${d}`);
    }
    for (const c of containers) hydrated.push(extractGraph(c));
  } finally {
    for (const h of handles) h.unmount();
  }
  const serverSets = roots.map((r, i) => ({ name: r.name, graph: server[i]! }));
  const hydratedSets = roots.map((r, i) => ({ name: r.name, graph: hydrated[i]! }));
  issues.push(...crossRootIssues(serverSets).map((m) => `server ${m}`));
  issues.push(...crossRootIssues(hydratedSets).map((m) => `hydrated ${m}`));
  for (const c of containers) c.remove();
  for (const [i, root] of roots.entries())
    issues.push(...lintMarkup(markup[i]!).map((m) => `${root.name}: ${m}`));

  // 3. Fresh client render of the same tree.
  const renderClient = wrapper.renderClient?.bind(wrapper);
  const client: GraphSnapshot[] = [];
  const fresh = renderClient ? roots.map((r) => make(r, '')) : [];
  const handles2: MountHandle[] = [];
  try {
    for (const [i, root] of (renderClient ? roots : []).entries()) {
      const h = await renderClient!(fresh[i]!, root);
      handles2.push(h);
      for (const d of h.diagnostics) issues.push(`${root.name}: client diagnostic: ${d}`);
    }
    for (const c of fresh) client.push(extractGraph(c));
  } finally {
    for (const h of handles2) h.unmount();
    for (const c of fresh) c.remove();
  }
  if (renderClient)
    issues.push(
      ...crossRootIssues(roots.map((r, i) => ({ name: r.name, graph: client[i]! }))).map(
        (m) => `client ${m}`,
      ),
    );

  // 4. Per-root equality and internal consistency.
  const report: RootReport[] = roots.map((r, i) => ({
    name: r.name,
    server: server[i]!,
    hydrated: hydrated[i]!,
    client: client[i],
  }));
  for (const r of report) {
    issues.push(...diffGraphs(`${r.name} server vs hydrated`, r.server, r.hydrated));
    if (r.client) issues.push(...diffGraphs(`${r.name} server vs client`, r.server, r.client));
    issues.push(...lintGraph(`${r.name} server`, r.server));
    if (r.server.ids.length === 0) issues.push(`${r.name}: server render produced no ids`);
    if (r.server.edges.length === 0) issues.push(`${r.name}: server render produced no IDREFs`);
  }
  return { adapter: wrapper.name, roots: report, issues, ok: issues.length === 0 };
}

/** Throws with every issue listed. For use outside assertion libraries. */
export function assertDeterministic(report: SsrReport): void {
  if (!report.ok)
    throw new Error(`[ssr] ${report.adapter} is not deterministic:\n${report.issues.join('\n')}`);
}
