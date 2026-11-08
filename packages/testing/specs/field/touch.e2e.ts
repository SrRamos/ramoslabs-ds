// Field height on a fine and a coarse pointer for SJInput (pattern decision 7). A text field is read, tapped and
// corrected (a button is only tapped), so it is 48px by default (control.height.field) and 56px under
// `any-pointer: coarse` (control.height.field-coarse); a textarea is twice that. Both clear WCAG 2.5.8 (24px minimum).
// `hasTouch` makes `any-pointer: coarse` match in all three engines. The invalid state doubles the border but must not
// change the height. Titles follow the touch format of the button spec (not parity-matrix rows).
import { test, expect, chromium, type Page } from '@playwright/test';
import { ADAPTERS, LABEL, ERROR, type Scene } from './fixtures';
import { control, mountScene, openHost } from './open';

const SCENE: Scene = {
  form: {},
  fields: [
    { name: 'rest', kind: 'email', label: LABEL },
    { name: 'bad', kind: 'email', label: 'Backup email', error: ERROR, required: true },
    { name: 'street', kind: 'address', label: 'Street address' },
  ],
};

const heights = async (page: Page) => {
  const h = async (name: string) => Math.round((await control(page, name).boundingBox())!.height);
  return { rest: await h('rest'), bad: await h('bad'), street: await h('street') };
};

test.describe('coarse pointer: 56px field', () => {
  test.use({ hasTouch: true });

  for (const adapter of ADAPTERS) {
    test(`@pr touch | field ${adapter} | the input is 56px, the textarea 112px, the invalid state keeps the height`, async ({
      page,
    }) => {
      await openHost(page);
      await mountScene(page, adapter, SCENE);
      expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true);
      const h = await heights(page);
      expect(h.rest).toBe(56);
      expect(h.bad, 'invalid keeps the rest height').toBe(56);
      expect(h.street).toBeGreaterThanOrEqual(112);
    });
  }
});

test.describe('fine pointer: 48px field', () => {
  for (const adapter of ADAPTERS) {
    test(`@pr touch | field ${adapter} | the input is 48px, the textarea 96px, the invalid state keeps the height`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ hasTouch: false });
      const page = await context.newPage();
      await openHost(page);
      await mountScene(page, adapter, SCENE);
      expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(false);
      const h = await heights(page);
      expect(h.rest).toBe(48);
      expect(h.bad, 'invalid keeps the rest height').toBe(48);
      expect(h.street).toBeGreaterThanOrEqual(96);
      await context.close();
    });
  }
});

// Hybrid device: fine primary pointer with a touchscreen attached. `hasTouch` flips pointer AND any-pointer, so the
// hybrid case is built with Blink's pointer settings, which only Chromium has (documented limit for Firefox, WebKit).
test.describe('hybrid device: fine primary pointer, touch also available', () => {
  for (const adapter of ADAPTERS) {
    test(`@pr touch | field ${adapter} | hybrid: any-pointer is coarse, so the input is 56px although the primary pointer is fine`, async ({
      browserName,
    }) => {
      const testInfo = test.info();
      if (browserName !== 'chromium') {
        // Blink-only pointer settings: no hybrid switch exists in Firefox or WebKit (documented limit, not a skip).
        testInfo.annotations.push({
          type: 'limit',
          description: 'hybrid pointer emulation is Chromium-only',
        });
        return;
      }
      const browser = await chromium.launch({
        args: ['--blink-settings=availablePointerTypes=6,primaryPointerType=4'],
      });
      const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
      const page = await context.newPage();
      await openHost(page);
      await mountScene(page, adapter, SCENE);
      expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true);
      expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true);
      const h = await heights(page);
      expect(h.rest).toBe(56);
      expect(h.street).toBeGreaterThanOrEqual(112);
      await browser.close();
    });
  }
});
