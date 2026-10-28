// Default live-region host: persistent visually hidden nodes in the document. Only ever called
// after mount (the provider's onMounted), so no `document` read happens on the server.
import { HIDDEN_STYLE, type LiveHost, type LiveRole } from '@ramoslabs/core/live';

export interface DomLiveHost extends LiveHost {
  /** Inserts every region now and every later one on creation (eager mode). Idempotent. */
  ensure(): void;
  /** Removes every node this host created (provider unmount). */
  dispose(): void;
}

export function createDomLiveHost(doc: Document = document): DomLiveHost {
  const made: HTMLElement[] = [];
  let closed = false;
  let eager = false;
  const pending: (() => unknown)[] = [];
  return {
    create(role: LiveRole) {
      // Lazy by default: inserted on the first `setText`, never for a silent app. A component whose
      // contract declares `liveRegions` calls `ensure()` at mount, which inserts it before any text.
      let el: HTMLElement | undefined;
      const materialize = (): HTMLElement | undefined => {
        if (closed) return undefined;
        if (!el) {
          el = doc.createElement('div');
          el.setAttribute('role', role);
          el.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
          el.setAttribute('aria-atomic', 'true');
          el.setAttribute('data-sj-live', role);
          el.setAttribute('style', HIDDEN_STYLE);
          doc.body.appendChild(el);
          made.push(el);
        }
        return el;
      };
      pending.push(materialize);
      if (eager) materialize();
      return {
        setText(text: string) {
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
      for (const el of made.splice(0)) el.remove();
    },
  };
}
