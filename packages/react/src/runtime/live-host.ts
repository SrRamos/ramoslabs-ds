// DOM host for the live-region registry. `document` is read only inside `create`, which the
// registry calls after `attach` (post-commit, client only), so the server render emits nothing.
import type { LiveHost, LiveNode, LiveRole } from '@ramoslabs/core/live';

const HIDDEN =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';

export interface DisposableLiveHost extends LiveHost {
  /** Removes every node this host created. Idempotent. */
  dispose(): void;
}

export function createDomLiveHost(doc?: Document): DisposableLiveHost {
  const created: HTMLElement[] = [];
  return {
    create(role: LiveRole): LiveNode {
      const d = doc ?? document;
      const el = d.createElement('div');
      el.setAttribute('role', role);
      el.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('data-sj-live', role);
      el.setAttribute('style', HIDDEN);
      d.body.appendChild(el);
      created.push(el);
      return {
        setText(text) {
          el.textContent = text;
        },
      };
    },
    dispose() {
      for (const el of created.splice(0)) el.remove();
    },
  };
}
