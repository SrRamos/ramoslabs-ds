// Field height on a fine and a coarse pointer for SJInput (pattern decision 7). A text field is read, tapped and
// corrected (a button is only tapped), so it is 48px by default (control.height.field) and 56px under
// `pointer: coarse` (control.height.field-coarse); a textarea is twice that. Both clear WCAG 2.5.8 (24px minimum).
// `hasTouch` makes `pointer: coarse` match in all three engines. The invalid state doubles the border but must not
// change the height. Titles follow the touch format of the button spec (not parity-matrix rows).
import { test, expect, type Page } from '@playwright/test';
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
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
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
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
      const h = await heights(page);
      expect(h.rest).toBe(48);
      expect(h.bad, 'invalid keeps the rest height').toBe(48);
      expect(h.street).toBeGreaterThanOrEqual(96);
      await context.close();
    });
  }
});
