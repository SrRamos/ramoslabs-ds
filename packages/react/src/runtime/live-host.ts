// DOM host for the live-region registry. `document` is read only inside `create`, which the
// registry calls after `attach` (post-commit, client only), so the server render emits nothing.
import { HIDDEN_STYLE, type LiveHost, type LiveNode, type LiveRole } from '@ramoslabs/core/live';

export interface DisposableLiveHost extends LiveHost {
  /** Inserts every region now and every later one on creation (eager mode). Idempotent. */
  ensure(): void;
  /** Removes every node this host created. Idempotent. */
  dispose(): void;
}

export function createDomLiveHost(doc?: Document): DisposableLiveHost {
  const created: HTMLElement[] = [];
  let closed = false;
  let eager = false;
  const pending: (() => unknown)[] = [];
  return {
    create(role: LiveRole): LiveNode {
      // Lazy by default: inserted on the first `setText`, never for a silent app. A component whose
      // contract declares `liveRegions` calls `ensure()` at mount, which inserts it before any text.
      let el: HTMLElement | undefined;
      const materialize = (): HTMLElement | undefined => {
        if (closed) return undefined;
        if (!el) {
          const d = doc ?? document;
          el = d.createElement('div');
          el.setAttribute('role', role);
          el.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
          el.setAttribute('aria-atomic', 'true');
          el.setAttribute('data-sj-live', role);
          el.setAttribute('style', HIDDEN_STYLE);
          d.body.appendChild(el);
          created.push(el);
        }
        return el;
      };
      pending.push(materialize);
      if (eager) materialize();
      return {
        setText(text) {
          const n = materialize();
          if (n) n.textContent = text;
        },
      };
    },
    ensure() {
      eager = true;
      for (const m of pending) m();
    },
    dispose() {
      closed = true;
      for (const el of created.splice(0)) el.remove();
    },
  };
}
