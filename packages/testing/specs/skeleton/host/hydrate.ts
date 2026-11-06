// Real-browser hydration entry. The server (serve.mjs) puts prerendered markup in #root; the test
// records the pre-hydration nodes, calls `hydrate`, and checks that the SAME nodes survive, no mismatch is logged
// and the announcement (if any) is spoken exactly once AFTER hydration, never from the server markup.
// `adoptVanilla` mounts the vanilla adapter onto the server-rendered root element (vanilla has no server render:
// it adopts markup another renderer made). Built in development mode on purpose: React and Vue only report
// hydration mismatches in their development builds.
import { createElement, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createSSRApp } from 'vue';
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { mountSkeleton } from '@ramoslabs/vanilla/skeleton';
import { reactEl, recordSpoken, vanillaProps, vueRoot, type Spoken } from './ssr-tree';
import type { FixtureProps } from '../fixtures';

declare global {
  interface Window {
    __skeletonHy: {
      ready: true;
      recoverable: string[];
      spoken: Spoken[];
      hydrate(adapter: 'react' | 'vue', props: FixtureProps, opts?: { strict?: boolean }): void;
      adoptVanilla(props: FixtureProps): void;
    };
  }
}

const recoverable: string[] = [];
const spoken: Spoken[] = [];
// Recording starts before any script runs below, so a speak at hydration cannot be missed.
recordSpoken(spoken);
const client = () => createRuntime({ target: 'client' });

window.__skeletonHy = {
  ready: true,
  recoverable,
  spoken,
  hydrate(adapter, props, opts = {}) {
    const root = document.getElementById('root')!;
    if (adapter === 'react') {
      flushSync(() => {
        const el = reactEl(props, { runtime: client() });
        hydrateRoot(root, opts.strict ? createElement(StrictMode, null, el) : el, {
          onRecoverableError: (e) => void recoverable.push(String(e).split('\n')[0]!),
        });
      });
    } else {
      createSSRApp({ render: () => vueRoot(props, { runtime: client() }) }).mount(root);
    }
  },
  adoptVanilla(props) {
    const root = document.querySelector('#root > [data-part="root"]')!;
    let n = 0;
    const host = createHost(createRuntime({ target: 'client', idFactory: () => `hy-${n++}` }));
    mountSkeleton(host, root, vanillaProps(props, host));
  },
};
