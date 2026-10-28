// Shared by the SJButton Playwright specs: open the host, mount a fixture, move keyboard focus.
import type { Page } from '@playwright/test';
import type { AdapterName, MountOptions } from './host/entry';

export type { AdapterName };

/** Collects page errors; every spec asserts the list is empty. */
export async function openHost(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__btn?.ready === true);
  return errors;
}

export async function mountButton(
  page: Page,
  adapter: AdapterName,
  fixture: string,
  path = 'native',
  opts: MountOptions = {},
): Promise<void> {
  await page.evaluate(
    ([a, f, p, o]) => window.__btn.mount(a as AdapterName, f as string, p as string, o as never),
    [adapter, fixture, path, opts] as const,
  );
  await page.locator('#box > :is(button, a)').waitFor();
}

/** The mounted control (`<button>` or `<a>`). */
export const control = (page: Page) => page.locator('#box > :is(button, a)');

/**
 * Moves keyboard focus to the control with keyboard modality, so :focus-visible applies. WebKit on macOS
 * skips buttons on Tab by default (a Safari setting), so there one Tab establishes keyboard modality and
 * the control is then focused programmatically; engines keep :focus-visible after a keyboard interaction.
 */
export async function focusByKeyboard(page: Page): Promise<boolean> {
  const el = control(page);
  await page.keyboard.press('Tab');
  const reached = () => el.evaluate((n) => n === document.activeElement);
  if (await reached()) return true;
  await el.focus();
  return reached();
}

/** Real pointer input at the centre of the control (a disabled control swallows it, as a user's would). */
export async function clickCentre(page: Page): Promise<void> {
  const box = await control(page).boundingBox();
  if (!box) throw new Error('control has no box');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export const settle = (page: Page, ms = 80) => page.waitForTimeout(ms);
