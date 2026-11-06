// Shared by the SJField / SJInput / SJForm Playwright specs: open the host and collect page errors (every spec
// asserts the list is empty), mount a scene on an adapter and path, and the small helpers the specs use.
import type { Locator, Page } from '@playwright/test';
import type { Adapter, Scene } from './fixtures';

/** The native control with this name inside the mounted form. */
export const control = (page: Page, name: string): Locator => page.locator(`#f [name="${name}"]`);

/** Collects page errors; every spec asserts the list is empty. */
export async function openHost(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  return errors;
}

export async function mountScene(
  page: Page,
  adapter: Adapter,
  scene: Scene,
  path = 'native',
): Promise<void> {
  await page.evaluate(
    ([a, s, p]) =>
      window.__sj.mount(a as 'react', s as never, 'none', p as string).then(() => undefined),
    [adapter, scene, path] as const,
  );
  await page.locator('#f').waitFor();
  if (scene.fields.length > 0) await page.locator('#f input, #f textarea').first().waitFor();
  await settle(page);
}

export async function updateScene(page: Page, scene: Scene): Promise<void> {
  await page.evaluate((s) => window.__sj.update(s as never), scene);
  await settle(page);
}

export const settle = (page: Page, ms = 80) =>
  page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);
