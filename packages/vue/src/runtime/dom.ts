// Default live-region host: persistent visually hidden nodes in the document. Only ever called
// after mount (the provider's onMounted), so no `document` read happens on the server.
import type { LiveHost, LiveRole } from '@ramoslabs/core/live';

export interface DomLiveHost extends LiveHost {
  /** Removes every node this host created (provider unmount). */
  dispose(): void;
}

export function createDomLiveHost(doc: Document = document): DomLiveHost {
  const made: HTMLElement[] = [];
  return {
    create(role: LiveRole) {
      const el = doc.createElement('div');
      el.setAttribute('role', role);
      el.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('data-sj-live', role);
      // Visually hidden yet exposed to assistive tech. Inline because adapters never import CSS
      // (ADR-002) and a live region must not depend on a stylesheet being present.
      el.style.cssText =
        'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
      doc.body.appendChild(el);
      made.push(el);
      return { setText: (text: string) => void (el.textContent = text) };
    },
    dispose() {
      for (const el of made.splice(0)) el.remove();
    },
  };
}
