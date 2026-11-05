// L2 + L6 for SJIcon (W1-C12.f): one `render` scenario per fixture on 3 engines x 3 adapters x (real detection +
// all `supports` keys forced false). SJIcon has no actions (ADR-010 G-ICON), so nothing is pressed: each scenario
// mounts the fixture and asserts what the contract promises (markup, role, size, mirror, safety). Title (parsed by
// the parity matrix, W1-313): <component> | <adapter> | <scenario> | <action> | path=<path>
import { test, expect, type Page } from '@playwright/test';
import { injectionProblems } from '../../e2e/supports/injection';
import { isNoop, parsePath, type SupportsMap } from '../../e2e/supports/paths';
import { loadTokens } from '../../contrast/index.js';
import { FIXTURES, SIZES } from './fixtures';
import {
  ADAPTERS,
  COMPONENT,
  EXECUTED_PATHS,
  iconScenarios,
  matrixTitle,
  type Scenario,
} from './matrix';
import { glyph, mountIcon, openHost, settle } from './open';

const SVG_NS = 'http://www.w3.org/2000/svg';
const tokens = loadTokens();
/** A token like `0.875rem` in CSS px at the default 16 px root. */
const px = (name: string) => parseFloat(tokens[`icon-size-${name}`]!) * 16;
const EXPECT_PX: Record<string, number> = { sm: px('sm'), md: px('md'), lg: px('lg') };
const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;

const box = (page: Page) =>
  glyph(page).evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });

/** Facts read from the DOM; identical on every adapter. */
const facts = (page: Page) =>
  glyph(page).evaluate((n) => {
    const s = getComputedStyle(n);
    return {
      ns: n.namespaceURI,
      name: n.localName,
      cls: n.getAttribute('class'),
      part: n.getAttribute('data-part'),
      size: n.getAttribute('data-size'),
      mirror: n.getAttribute('data-mirror'),
      viewBox: n.getAttribute('viewBox'),
      width: n.getAttribute('width'),
      height: n.getAttribute('height'),
      fill: n.getAttribute('fill'),
      stroke: n.getAttribute('stroke'),
      linecap: n.getAttribute('stroke-linecap'),
      linejoin: n.getAttribute('stroke-linejoin'),
      role: n.getAttribute('role'),
      label: n.getAttribute('aria-label'),
      hidden: n.getAttribute('aria-hidden'),
      tabindex: n.getAttribute('tabindex'),
      idAttr: n.getAttribute('id'),
      idsInside: n.querySelectorAll('[id]').length,
      kids: [...n.children].map((c) => ({
        tag: c.localName,
        ns: c.namespaceURI,
        attrs: c.getAttributeNames().sort(),
      })),
      strokeWidth: parseFloat(s.strokeWidth),
      transform: s.transform,
      html: n.outerHTML,
    };
  });

async function checkScenario(page: Page, s: Scenario) {
  const f = await facts(page);
  const fx = FIXTURES[s.fixture]!;
  expect(f.ns).toBe(SVG_NS);
  expect(f.name).toBe('svg');
  // Root class is `sj-icon` (not `__root`): adapters, fixtures and the CSS selector depend on it (C12 .b).
  expect(f.cls?.split(' ')).toContain('sj-icon');
  expect(f.part).toBe('root');
  expect(f.viewBox).toBe('0 0 24 24');
  expect(f.width).toBe('1em');
  expect(f.height).toBe('1em');
  expect([f.fill, f.stroke, f.linecap, f.linejoin]).toEqual([
    'none',
    'currentColor',
    'round',
    'round',
  ]);
  expect(f.strokeWidth).toBe(2);
  // Stateless, no ids anywhere (SSR equality across idPrefix depends on it) and never focusable.
  expect(f.idAttr).toBeNull();
  expect(f.idsInside).toBe(0);
  expect(f.tabindex).toBeNull();
  for (const k of f.kids) expect(k.ns).toBe(SVG_NS);

  if (fx.label) {
    expect([f.role, f.label, f.hidden]).toEqual(['img', fx.label, null]);
  } else {
    expect([f.role, f.label, f.hidden]).toEqual([null, null, 'true']);
  }

  // One child per allowed node; the hostile fixture keeps its two `path` nodes with `d` only.
  if (s.fixture === 'unknown-node') {
    expect(f.kids).toEqual([
      { tag: 'path', ns: SVG_NS, attrs: ['d'] },
      { tag: 'path', ns: SVG_NS, attrs: ['d'] },
    ]);
    expect(f.html).not.toMatch(/onload|script|foreignObject|style=|injected|data-x/i);
    expect(await page.evaluate(() => (window as { __pwned?: number }).__pwned)).toBeUndefined();
  } else {
    expect(f.kids.length).toBe(fx.icon.nodes.length);
    expect(f.kids.map((k) => k.tag)).toEqual(fx.icon.nodes.map((n) => n[0]));
  }

  const mirrored = fx.icon.mirror === true && (fx.dir ?? fx.runtimeDir) === 'rtl';
  expect(f.mirror).toBe(mirrored ? 'true' : null);
  expect(f.transform).toBe(mirrored ? 'matrix(-1, 0, 0, 1, 0, 0)' : 'none');

  const expectedSize = fx.size ?? 'md';
  expect(f.size).toBe(expectedSize);
  const b = await box(page);
  expect(near(b.w, EXPECT_PX[expectedSize]!), `${b.w}x${b.h}`).toBe(true);
  expect(near(b.h, EXPECT_PX[expectedSize]!), `${b.w}x${b.h}`).toBe(true);

  // An icon is never a tab stop: Tab leaves focus on the body (nothing else is focusable here).
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
}

for (const path of EXECUTED_PATHS) {
  for (const adapter of ADAPTERS) {
    test.describe(`${COMPONENT} | ${adapter} | path=${path}`, () => {
      for (const s of iconScenarios()) {
        test(matrixTitle(adapter, s, path), async ({ page }) => {
          const errors = await openHost(page);
          const real = await page.evaluate(() => ({ ...window.__icon.real }) as SupportsMap);
          const p = parsePath(path);
          if (isNoop(real, p))
            test.info().annotations.push({
              type: 'noop',
              description: `engine already lacks ${p.forced.join(', ')}; path equals native here`,
            });
          await mountIcon(page, adapter, s.fixture, path);
          await settle(page);
          await checkScenario(page, s);

          // The path is what the adapter's own runtime reported, not a label we attached.
          const seen = await page.evaluate(() => window.__icon.seen as SupportsMap | null);
          expect(injectionProblems(real, seen, p)).toEqual([]);
          expect(errors).toEqual([]);
        });
      }
    });
  }
}

// ---- cross-adapter behaviour that is not one fixture's markup (titles are not matrix rows) -----------------

for (const adapter of ADAPTERS) {
  test(`${COMPONENT} | ${adapter} | sizes: sm md lg from the tokens, fit fills its box, unknown falls back to md`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    for (const size of SIZES.filter((z) => z !== 'fit')) {
      await mountIcon(page, adapter, 'sizes', 'native', { props: { size } });
      expect((await facts(page)).size).toBe(size);
      const b = await box(page);
      expect([near(b.w, EXPECT_PX[size]!), near(b.h, EXPECT_PX[size]!)]).toEqual([true, true]);
    }
    await mountIcon(page, adapter, 'sizes', 'native', { props: { size: 'fit' }, box: 37 });
    const fit = await box(page);
    expect([near(fit.w, 37), near(fit.h, 37)], `${fit.w}x${fit.h}`).toEqual([true, true]);
    await mountIcon(page, adapter, 'sizes', 'native', { props: { size: 'huge' as never } });
    expect((await facts(page)).size).toBe('md');
    expect(near((await box(page)).w, EXPECT_PX['md']!)).toBe(true);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | no stylesheet: the 1em fallback box equals the font size`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    for (const fontSize of [10, 16, 32, 48]) {
      await mountIcon(page, adapter, 'default', 'native', { fontSize });
      await page.evaluate(() => {
        for (const s of document.styleSheets) s.disabled = true;
      });
      const b = await box(page);
      expect([near(b.w, fontSize), near(b.h, fontSize)], `${fontSize}: ${b.w}x${b.h}`).toEqual([
        true,
        true,
      ]);
    }
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | rtl: runtime or prop mirrors only a mirrorable icon, never the attribute alone`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    // dir prop ltr overrides nothing to mirror.
    await mountIcon(page, adapter, 'rtl-mirror', 'native', { props: { dir: 'ltr' } });
    expect([(await facts(page)).mirror, (await facts(page)).transform]).toEqual([null, 'none']);
    // A non-mirrorable icon is never flipped, even in rtl.
    await mountIcon(page, adapter, 'default', 'native', { props: { dir: 'rtl' } });
    expect((await facts(page)).mirror).toBeNull();
    // `dir=rtl` on the document alone does not flip the glyph: the CSS never reads it (ADR-009), core decides.
    await mountIcon(page, adapter, 'rtl-mirror', 'native', { props: { dir: 'ltr' } });
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    expect((await facts(page)).transform).toBe('none');
    await page.evaluate(() => document.documentElement.removeAttribute('dir'));
    // Runtime direction (no dir prop) flips it.
    await mountIcon(page, adapter, 'rtl-runtime');
    const f = await facts(page);
    expect([f.mirror, f.transform]).toEqual(['true', 'matrix(-1, 0, 0, 1, 0, 0)']);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | spin: runs, and is static under prefers-reduced-motion`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    const spin = { attrs: { 'data-spin': 'true' } };
    await mountIcon(page, adapter, 'default', 'native', { props: spin });
    const anim = () =>
      glyph(page).evaluate((n) => {
        const s = getComputedStyle(n);
        return {
          name: s.animationName,
          duration: s.animationDuration,
          iter: s.animationIterationCount,
        };
      });
    const on = await anim();
    expect(on.name).toBe('sj-icon-spin');
    expect(on.iter).toBe('infinite');
    expect(parseFloat(on.duration)).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect((await anim()).name).toBe('none');
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | consumer attributes merge; library attributes and focus stay protected`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountIcon(page, adapter, 'labelled', 'native', {
      props: {
        attrs: { 'data-testid': 'x', class: 'consumer', 'aria-hidden': 'true', tabindex: '0' },
      },
    });
    const f = await facts(page);
    expect(f.cls?.split(' ')).toEqual(expect.arrayContaining(['sj-icon', 'consumer']));
    // aria-hidden and tabindex are library-owned: the labelled icon keeps its role and is not focusable.
    expect([f.role, f.hidden, f.tabindex]).toEqual(['img', null, null]);
    expect(await glyph(page).getAttribute('data-testid')).toBe('x');
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | line box grows by at most 1 px next to text (C12 .b review point)`, async ({
    page,
  }) => {
    await openHost(page);
    await mountIcon(page, adapter, 'default');
    // The 1 px figure was measured with the token line height (24 px at the base size); the page default differs.
    await page.locator('#box').evaluate((n) => (n.style.lineHeight = 'var(--leading-normal)'));
    const line = () => page.locator('#box').evaluate((n) => n.getBoundingClientRect().height);
    const withIcon = await line();
    await glyph(page).evaluate((n) => (n.style.display = 'none'));
    const without = await line();
    expect(withIcon - without).toBeLessThanOrEqual(1);
    expect(withIcon - without).toBeGreaterThanOrEqual(0);
  });
}
