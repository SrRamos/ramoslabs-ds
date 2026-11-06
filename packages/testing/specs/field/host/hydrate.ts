// Real-browser hydration entry (W1-C02.f). The server (serve.mjs) puts prerendered markup in #root; the test
// records the pre-hydration nodes, calls `hydrate`, and checks that the SAME nodes survive, no mismatch is
// logged, and the controls then behave. Built in development mode on purpose: React and Vue only report
// hydration mismatches in their development builds.
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { reactTree, vueApp } from './ssr-tree';
import type { Scene } from '../fixtures';

declare global {
  interface Window {
    __hyFld: {
      ready: true;
      recoverable: string[];
      hydrate(adapter: 'react' | 'vue', scene: Scene, prefix: string): void;
    };
  }
}

const recoverable: string[] = [];
window.__hyFld = {
  ready: true,
  recoverable,
  hydrate(adapter, scene, prefix) {
    const root = document.getElementById('root')!;
    if (adapter === 'react') {
      flushSync(() => {
        hydrateRoot(root, reactTree(scene, prefix, 'client'), {
          identifierPrefix: prefix,
          onRecoverableError: (e) => void recoverable.push(String(e).split('\n')[0]!),
        });
      });
    } else {
      vueApp(scene, prefix, 'client', true).mount(root);
    }
  },
};
