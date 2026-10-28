// DOM host for the live-region registry. `document` is read only inside `create`, which the
// registry calls after `attach` (post-commit, client only), so the server render emits nothing.
import { HIDDEN_STYLE, type LiveHost, type LiveNode, type LiveRole } from '@ramoslabs/core/live';

export interface DisposableLiveHost extends LiveHost {
  /** Removes every node this host created. Idempotent. */
  dispose(): void;
}

export function createDomLiveHost(doc?: Document): DisposableLiveHost {
  const created: HTMLElement[] = [];
  let closed = false;
  return {
    create(role: LiveRole): LiveNode {
      // Lazy: inserted on the first `setText` (the first announce), never for a silent app.
      let el: HTMLElement | undefined;
      return {
        setText(text) {
          if (closed) return;
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
          el.textContent = text;
        },
      };
    },
    dispose() {
      closed = true;
      for (const el of created.splice(0)) el.remove();
    },
  };
}
