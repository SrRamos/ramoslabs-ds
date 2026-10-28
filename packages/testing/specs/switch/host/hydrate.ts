// Real-browser hydration entry (W1-C03s.f). The server (serve.mjs) puts prerendered markup in #root;
// the test records the pre-hydration nodes, calls `hydrate`, and checks that the SAME nodes survive,
// no mismatch is logged, and the control then behaves. Built in development mode on purpose: React and
// Vue only report hydration mismatches in their development builds.
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { reactTree, vueApp } from '../ssr-tree';
import type { SwitchFixtureProps } from '../fixtures';

declare global {
  interface Window {
    __hy: {
      ready: true;
      recoverable: string[];
      hydrate(adapter: 'react' | 'vue', props: SwitchFixtureProps, prefix: string): void;
    };
  }
}

const recoverable: string[] = [];
window.__hy = {
  ready: true,
  recoverable,
  hydrate(adapter, props, prefix) {
    const root = document.getElementById('root')!;
    if (adapter === 'react') {
      flushSync(() => {
        hydrateRoot(root, reactTree(props, prefix, 'client'), {
          identifierPrefix: prefix,
          onRecoverableError: (e) => void recoverable.push(String(e).split('\n')[0]!),
        });
      });
    } else {
      vueApp(props, prefix, 'client', true).mount(root);
    }
  },
};
