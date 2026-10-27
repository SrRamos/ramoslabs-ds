// Live-region registry (ADR-006 "Live regions"). Persistent `status` node per runtime document,
// `alert` only on explicit request, client-only (nothing exists until `attach`), deduplicated,
// and never a second announcement of an active-descendant move. The host (adapter) owns the DOM.
import type { Scheduler } from '../runtime';

/**
 * Visually hidden yet exposed to assistive tech. Inline because adapters never import CSS
 * (ADR-002) and a live region must not depend on a stylesheet being present. One value for all
 * three hosts (G1 MUST-3).
 */
export const HIDDEN_STYLE =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0';

export type LiveRole = 'status' | 'alert';
export interface LiveNode {
  setText(text: string): void;
}
export interface LiveHost {
  /** Creates (once) a persistent visually-hidden node with the given role. */
  create(role: LiveRole): LiveNode;
}
export interface AnnounceOptions {
  /** Explicit opt-in to `role="alert"`; the default is polite `status`. */
  readonly urgent?: boolean;
  /** The message describes an active-descendant move; focus already conveys it, so it is dropped. */
  readonly activeDescendant?: boolean;
}
export interface LiveRegistry {
  /** Client only. Before this (server) every announce is a no-op and no markup exists. */
  attach(host: LiveHost): void;
  /** Returns true when the text was handed to a region. */
  announce(text: string, options?: AnnounceOptions): boolean;
  /** Records the text SRs get from an active-descendant move; an identical announce is dropped. */
  noteActive(text: string): void;
  detach(): void;
}

const CLEAR_MS = 1000;

export function createLiveRegistry(scheduler: Scheduler): LiveRegistry {
  let host: LiveHost | undefined;
  const nodes: Partial<Record<LiveRole, LiveNode>> = {};
  const last: Partial<Record<LiveRole, string>> = {};
  const cancel: Partial<Record<LiveRole, () => void>> = {};
  let active = '';
  return {
    attach(h) {
      host = h;
      nodes.status ??= h.create('status');
    },
    noteActive: (text) => void (active = text.trim()),
    announce(text, o = {}) {
      const t = text.trim();
      if (!host || !t || o.activeDescendant || t === active) return false;
      const role: LiveRole = o.urgent ? 'alert' : 'status';
      if (last[role] === t) return false;
      const node = (nodes[role] ??= host.create(role));
      last[role] = t;
      cancel[role]?.();
      node.setText('');
      scheduler.soon(() => {
        if (last[role] !== t) return;
        node.setText(t);
        cancel[role] = scheduler.after(() => {
          last[role] = undefined;
          node.setText('');
        }, CLEAR_MS);
      });
      return true;
    },
    detach() {
      for (const r of ['status', 'alert'] as const) cancel[r]?.();
      host = undefined;
      nodes.status = nodes.alert = last.status = last.alert = undefined;
    },
  };
}
