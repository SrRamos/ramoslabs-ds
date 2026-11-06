// Real-browser hydration entry (W1-C06.f). The server (serve.mjs) puts prerendered markup in #root; the test
// toggles the `<details>` natively BEFORE this script runs `hydrate` (a `<details>` works without script),
// then checks what the adapter reported and the final state. `adopt` is the vanilla path: it mounts onto
// the markup that already exists. Built in development mode on purpose: React and Vue only report hydration
// mismatches in their development builds.
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createRuntime } from '@ramoslabs/core/runtime';
import { createHost } from '@ramoslabs/vanilla/runtime';
import { mountDisclosure } from '@ramoslabs/vanilla/disclosure';
import { reactTree, vueApp } from './ssr-tree';
import type { DisclosureFixtureProps } from '../fixtures';

declare global {
  interface Window {
    __hyDc: {
      ready: true;
      recoverable: string[];
      /** What the adapter reported through `openChange`, in order. */
      events: string[];
      hydrate(
        adapter: 'react' | 'vue' | 'vanilla',
        props: DisclosureFixtureProps,
        prefix: string,
      ): void;
    };
  }
}

const recoverable: string[] = [];
const events: string[] = [];
const report = (open: boolean): void => void events.push(`open:${open}`);
window.__hyDc = {
  ready: true,
  recoverable,
  events,
  hydrate(adapter, props, prefix) {
    const root = document.getElementById('root')!;
    if (adapter === 'react') {
      flushSync(() => {
        hydrateRoot(root, reactTree(props, prefix, 'client', report), {
          identifierPrefix: prefix,
          onRecoverableError: (e) => void recoverable.push(String(e).split('\n')[0]!),
        });
      });
    } else if (adapter === 'vue') {
      vueApp(props, prefix, 'client', true, report).mount(root);
    } else {
      let n = 0;
      const host = createHost(
        createRuntime({ target: 'client', idFactory: () => `${prefix}${n++}` }),
      );
      mountDisclosure(host, root.querySelector('details')!, { ...props, onOpenChange: report });
    }
  },
};
