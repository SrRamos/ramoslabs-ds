// L2 + L6 for SJState (W1-C11.f): one `render` scenario per fixture on 3 engines x 3 adapters x (real detection +
// all `supports` keys forced false). SJState has no actions (as SJIcon), so nothing is pressed: each scenario mounts
// the fixture and asserts what the contract promises (parts, elements, data-variant, no live markup in the tree, the
// live regions, the announcement spoken exactly once). Title (parsed by the parity matrix, W1-313):
//   <component> | <adapter> | <scenario> | <action> | path=<path>
// Below the matrix: cross-adapter behaviour that is not one fixture's markup (changes, title-slot parity, reduced
// motion, StrictMode, unmount). Those titles are not matrix rows.
import { test, expect, type Page } from '@playwright/test';
import { injectionProblems } from '../../e2e/supports/injection';
import { isNoop, parsePath, type SupportsMap } from '../../e2e/supports/paths';
import {
  EXPECTED_ANNOUNCEMENT,
  FIXTURES,
  PART_ELEMENT,
  VARIANT_FIXTURES,
  headingOf,
} from './fixtures';
import {
  ADAPTERS,
  COMPONENT,
  EXECUTED_PATHS,
  matrixTitle,
  stateScenarios,
  type Scenario,
} from './matrix';
import { mountState, openHost, part, regions, root, settle, spoken, updateState } from './open';

const PARTS = ['icon', 'title', 'description', 'actions'] as const;

/** Facts read from the DOM; identical on every adapter. */
const facts = (page: Page) =>
  root(page).evaluate((n) => {
    const attr = (el: Element, a: string) => el.getAttribute(a);
    return {
      tag: n.localName,
      cls: attr(n, 'class'),
      part: attr(n, 'data-part'),
      variant: attr(n, 'data-variant'),
      busy: attr(n, 'aria-busy'),
      role: attr(n, 'role'),
      ariaLive: attr(n, 'aria-live'),
      atomic: attr(n, 'aria-atomic'),
      idAttr: attr(n, 'id'),
      tabindex: attr(n, 'tabindex'),
      // Live markup anywhere in the tree would make the component announce on its own (SSR/hydration hazard).
      liveInside: n.querySelectorAll('[role="status"], [role="alert"], [aria-live], [aria-atomic]')
        .length,
      children: [...n.children].map((c) => ({
        tag: c.localName,
        part: attr(c, 'data-part'),
        variant: attr(c, 'data-variant'),
        cls: attr(c, 'class'),
        hidden: attr(c, 'aria-hidden'),
        text: (c.textContent ?? '').trim(),
        role: attr(c, 'role'),
      })),
    };
  });

async function checkScenario(page: Page, s: Scenario) {
  const f = await facts(page);
  const fx = FIXTURES[s.fixture]!;
  const variant = fx.variant ?? 'first-use';
  const heading = headingOf(fx);

  // Root: a div with the library class, the variant on it, busy only while loading, no live markup of its own.
  expect(f.tag).toBe(PART_ELEMENT.root);
  expect(f.cls?.split(' ')).toContain('sj-state');
  expect([f.part, f.variant]).toEqual(['root', variant]);
  expect(f.busy).toBe(variant === 'loading' ? 'true' : null);
  expect([f.role, f.ariaLive, f.atomic]).toEqual([null, null, null]);
  expect(f.liveInside).toBe(0);
  // Stateless, no ids (SSR equality across idPrefix depends on it); the state itself is never a tab stop.
  expect([f.idAttr, f.tabindex]).toEqual([null, null]);

  // Parts exist only with content, in contract order, each with the element the anatomy names and data-variant.
  const expectedParts = PARTS.filter((p) =>
    p === 'icon'
      ? !!fx.icon
      : p === 'title'
        ? heading !== undefined
        : p === 'description'
          ? fx.description !== undefined
          : fx.action !== undefined,
  );
  expect(f.children.map((c) => c.part)).toEqual(expectedParts);
  for (const c of f.children) {
    expect(c.tag, `${c.part} element`).toBe(PART_ELEMENT[c.part as (typeof PARTS)[number]]);
    expect(c.variant, `${c.part} data-variant`).toBe(variant);
    expect(c.cls?.split(' ')).toContain(`sj-state__${c.part}`);
    expect(c.role).toBeNull();
  }
  // The icon part is decorative and holds a real SJIcon; the glyph alone never carries the kind.
  if (fx.icon) {
    const icon = f.children.find((c) => c.part === 'icon')!;
    expect(icon.hidden).toBe('true');
    await expect(part(page, 'icon').locator('svg.sj-icon')).toHaveCount(1);
    expect(await part(page, 'icon').locator('svg.sj-icon').getAttribute('data-spin')).toBe(
      fx.icon.spin ? 'true' : null,
    );
  }
  // Text is always rendered (WCAG 1.4.1): the kind is never colour or glyph only.
  if (heading !== undefined) {
    expect(f.children.find((c) => c.part === 'title')!.text).toBe(heading);
    await expect(part(page, 'title')).toBeVisible();
  }
  if (fx.description !== undefined)
    expect(f.children.find((c) => c.part === 'description')!.text).toBe(fx.description);
  if (fx.action !== undefined) {
    await expect(part(page, 'actions').getByRole('button', { name: fx.action })).toBeVisible();
    // The actions part holds exactly one tab stop and the state adds none.
    const stops = await page
      .locator('#mount')
      .evaluate(
        (n) =>
          [...n.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].length,
      );
    expect(stops).toBe(1);
  }

  // Live regions: the polite status region exists (eager, from the generated `stateLive`) outside the tree,
  // hidden visually yet exposed; the alert region exists only when something was announced through it.
  const expected = EXPECTED_ANNOUNCEMENT[s.fixture] ?? null;
  const live = await regions(page);
  const status = live.filter((r) => r.role === 'status');
  const alert = live.filter((r) => r.role === 'alert');
  expect(status, 'one persistent status region').toHaveLength(1);
  expect([status[0]!.live, status[0]!.atomic, status[0]!.exposed]).toEqual([
    'polite',
    'true',
    true,
  ]);
  expect(alert).toHaveLength(expected?.role === 'alert' ? 1 : 0);
  if (alert[0]) expect([alert[0].live, alert[0].atomic]).toEqual(['assertive', 'true']);
  expect(await page.locator('#mount [aria-live]').count()).toBe(0);

  // The announcement: exactly one, with the right politeness and text, or none for the silent kinds.
  expect(await spoken(page)).toEqual(expected ? [expected] : []);
}

for (const path of EXECUTED_PATHS) {
  for (const adapter of ADAPTERS) {
    test.describe(`${COMPONENT} | ${adapter} | path=${path}`, () => {
      for (const s of stateScenarios()) {
        test(matrixTitle(adapter, s, path), async ({ page }) => {
          const errors = await openHost(page);
          const real = await page.evaluate(() => ({ ...window.__state.real }) as SupportsMap);
          const p = parsePath(path);
          if (isNoop(real, p))
            test.info().annotations.push({
              type: 'noop',
              description: `engine already lacks ${p.forced.join(', ')}; path equals native here`,
            });
          await mountState(page, adapter, s.fixture, path);
          await settle(page);
          await checkScenario(page, s);

          // The path is what the adapter's own runtime reported, not a label we attached.
          const seen = await page.evaluate(() => window.__state.seen as SupportsMap | null);
          expect(injectionProblems(real, seen, p)).toEqual([]);
          expect(errors).toEqual([]);
        });
      }
    });
  }
}

// ---- cross-adapter behaviour that is not one fixture's markup (titles are not matrix rows) -----------------

for (const adapter of ADAPTERS) {
  test(`${COMPONENT} | ${adapter} | the five variants are distinct and an unknown variant falls back to first-use`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    const seen = new Set<string>();
    for (const name of VARIANT_FIXTURES) {
      await mountState(page, adapter, name);
      const f = await facts(page);
      expect(f.variant).toBe(name);
      seen.add(f.variant!);
    }
    expect(seen.size).toBe(5);
    // Never a "done" or "no results" message for a resource that may never have had data; and silent.
    await mountState(page, adapter, 'first-use', 'native', {
      props: { variant: 'bogus' as never },
    });
    const f = await facts(page);
    expect([f.variant, ...f.children.map((c) => c.variant)]).toEqual(
      new Array(f.children.length + 1).fill('first-use'),
    );
    expect(await spoken(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | live: each change is announced exactly once; the same text again is not`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountState(page, adapter, 'no-results');
    expect(await spoken(page)).toEqual([{ role: 'status', text: 'No results for "invoice"' }]);
    // Re-render with identical props: nothing is said again.
    await updateState(page, {});
    await updateState(page, { description: 'A different description is not announced' });
    expect(await spoken(page)).toHaveLength(1);
    // A count change is a new message: polite status, once.
    await updateState(page, { announce: '12 results' });
    expect(await spoken(page)).toEqual([
      { role: 'status', text: 'No results for "invoice"' },
      { role: 'status', text: '12 results' },
    ]);
    await updateState(page, { announce: '12 results' });
    expect(await spoken(page)).toHaveLength(2);
    await updateState(page, { announce: '3 results' });
    expect((await spoken(page)).map((m) => m.text)).toEqual([
      'No results for "invoice"',
      '12 results',
      '3 results',
    ]);
    // A static kind with no announce text says nothing on change.
    await mountState(page, adapter, 'first-use');
    await updateState(page, { heading: 'Another heading', variant: 'cleared' });
    expect(await spoken(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | live: first-use to loading to error to interrupting error uses status, status, status, alert`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountState(page, adapter, 'first-use');
    expect(await spoken(page)).toEqual([]);
    await updateState(page, { variant: 'loading', heading: 'Loading projects' });
    await updateState(page, { variant: 'error', heading: 'Could not load projects' });
    await updateState(page, { interrupt: true, heading: 'Connection lost' });
    expect(await spoken(page)).toEqual([
      { role: 'status', text: 'Loading projects' },
      { role: 'status', text: 'Could not load projects' },
      { role: 'alert', text: 'Connection lost' },
    ]);
    // aria-busy follows the variant only.
    expect((await facts(page)).busy).toBeNull();
    await updateState(page, { variant: 'loading' });
    expect((await facts(page)).busy).toBe('true');
    // interrupt on a non-error never alerts (ADR-006): loading stays polite.
    expect((await spoken(page)).filter((m) => m.role === 'alert')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | live: title-slot parity: a string title announces like heading, and a changed title announces once`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountState(page, adapter, 'title-slot');
    expect(await spoken(page)).toEqual([{ role: 'status', text: '3 results found' }]);
    const t = await part(page, 'title').evaluate((n) => ({
      tag: n.localName,
      text: n.textContent,
    }));
    expect(t).toEqual({ tag: 'p', text: '3 results found' });
    await updateState(page, { titleSlot: '5 results found' });
    expect((await spoken(page)).map((m) => m.text)).toEqual(['3 results found', '5 results found']);
    await updateState(page, { titleSlot: '5 results found' });
    expect(await spoken(page)).toHaveLength(2);
    // An element in the title slot reads the same on all three adapters (the text the user sees).
    await mountState(page, adapter, 'title-element');
    expect(await spoken(page)).toEqual([{ role: 'status', text: '3 results found' }]);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | live: an explicit announce on a static kind speaks that text, not the heading`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountState(page, adapter, 'announce-static');
    expect(await spoken(page)).toEqual([{ role: 'status', text: 'Workspace ready' }]);
    expect(await part(page, 'title').textContent()).toBe('Welcome');
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | live: nothing is spoken after unmount`, async ({ page }) => {
    const errors = await openHost(page);
    await mountState(page, adapter, 'loading');
    expect(await spoken(page)).toHaveLength(1);
    await page.evaluate(() => window.__state.unmount());
    await settle(page, 200);
    expect(await spoken(page)).toHaveLength(1);
    // Every part is gone (vanilla leaves the consumer's own root element, which it does not own).
    expect(
      await page.locator('#mount [data-part="title"], #mount [data-part="icon"]').count(),
    ).toBe(0);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | elements per part: icon span, title p, description p, actions div`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountState(page, adapter, 'error');
    const tags = await root(page).evaluate((n) => ({
      root: n.localName,
      parts: Object.fromEntries(
        [...n.children].map((c) => [c.getAttribute('data-part'), c.localName]),
      ),
    }));
    expect(tags).toEqual({ root: 'div', parts: PART_ELEMENT_PARTS });
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | spinner: runs, and is static under prefers-reduced-motion`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountState(page, adapter, 'loading');
    const anim = () =>
      page.locator('#mount [data-part="icon"] svg').evaluate((n) => {
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
    // The message is still there and still spoken once: the spinner is decoration.
    await expect(part(page, 'title')).toHaveText('Loading projects');
    expect(await spoken(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | the only tab stop is the action; the state and its parts are never focusable`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    const stops = () =>
      page
        .locator('#mount')
        .evaluate((n) =>
          [n, ...n.querySelectorAll('*')]
            .filter((e) => (e as HTMLElement).tabIndex >= 0)
            .map((e) => e.localName),
        );
    await mountState(page, adapter, 'first-use');
    expect(await stops()).toEqual(['button']);
    // The action takes focus like any button; the state never steals it at mount (focus stays on the body).
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await part(page, 'actions').locator('button').focus();
    expect(await page.evaluate(() => document.activeElement?.localName)).toBe('button');
    await mountState(page, adapter, 'loading');
    expect(await stops()).toEqual([]);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(errors).toEqual([]);
  });
}

// Consumer attributes: React and Vue spread them on the root through the ADR-004 merge. Vanilla has no `attrs`
// option (the contract lists none), so there is nothing to merge there and it is not part of this check.
for (const adapter of ['react', 'vue'] as const) {
  test(`${COMPONENT} | ${adapter} | consumer attributes merge; role and aria-live are refused, library data attributes protected`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountState(page, adapter, 'loading', 'native', {
      props: {
        attrs: {
          'data-testid': 'x',
          class: 'consumer',
          role: 'alert',
          'aria-live': 'assertive',
          'data-variant': 'error',
        },
      },
    });
    const f = await facts(page);
    expect(f.cls?.split(' ')).toEqual(expect.arrayContaining(['sj-state', 'consumer']));
    expect([f.role, f.ariaLive, f.variant]).toEqual([null, null, 'loading']);
    expect(await root(page).getAttribute('data-testid')).toBe('x');
    expect(await regions(page).then((r) => r.filter((x) => x.role === 'alert'))).toHaveLength(0);
    expect(errors).toEqual([]);
  });
}

test(`${COMPONENT} | react | StrictMode's simulated remount still speaks exactly once`, async ({
  page,
}) => {
  const errors = await openHost(page);
  await mountState(page, 'react', 'loading', 'native', { strict: true });
  expect(await spoken(page)).toEqual([{ role: 'status', text: 'Loading projects' }]);
  await mountState(page, 'react', 'error-interrupt', 'native', { strict: true });
  expect(await spoken(page)).toEqual([{ role: 'alert', text: 'Connection lost' }]);
  expect(errors).toEqual([]);
});

const PART_ELEMENT_PARTS = { icon: 'span', title: 'p', description: 'p', actions: 'div' };
