// Node-side server render (W1-C06.f). Bundled by build.mjs for node and imported by serve.mjs, which
// injects the markup into the hydration pages. Pure strings out; no DOM exists in this process. The vanilla
// adapter has no server render (ADR-002); its adoption pages reuse the React markup, which carries the same
// parts and classes the vanilla adapter would build.
import { renderToString as reactRender } from 'react-dom/server';
import { renderToString as vueRender } from 'vue/server-renderer';
import { reactTree, vueApp } from './ssr-tree';
import type { DisclosureFixtureProps } from '../fixtures';

export async function renderServer(
  adapter: 'react' | 'vue' | 'vanilla',
  props: DisclosureFixtureProps,
  prefix: string,
): Promise<string> {
  return adapter === 'vue'
    ? vueRender(vueApp(props, prefix, 'server', true))
    : reactRender(reactTree(props, prefix, 'server'), { identifierPrefix: prefix });
}
