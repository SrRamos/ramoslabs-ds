// Node-side server render (W1-C03s.f). Bundled by build.mjs for node and imported by serve.mjs, which
// injects the markup into the hydration pages. Pure strings out; no DOM exists in this process.
import { renderToString as reactRender } from 'react-dom/server';
import { renderToString as vueRender } from 'vue/server-renderer';
import { reactTree, vueApp } from './ssr-tree';
import type { SwitchFixtureProps } from './fixtures';

export async function renderServer(
  adapter: 'react' | 'vue',
  props: SwitchFixtureProps,
  prefix: string,
): Promise<string> {
  return adapter === 'react'
    ? reactRender(reactTree(props, prefix, 'server'), { identifierPrefix: prefix })
    : vueRender(vueApp(props, prefix, 'server', true));
}
