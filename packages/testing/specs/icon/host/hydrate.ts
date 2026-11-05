// Real-browser hydration entry (W1-C12.f). The server (serve.mjs) puts prerendered markup in #root; the test
// records the pre-hydration nodes, calls `hydrate`, and checks that the SAME nodes survive and no mismatch is
// logged. The icon has no events, so there is no press to count. Built in development mode on purpose: React
// and Vue only report hydration mismatches in their development builds.
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createSSRApp } from 'vue';
import { reactEl, vueRoot } from './ssr-tree';
import type { FixtureProps } from '../fixtures';

declare global {
  interface Window {
    __iconHy: {
      ready: true;
      recoverable: string[];
      hydrate(adapter: 'react' | 'vue', props: FixtureProps): void;
    };
  }
}

const recoverable: string[] = [];
window.__iconHy = {
  ready: true,
  recoverable,
  hydrate(adapter, props) {
    const root = document.getElementById('root')!;
    if (adapter === 'react') {
      flushSync(() => {
        hydrateRoot(root, reactEl(props), {
          onRecoverableError: (e) => void recoverable.push(String(e).split('\n')[0]!),
        });
      });
    } else {
      createSSRApp({ render: () => vueRoot(props) }).mount(root);
    }
  },
};
