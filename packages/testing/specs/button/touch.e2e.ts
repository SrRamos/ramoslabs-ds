// Touch target, RTL and motion for SJButton (Direction B). The visual box is 24 / 32 / 36 / 44 CSS px; under
// `any-pointer: coarse` an invisible ::before extends the hit area to the 44px --target-min token (WCAG 2.5.8 AA
// floor visually, 44px effectively on touch) without moving layout. `hasTouch` makes `any-pointer: coarse` match in
// all three engines. Hit areas are measured the way a finger would hit them: `elementFromPoint` at the edges.
// Titles do not follow the parity-matrix format on purpose (not matrix rows).
import { test, expect, chromium, type Page } from '@playwright/test';
import { SIZE_PX } from './fixtures';
import { ADAPTERS } from './matrix';
import { control, mountButton, openHost } from './open';

const TARGET = 44;
const HALF = TARGET / 2;

async function mount(
  page: Page,
  adapter: (typeof ADAPTERS)[number],
  fixture: string,
  props: Record<string, unknown> = {},
) {
  const errors = await openHost(page);
  await mountButton(page, adapter, fixture, 'native', { props: props as never });
  await clearOfTheViewportEdge(page);
  return errors;
}

/** The 44px target of a control at the very top would sit off-screen, where nothing can be hit. */
const clearOfTheViewportEdge = (page: Page) =>
  page.evaluate(() => {
    document.getElementById('root')!.style.padding = '5rem';
  });

/** Which probes around the control's centre still hit the control (or a descendant). */
async function probe(page: Page) {
  return control(page).evaluate((el, half) => {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const hit = (x: number, y: number) => {
      const n = document.elementFromPoint(x, y);
      return n === el || (!!n && el.contains(n));
    };
    const inset = 1; // 1px inside the 44px target
    const out = 2; // 2px outside it
    return {
      w: r.width,
      h: r.height,
      top: hit(cx, cy - half + inset),
      bottom: hit(cx, cy + half - inset),
      start: hit(cx - half + inset, cy),
      end: hit(cx + half - inset, cy),
      beyondTop: hit(cx, cy - half - out),
      beyondBottom: hit(cx, cy + half + out),
      beyondStart: hit(cx - half - out, cy),
      beyondEnd: hit(cx + half + out, cy),
    };
  }, HALF);
}

test.describe('coarse pointer: 44px hit area', () => {
  test.use({ hasTouch: true });

  for (const adapter of ADAPTERS) {
    for (const [size, px] of Object.entries(SIZE_PX)) {
      for (const fixture of ['default', 'icon-only']) {
        test(`@pr touch | button ${adapter} | size ${size} ${fixture} | hit area reaches 44px at every edge, layout stays ${px}px`, async ({
          page,
        }) => {
          const errors = await mount(page, adapter, fixture, { size });
          expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true);
          const p = await probe(page);
          // Layout is unchanged by the extension: the box is still the visual height.
          expect(Math.round(p.h)).toBe(px);
          // Every edge of the 44px target hits the button.
          expect([p.top, p.bottom], `${size} vertical`).toEqual([true, true]);
          // A short control also reaches 44px sideways when it is narrower than that (icon-only squares).
          if (p.w < TARGET) expect([p.start, p.end], `${size} horizontal`).toEqual([true, true]);
          // And it stops at 44px: nothing beyond the target hits the button.
          if (p.h <= TARGET) expect([p.beyondTop, p.beyondBottom]).toEqual([false, false]);
          if (p.w <= TARGET) expect([p.beyondStart, p.beyondEnd]).toEqual([false, false]);
          expect(errors).toEqual([]);
        });
      }
    }

    test(`@pr touch | button ${adapter} | fine pointer baseline: the same click 10px above an xs button misses`, async ({
      browser,
    }) => {
      // A separate context WITHOUT touch: the hit area is the visual box only.
      const context = await browser.newContext({ hasTouch: false });
      const page = await context.newPage();
      await mount(page, adapter, 'default', { size: 'xs' });
      expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(false);
      const p = await probe(page);
      expect(Math.round(p.h)).toBe(SIZE_PX['xs']);
      expect([p.top, p.bottom]).toEqual([false, false]);
      await context.close();
    });

    test(`@pr touch | button ${adapter} | tapping just above an xs button activates it exactly once`, async ({
      page,
    }) => {
      await mount(page, adapter, 'default', { size: 'xs' });
      const box = (await control(page).boundingBox())!;
      // 8px above the visual top edge, inside the 44px target (xs is 24px tall, so 10px extends each side).
      await page.touchscreen.tap(box.x + box.width / 2, box.y - 8);
      await page.waitForTimeout(80);
      expect(await page.evaluate(() => window.__btn.presses.length)).toBe(1);
    });

    test(`@pr touch | button ${adapter} | link variant | no hit-area box (inline links are exempt)`, async ({
      page,
    }) => {
      await mount(page, adapter, 'default', { variant: 'link' });
      const pseudo = await control(page).evaluate((n) => getComputedStyle(n, '::before').content);
      expect(['none', 'normal']).toContain(pseudo);
      const display = await control(page).evaluate((n) => getComputedStyle(n).display);
      expect(display).toBe('inline');
    });

    test(`@pr touch | button ${adapter} | RTL | hit area is symmetric around an xs icon-only square`, async ({
      page,
    }) => {
      await openHost(page);
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      await mountButton(page, adapter, 'icon-only', 'native', { props: { size: 'xs' } });
      await clearOfTheViewportEdge(page);
      const p = await probe(page);
      expect([p.start, p.end, p.top, p.bottom]).toEqual([true, true, true, true]);
      expect([p.beyondStart, p.beyondEnd, p.beyondTop, p.beyondBottom]).toEqual([
        false,
        false,
        false,
        false,
      ]);
    });
  }
});

/**
 * A hybrid device (touch laptop, iPad with a trackpad): the primary pointer is fine, a touchscreen is also attached.
 * `pointer: coarse` misses it, `any-pointer: coarse` catches it, which is why the DS keys on any-pointer.
 * Playwright's `hasTouch` flips BOTH `pointer` and `any-pointer` to coarse in every engine, so it cannot express this;
 * Chromium can be launched with Blink's pointer settings (primaryPointerType=4 fine, availablePointerTypes=6 fine+coarse).
 * Firefox and WebKit have no equivalent switch, so the hybrid case is Chromium-only (documented limit; the any-pointer
 * query itself is the same engine-independent media feature, covered by the hasTouch tests above in all three).
 */
test.describe('hybrid device: fine primary pointer, touch also available', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'hybrid pointer emulation is Chromium-only',
  );

  for (const adapter of ADAPTERS) {
    test(`@pr touch | button ${adapter} | hybrid: pointer is fine, any-pointer is coarse, and the hit area still reaches 44px`, async () => {
      const testInfo = test.info();
      const browser = await chromium.launch({
        args: ['--blink-settings=availablePointerTypes=6,primaryPointerType=4'],
      });
      const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
      const page = await context.newPage();
      await mount(page, adapter, 'default', { size: 'xs' });
      const m = await page.evaluate(() => ({
        primaryFine: matchMedia('(pointer: fine)').matches,
        primaryCoarse: matchMedia('(pointer: coarse)').matches,
        anyCoarse: matchMedia('(any-pointer: coarse)').matches,
      }));
      expect(m).toEqual({ primaryFine: true, primaryCoarse: false, anyCoarse: true });
      const p = await probe(page);
      expect(Math.round(p.h)).toBe(SIZE_PX['xs']);
      expect([p.top, p.bottom], 'hybrid vertical hit area').toEqual([true, true]);
      await browser.close();
    });
  }
});

test.describe('RTL', () => {
  for (const adapter of ADAPTERS) {
    test(`@pr rtl | button ${adapter} | padding is logical and an icon-only square stays square`, async ({
      page,
    }) => {
      await openHost(page);
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      await mountButton(page, adapter, 'default', 'native', { props: { size: 'sm' } });
      const pad = await control(page).evaluate((n) => {
        const s = getComputedStyle(n);
        return [s.paddingLeft, s.paddingRight];
      });
      expect(pad[0]).toBe(pad[1]);
      await mountButton(page, adapter, 'icon-only', 'native', { props: { size: 'md' } });
      const r = (await control(page).boundingBox())!;
      expect(Math.round(r.width)).toBe(36);
      expect(Math.round(r.height)).toBe(36);
    });
  }
});

test.describe('reduced motion', () => {
  for (const adapter of ADAPTERS) {
    for (const reduce of [false, true]) {
      test(`@pr motion | button ${adapter} | press scale ${reduce ? 'is removed under reduced motion' : '0.97 with normal motion'}`, async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
        await mount(page, adapter, 'default');
        const box = (await control(page).boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(220);
        const m = await control(page).evaluate((n) => {
          const s = getComputedStyle(n);
          return { scale: s.scale, duration: s.transitionDuration };
        });
        await page.mouse.up();
        if (reduce) {
          expect(m.scale).toBe('none');
          expect(m.duration).toBe('0s');
        } else {
          expect(m.scale).toBe('0.97');
        }
      });
    }
  }
});
