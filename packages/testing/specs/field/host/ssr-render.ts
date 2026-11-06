// Node-side server render (W1-C02.f). Bundled by build.mjs for node and imported by serve.mjs, which
// injects the markup into the hydration pages. Pure strings out; no DOM exists in this process.
import { renderToString as reactRender } from 'react-dom/server';
import { renderToString as vueRender } from 'vue/server-renderer';
import { reactTree, vueApp } from './ssr-tree';
import type { Scene } from '../fixtures';

export async function renderServer(
  adapter: 'react' | 'vue',
  scene: Scene,
  prefix: string,
): Promise<string> {
  return adapter === 'react'
    ? reactRender(reactTree(scene, prefix, 'server'), { identifierPrefix: prefix })
    : vueRender(vueApp(scene, prefix, 'server', true));
}
