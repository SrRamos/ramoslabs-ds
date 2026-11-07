// ARIA snapshots for SJSkeleton (ADR-013 L2): one YAML file per fixture, shared by every adapter and engine. The
// tree is #root (the component and the paragraph that follows it). Shapes are decoration and the pending/visible
// placeholder of a group is aria-hidden or invisible, so the component contributes NOTHING: the tree is the
// follower paragraph alone. The loaded group contributes its content. The snapshot is compared for equality (a
// snapshot template alone matches as a subset), and aria-busy, which no snapshot shows, is checked on the DOM.
// Title format: <component> | <adapter> | <scenario> (not a matrix row: the parity matrix ignores it).
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from './fixtures';
import { ADAPTERS, COMPONENT } from './matrix';
import { mountSkeleton, openHost, root, settle, updateSkeleton, waitState } from './open';

const here = dirname(fileURLToPath(import.meta.url));
const yaml = (fixture: string) => readFileSync(join(here, 'aria', `${fixture}.yml`), 'utf8');
const tree = (page: Page) => page.locator('#root');
/** Indentation is formatting (prettier reindents the YAML files); the tree is compared by its lines. */
const norm = (s: string) => s.replace(/^\s+/gm, '').trim();

for (const adapter of ADAPTERS) {
  for (const fixture of Object.keys(FIXTURES)) {
    test(`${COMPONENT} | ${adapter} | aria snapshot ${fixture}`, async ({ page }) => {
      const errors = await openHost(page);
      await mountSkeleton(page, adapter, fixture);
      await expect(tree(page)).toMatchAriaSnapshot(yaml(fixture));
      expect(norm(await tree(page).ariaSnapshot())).toBe(norm(yaml(fixture)));
      for (const role of ['img', 'status', 'alert', 'progressbar'] as const)
        await expect(page.locator('#mount').getByRole(role), role).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test(`${COMPONENT} | ${adapter} | busy state: aria-busy is true while pending, visible and holding, absent once loaded; the tree stays empty until then`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: { delay: 60, minDuration: 1000 },
    });
    const busy = () => root(page).getAttribute('aria-busy');
    expect(await busy()).toBe('true');
    await waitState(page, 'visible');
    expect(await busy()).toBe('true');
    expect(norm(await tree(page).ariaSnapshot())).toBe(norm(yaml('group-loading')));
    // Every shape in the placeholder is hidden from assistive tech.
    const shapes = await page
      .locator('#mount [data-shape]:not([data-shape="group"])')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-hidden')));
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.every((v) => v === 'true')).toBe(true);
    await updateSkeleton(page, { loading: false }, { settle: false });
    await waitState(page, 'holding');
    expect(await busy()).toBe('true');
    await waitState(page, 'idle');
    expect(await busy()).toBeNull();
    await settle(page, 50);
    expect(norm(await tree(page).ariaSnapshot())).toBe(norm(yaml('group-loaded')));
    expect(errors).toEqual([]);
  });
}

// A snapshot is only evidence if a regression fails it. Each case breaks the accessible tree of a mounted fixture
// on purpose and asserts the shared snapshot (plus the absent-role counts) no longer holds.
const SEEDED = [
  {
    fixture: 'circle',
    why: 'a shape exposed as a labelled image',
    break: (r: Element) => {
      const c = r.querySelector('[data-shape="circle"]')!;
      c.removeAttribute('aria-hidden');
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', 'Avatar');
    },
  },
  {
    fixture: 'text',
    why: 'a shape that is not hidden and carries text',
    break: (r: Element) => {
      const c = r.querySelector('[data-shape="text"]')!;
      c.removeAttribute('aria-hidden');
      c.insertAdjacentHTML('beforeend', '<p>Loading...</p>');
    },
  },
  {
    fixture: 'group-loaded',
    why: 'content text replaced',
    break: (r: Element) => {
      r.querySelector('.w-card__line')!.textContent = 'Something else';
    },
  },
  {
    fixture: 'group-loaded',
    why: 'live markup rendered on the group',
    break: (r: Element) => {
      const g = r.querySelector('[data-shape="group"]')!;
      g.setAttribute('role', 'status');
      g.setAttribute('aria-live', 'polite');
    },
  },
] as const;

for (const adapter of ADAPTERS) {
  for (const s of SEEDED) {
    test(`seeded aria regression | ${adapter} | ${s.why} fails the ${s.fixture} snapshot`, async ({
      page,
    }) => {
      await openHost(page);
      await mountSkeleton(page, adapter, s.fixture);
      await page.locator('#mount').evaluate(s.break);
      const same = norm(await tree(page).ariaSnapshot()) === norm(yaml(s.fixture));
      const extras = await page
        .locator('#mount')
        .evaluate(
          (n) => n.querySelectorAll('[role="img"], [role="status"], [role="alert"]').length,
        );
      expect(same && extras === 0, 'the regression went unnoticed').toBe(false);
    });
  }
}
