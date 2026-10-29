// Node-side server render (W1-C12.f). Bundled by build.mjs for node and imported by serve.mjs, which injects
// the markup into the hydration pages. Pure strings out; no DOM exists in this process.
import { renderToString as reactRender } from 'react-dom/server';
import { createSSRApp } from 'vue';
import { renderToString as vueRender } from 'vue/server-renderer';
import { reactEl, vueRoot } from './ssr-tree';
import type { FixtureProps } from '../fixtures';

export async function renderServer(adapter: 'react' | 'vue', props: FixtureProps): Promise<string> {
  return adapter === 'react'
    ? reactRender(reactEl(props))
    : vueRender(createSSRApp({ render: () => vueRoot(props) }));
}
