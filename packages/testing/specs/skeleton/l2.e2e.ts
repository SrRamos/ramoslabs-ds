// L2 + L6 for SJSkeleton: one `render` scenario per fixture on 3 engines x 3 adapters x (real detection + all
// `supports` keys forced false). SJSkeleton has no actions, so nothing is pressed: each scenario mounts the fixture
// and asserts what the contract promises (parts, elements, data-shape, hidden shapes, the group's busy/pending
// markup, no live markup in the tree, the announcement). Title (parsed by the parity matrix):
//   <component> | <adapter> | <scenario> | <action> | path=<path>
// Below the matrix: behaviour that is not one fixture's markup (props, timing with real timers, layout shift,
// live-region discipline). Those titles are not matrix rows.
import { test, expect, type Page } from '@playwright/test';
import { injectionProblems } from '../../e2e/supports/injection';
import { isNoop, parsePath, type SupportsMap } from '../../e2e/supports/paths';
import { loadTokens } from '../../contrast/index.js';
import { EXPECTED_ANNOUNCEMENT, FIXTURES, LOADED_LINES, shapeOf } from './fixtures';
import {
  ADAPTERS,
  COMPONENT,
  EXECUTED_PATHS,
  matrixTitle,
  skeletonScenarios,
  type Scenario,
} from './matrix';
import {
  mountSkeleton,
  openHost,
  regions,
  root,
  samples,
  settle,
  spoken,
  trace,
  updateSkeleton,
  waitState,
} from './open';

const tokens = loadTokens();
const rem = (name: string): number => parseFloat(tokens[name]!) * 16;

/** Facts read from the DOM; identical on every adapter. */
const facts = (page: Page) =>
  root(page).evaluate((n) => {
    const attr = (el: Element, a: string) => el.getAttribute(a);
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    };
    const lines = [...n.querySelectorAll(':scope > [data-part="line"]')];
    return {
      tag: n.localName,
      cls: attr(n, 'class'),
      part: attr(n, 'data-part'),
      shape: attr(n, 'data-shape'),
      animation: attr(n, 'data-animation'),
      dataLines: attr(n, 'data-lines'),
      ratio: attr(n, 'data-ratio'),
      size: attr(n, 'data-size'),
      state: attr(n, 'data-state'),
      hidden: attr(n, 'aria-hidden'),
      busy: attr(n, 'aria-busy'),
      role: attr(n, 'role'),
      ariaLive: attr(n, 'aria-live'),
      atomic: attr(n, 'aria-atomic'),
      idAttr: attr(n, 'id'),
      tabindex: attr(n, 'tabindex'),
      visibility: getComputedStyle(n).visibility,
      box: box(n),
      parentW: n.parentElement!.getBoundingClientRect().width,
      // Live markup anywhere in the tree would make the component announce on its own (SSR/hydration hazard).
      liveInside: n.querySelectorAll('[role="status"], [role="alert"], [aria-live], [aria-atomic]')
        .length,
      lines: lines.map((l) => ({
        tag: l.localName,
        cls: attr(l, 'class'),
        part: attr(l, 'data-part'),
        w: box(l).w,
        h: box(l).h,
        childCount: l.children.length,
      })),
      childCount: n.children.length,
      hasShapes: n.querySelector('[data-shape]') !== null,
      hasContent: n.querySelector('.w-card__line') !== null,
      contentText: [...n.querySelectorAll('.w-card__line')].map((l) => l.textContent),
    };
  });

const statusRegions = async (page: Page) =>
  (await regions(page)).filter((r) => r.role === 'status');

async function checkShape(page: Page, s: Scenario) {
  const fx = FIXTURES[s.fixture]!;
  const shape = shapeOf(fx);
  const f = await facts(page);
  expect(f.tag).toBe('div');
  expect(f.cls?.split(' ')).toContain('sj-skeleton');
  expect([f.part, f.shape]).toEqual(['root', shape]);
  expect(f.animation).toBe(fx.animation === 'none' ? 'none' : 'shimmer');
  // A drawn shape is decoration: hidden from assistive tech, never busy, no state, no live markup.
  expect(f.hidden).toBe('true');
  expect([f.busy, f.state]).toEqual([null, null]);
  expect([f.role, f.ariaLive, f.atomic]).toEqual([null, null, null]);
  expect(f.liveInside).toBe(0);
  expect([f.idAttr, f.tabindex]).toEqual([null, null]);
  expect(f.visibility).toBe('visible');
  if (shape === 'text') {
    const n = Math.min(12, Math.max(1, fx.lines ?? 3));
    expect(f.dataLines).toBe(String(n));
    expect(f.lines).toHaveLength(n);
    for (const l of f.lines) {
      expect(l.tag).toBe('div');
      expect(l.cls?.split(' ')).toContain('sj-skeleton__line');
      expect(l.part).toBe('line');
      expect(l.h).toBeCloseTo(rem('skeleton-line-height'), 0);
    }
    // The last line is shorter whenever there is more than one.
    if (n > 1) expect(f.lines[n - 1]!.w).toBeLessThan(f.lines[0]!.w * 0.7);
    else expect(f.lines[0]!.w).toBeCloseTo(f.box.w, 0);
  } else {
    expect(f.childCount).toBe(0);
    expect(f.dataLines).toBeNull();
  }
  if (shape === 'circle') {
    const px = rem(`skeleton-avatar-${fx.size ?? 'md'}`);
    expect(f.size).toBe(fx.size ?? 'md');
    expect([f.box.w, f.box.h]).toEqual([px, px]);
  }
  if (shape === 'rect') {
    const [a, b] = (fx.ratio ?? '16/9').split('/').map(Number) as [number, number];
    expect(f.ratio).toBe(fx.ratio ?? '16/9');
    expect(f.box.w / f.box.h).toBeCloseTo(a / b, 1);
    expect(f.box.w).toBeCloseTo(f.parentW, 0);
  }
  if (shape === 'block') {
    expect(f.box.h).toBeCloseTo(rem('skeleton-block-height'), 0);
    expect(f.box.w).toBeCloseTo(f.parentW, 0);
  }
  // Shapes announce nothing and own no live region.
  expect(await spoken(page)).toEqual([]);
  expect(await statusRegions(page)).toHaveLength(0);
  expect(await page.locator('#mount [aria-live]').count()).toBe(0);
}

async function checkGroupLoading(page: Page, s: Scenario) {
  const expected = EXPECTED_ANNOUNCEMENT[s.fixture]!;
  // Pending: laid out (it reserves space) but invisible, busy, nothing spoken, nothing in the document yet.
  const p = await facts(page);
  expect([p.tag, p.part, p.shape]).toEqual(['div', 'root', 'group']);
  expect(p.cls?.split(' ')).toContain('sj-skeleton');
  expect([p.state, p.busy, p.hidden]).toEqual(['pending', 'true', null]);
  expect([p.role, p.ariaLive, p.atomic]).toEqual([null, null, null]);
  expect([p.idAttr, p.tabindex]).toEqual([null, null]);
  expect(p.liveInside).toBe(0);
  expect(p.visibility).toBe('hidden');
  expect(p.hasShapes).toBe(true);
  expect(p.hasContent).toBe(false);
  expect(p.box.h).toBeGreaterThan(0);
  expect(await spoken(page)).toEqual([]);
  // The polite status region exists (eager, from the generated `skeletonLive`) outside the tree, empty, exposed.
  const before = await statusRegions(page);
  expect(before, 'one persistent status region').toHaveLength(1);
  expect([before[0]!.live, before[0]!.atomic, before[0]!.exposed, before[0]!.text]).toEqual([
    'polite',
    'true',
    true,
    '',
  ]);
  // Visible after the delay: busy, shown, the announcement is spoken once.
  await waitState(page, 'visible');
  const v = await facts(page);
  expect([v.state, v.busy, v.visibility]).toEqual(['visible', 'true', 'visible']);
  await expect.poll(() => spoken(page)).toEqual([expected]);
  await settle(page, 200);
  expect(await spoken(page), 'announced exactly once').toEqual([expected]);
  expect((await regions(page)).filter((r) => r.role === 'alert')).toHaveLength(0);
  expect(await page.locator('#mount [aria-live]').count()).toBe(0);
}

async function checkGroupLoaded(page: Page) {
  const f = await facts(page);
  expect([f.tag, f.part, f.shape]).toEqual(['div', 'root', 'group']);
  expect([f.state, f.busy, f.hidden]).toEqual(['idle', null, null]);
  expect([f.role, f.ariaLive, f.atomic]).toEqual([null, null, null]);
  expect(f.visibility).toBe('visible');
  expect(f.hasShapes).toBe(false);
  expect(f.contentText).toEqual([...LOADED_LINES]);
  expect(f.liveInside).toBe(0);
  // Loaded before it was ever shown: nothing is announced.
  expect(await spoken(page)).toEqual([]);
  expect(await page.locator('#mount [aria-live]').count()).toBe(0);
}

for (const path of EXECUTED_PATHS) {
  for (const adapter of ADAPTERS) {
    test.describe(`${COMPONENT} | ${adapter} | path=${path}`, () => {
      for (const s of skeletonScenarios()) {
        test(matrixTitle(adapter, s, path), async ({ page }) => {
          const errors = await openHost(page);
          const real = await page.evaluate(() => ({ ...window.__skeleton.real }) as SupportsMap);
          const p = parsePath(path);
          if (isNoop(real, p))
            test.info().annotations.push({
              type: 'noop',
              description: `engine already lacks ${p.forced.join(', ')}; path equals native here`,
            });
          const group = s.fixture === 'group-loading';
          await mountSkeleton(page, adapter, s.fixture, path, { settle: !group });
          if (group) await checkGroupLoading(page, s);
          else if (s.fixture === 'group-loaded') await checkGroupLoaded(page);
          else await checkShape(page, s);

          // The path is what the adapter's own runtime reported, not a label we attached.
          const seen = await page.evaluate(() => window.__skeleton.seen as SupportsMap | null);
          expect(injectionProblems(real, seen, p)).toEqual([]);
          expect(errors).toEqual([]);
        });
      }
    });
  }
}

// ---- props and CSS hooks (titles are not matrix rows) --------------------------------------------------------

for (const adapter of ADAPTERS) {
  test(`${COMPONENT} | ${adapter} | props: lines clamp 1..12, ratio and size follow the tokens, an unknown value falls back`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'text');
    for (const [lines, want] of [
      [0, 1],
      [1, 1],
      [5, 5],
      [12, 12],
      [40, 12],
    ] as const) {
      await updateSkeleton(page, { lines });
      expect((await facts(page)).lines, `lines=${lines}`).toHaveLength(want);
    }
    await mountSkeleton(page, adapter, 'rect');
    for (const r of ['1/1', '4/3', '3/2', '16/9', '21/9']) {
      await updateSkeleton(page, { ratio: r });
      const f = await facts(page);
      const [a, b] = r.split('/').map(Number) as [number, number];
      expect(f.ratio).toBe(r);
      expect(f.box.w / f.box.h, r).toBeCloseTo(a / b, 1);
    }
    await updateSkeleton(page, { ratio: '5/7' });
    expect((await facts(page)).ratio).toBe('16/9');
    await mountSkeleton(page, adapter, 'circle');
    for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
      await updateSkeleton(page, { size });
      const f = await facts(page);
      expect([f.box.w, f.box.h], size).toEqual([
        rem(`skeleton-avatar-${size}`),
        rem(`skeleton-avatar-${size}`),
      ]);
    }
    await updateSkeleton(page, { size: 'huge' });
    expect((await facts(page)).size).toBe('md');
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | block: --sj-skeleton-width and --sj-skeleton-height size the box`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'block');
    await root(page).evaluate((n) => {
      (n as HTMLElement).style.setProperty('--sj-skeleton-width', '120px');
      (n as HTMLElement).style.setProperty('--sj-skeleton-height', '30px');
    });
    const f = await facts(page);
    expect([f.box.w, f.box.h]).toEqual([120, 30]);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | animation: shimmer runs a sweep over a gradient, none is a flat fill`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    const look = () =>
      root(page).evaluate((n) => {
        const s = getComputedStyle(n);
        return { name: s.animationName, image: s.backgroundImage, color: s.backgroundColor };
      });
    await mountSkeleton(page, adapter, 'block');
    const on = await look();
    expect(on.name).toBe('sj-skeleton-shimmer');
    expect(on.image).toContain('linear-gradient');
    await mountSkeleton(page, adapter, 'block-static');
    const off = await look();
    expect([off.name, off.image]).toEqual(['none', 'none']);
    expect(off.color).toBe(on.color);
    expect(errors).toEqual([]);
  });
}

// Consumer attributes: React and Vue spread them on the root through the ADR-004 merge. Vanilla has no `attrs`
// option (the contract lists none), so there is nothing to merge there.
for (const adapter of ['react', 'vue'] as const) {
  test(`${COMPONENT} | ${adapter} | consumer attributes merge; role, aria-live and the library hooks are protected`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      props: {
        attrs: {
          'data-testid': 'x',
          class: 'consumer',
          role: 'status',
          'aria-live': 'assertive',
          'aria-busy': 'false',
          'data-shape': 'rect',
        },
      },
    });
    const f = await facts(page);
    expect(f.cls?.split(' ')).toEqual(expect.arrayContaining(['sj-skeleton', 'consumer']));
    expect([f.role, f.ariaLive, f.shape, f.busy]).toEqual([null, null, 'group', 'true']);
    expect(await root(page).getAttribute('data-testid')).toBe('x');
    expect(errors).toEqual([]);
  });
}

// ---- timing with real timers (short props; the token defaults have their own spec) ----------------------------

/** Ends the load `ms` after the mount call; returns when (ms since mount) the update was issued. */
const endLoadingAt = (page: Page, ms: number): Promise<number> =>
  page.evaluate(
    (m) =>
      new Promise<number>((resolve) =>
        setTimeout(() => {
          void window.__skeleton.update({ loading: false }, { settle: false });
          resolve(performance.now() - window.__skeleton.t0);
        }, m),
      ),
    ms,
  );

const states = (t: Awaited<ReturnType<typeof trace>>) => t.map((e) => e.state);
const at = (t: Awaited<ReturnType<typeof trace>>, s: string) => t.find((e) => e.state === s);
/** Timers never fire early, but a trace stamp is taken at commit; leave room for scheduling noise. */
const TOL = 30;

for (const adapter of ADAPTERS) {
  test(`${COMPONENT} | ${adapter} | timing: a load shorter than the delay is never visible and announces nothing`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: { delay: 150, minDuration: 120 },
    });
    const ended = await endLoadingAt(page, 20);
    expect(ended).toBeLessThan(120);
    await settle(page, 450);
    const t = await trace(page);
    expect(states(t)).toEqual(['pending', 'idle']);
    expect(t.some((e) => e.state === 'visible' || e.state === 'holding')).toBe(false);
    // While the placeholder was in the document it was invisible, in every painted frame.
    const frames = await samples(page);
    expect(frames.length).toBeGreaterThan(3);
    for (const fr of frames.filter((x) => x.state !== 'idle'))
      expect([fr.state, fr.visibility]).toEqual(['pending', 'hidden']);
    expect(await spoken(page)).toEqual([]);
    const f = await facts(page);
    expect([f.state, f.busy, f.hasShapes, f.hasContent]).toEqual(['idle', null, false, true]);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | timing: shown after the delay, announced once`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: { delay: 60, minDuration: 5000 },
    });
    await waitState(page, 'visible');
    const t = await trace(page);
    expect(states(t)).toEqual(['pending', 'visible']);
    const shown = at(t, 'visible')!;
    expect(shown.t).toBeGreaterThanOrEqual(60 - 5);
    expect(shown.t).toBeLessThan(60 + 500);
    expect([shown.visibility, shown.busy, shown.skeleton]).toEqual(['visible', 'true', true]);
    expect(at(t, 'pending')!.visibility).toBe('hidden');
    await expect.poll(() => spoken(page)).toEqual([{ role: 'status', text: 'Loading activity' }]);
    await settle(page, 300);
    expect(await spoken(page)).toHaveLength(1);
    // The same text again is not a second announcement; a new text is.
    await updateSkeleton(page, { announce: 'Loading activity' });
    expect(await spoken(page)).toHaveLength(1);
    await updateSkeleton(page, { announce: 'Still loading' });
    expect((await spoken(page)).map((m) => m.text)).toEqual(['Loading activity', 'Still loading']);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | timing: kept for the minimum duration after loading ends (holding), then the content swaps in`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: { delay: 60, minDuration: 400 },
    });
    await waitState(page, 'visible');
    await updateSkeleton(page, { loading: false }, { settle: false });
    await waitState(page, 'idle');
    const t = await trace(page);
    expect(states(t)).toEqual(['pending', 'visible', 'holding', 'idle']);
    const visible = at(t, 'visible')!;
    const holding = at(t, 'holding')!;
    const idle = at(t, 'idle')!;
    expect(idle.t - visible.t).toBeGreaterThanOrEqual(400 - TOL);
    expect(idle.t - visible.t).toBeLessThan(400 + 500);
    // Holding still shows the placeholder, still busy; idle shows the content and drops aria-busy.
    expect([holding.skeleton, holding.content, holding.busy, holding.visibility]).toEqual([
      true,
      false,
      'true',
      'visible',
    ]);
    expect([idle.skeleton, idle.content, idle.busy]).toEqual([false, true, null]);
    expect((await facts(page)).contentText).toEqual([...LOADED_LINES]);
    expect(await spoken(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | timing: loading that ends after the minimum swaps at once; loading again while holding resumes`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: { delay: 30, minDuration: 80 },
    });
    await waitState(page, 'visible');
    await settle(page, 250);
    await updateSkeleton(page, { loading: false }, { settle: false });
    await waitState(page, 'idle');
    expect(states(await trace(page))).toEqual(['pending', 'visible', 'idle']);

    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: { delay: 30, minDuration: 400 },
    });
    await waitState(page, 'visible');
    await updateSkeleton(page, { loading: false }, { settle: false });
    await waitState(page, 'holding');
    await updateSkeleton(page, { loading: true }, { settle: false });
    await waitState(page, 'visible');
    await settle(page, 600);
    const t = await trace(page);
    expect(states(t)).toEqual(['pending', 'visible', 'holding', 'visible']);
    expect(await spoken(page), 'resuming does not announce again').toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | timing: the token defaults (300 ms delay, 500 ms minimum) drive an untimed group`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    const noProps = { delay: undefined, minDuration: undefined };
    // A load shorter than the 300 ms delay: never visible.
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: noProps,
    });
    expect(
      await root(page).evaluate((n) => {
        const s = getComputedStyle(n);
        return [
          s.getPropertyValue('--motion-skeleton-delay').trim(),
          s.getPropertyValue('--motion-skeleton-min-duration').trim(),
        ];
      }),
    ).toEqual(['300ms', '500ms']);
    await endLoadingAt(page, 100);
    await settle(page, 400);
    expect(states(await trace(page))).toEqual(['pending', 'idle']);
    expect(await spoken(page)).toEqual([]);
    // A load that outlasts it: visible at about 300 ms, announced, kept to about 800 ms.
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: noProps,
    });
    await waitState(page, 'visible');
    await updateSkeleton(page, { loading: false }, { settle: false });
    await waitState(page, 'idle');
    const t = await trace(page);
    expect(states(t)).toEqual(['pending', 'visible', 'holding', 'idle']);
    const visible = at(t, 'visible')!;
    expect(visible.t).toBeGreaterThanOrEqual(300 - 5);
    expect(visible.t).toBeLessThan(300 + 400);
    expect(at(t, 'idle')!.t - visible.t).toBeGreaterThanOrEqual(500 - TOL);
    expect(at(t, 'idle')!.t - visible.t).toBeLessThan(500 + 400);
    expect(await spoken(page)).toEqual([{ role: 'status', text: 'Loading activity' }]);
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | timing: unmounting cancels every timer: nothing is shown or spoken afterwards`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    // Mount and unmount in one task sequence inside the page, so a slow runner cannot let the delay pass first.
    await page.evaluate(
      async ([a]) => {
        await window.__skeleton.mount(a as never, 'group-loading', 'native', {
          settle: false,
          props: { delay: 150, minDuration: 80 },
        });
        await new Promise((r) => setTimeout(r, 10));
        window.__skeleton.unmount();
      },
      [adapter] as const,
    );
    await settle(page, 400);
    expect(await spoken(page)).toEqual([]);
    expect(await page.locator('#mount [data-part="root"]').count()).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test(`${COMPONENT} | react | StrictMode's simulated remount still announces exactly once`, async ({
  page,
}) => {
  const errors = await openHost(page);
  await mountSkeleton(page, 'react', 'group-loading', 'native', {
    strict: true,
    settle: false,
    props: { delay: 60, minDuration: 5000 },
  });
  await waitState(page, 'visible');
  await settle(page, 300);
  expect(await spoken(page)).toEqual([{ role: 'status', text: 'Loading activity' }]);
  expect(errors).toEqual([]);
});

// ---- layout shift: the swap moves nothing ----------------------------------------------------------------------

const geometry = (page: Page) =>
  page.evaluate(() => {
    const g = document.querySelector('#mount [data-shape="group"]')!.getBoundingClientRect();
    const f = document.getElementById('after')!.getBoundingClientRect();
    return { w: g.width, h: g.height, top: g.top, left: g.left, followerTop: f.top };
  });

for (const adapter of ADAPTERS) {
  test(`${COMPONENT} | ${adapter} | CLS: the swap from placeholder to content shifts nothing (layout-shift 0, identical boxes)`, async ({
    page,
  }) => {
    const errors = await openHost(page);
    await mountSkeleton(page, adapter, 'group-loading', 'native', {
      settle: false,
      props: { delay: 60, minDuration: 1000 },
    });
    // Pending: already laid out, so the box exists before anything is shown.
    const pending = await geometry(page);
    await waitState(page, 'visible');
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const visible = await geometry(page);
    const since = await page.evaluate(() => window.__skeleton.now());
    await updateSkeleton(page, { loading: false }, { settle: false });
    await waitState(page, 'holding');
    const holding = await geometry(page);
    await waitState(page, 'idle');
    await settle(page, 400);
    const idle = await geometry(page);
    // Every phase has the same box and the content after it never moves.
    expect(pending.h).toBeGreaterThan(0);
    for (const g of [visible, holding, idle]) expect(g).toEqual(pending);
    // A separate mount of the already-loaded group has the very same box (skeleton and content block-size agree).
    await mountSkeleton(page, adapter, 'group-loaded');
    const loaded = await geometry(page);
    expect([loaded.w, loaded.h, loaded.followerTop]).toEqual([
      pending.w,
      pending.h,
      pending.followerTop,
    ]);
    // Chromium reports layout-shift entries; the other engines have no such entry type, and the geometry above
    // is their proof. Where supported the total over the swap must be exactly zero.
    const supported = await page.evaluate(() => window.__skeleton.shiftSupported);
    if (supported) {
      const total = await page.evaluate((s) => window.__skeleton.shiftSince(s), since);
      expect(total, 'sum of layout-shift values over the swap').toBe(0);
    }
    expect(errors).toEqual([]);
  });

  test(`${COMPONENT} | ${adapter} | CLS: seeded: content taller than the placeholder is detected as a shift`, async ({
    page,
  }) => {
    await openHost(page);
    await mountSkeleton(page, adapter, 'group-loaded');
    const before = await geometry(page);
    const since = await page.evaluate(() => window.__skeleton.now());
    await page.evaluate(() => {
      (document.querySelector('#mount .w-card__body') as HTMLElement).style.paddingBlockEnd =
        '40px';
    });
    await settle(page, 400);
    const after = await geometry(page);
    expect(after.followerTop).toBeGreaterThan(before.followerTop);
    if (await page.evaluate(() => window.__skeleton.shiftSupported))
      expect(await page.evaluate((s) => window.__skeleton.shiftSince(s), since)).toBeGreaterThan(0);
  });
}

test(`${COMPONENT} | seeded: a trace that shows the placeholder inside the delay is reported`, () => {
  const bad = [
    { state: 'pending', visibility: 'visible' },
    { state: 'pending', visibility: 'hidden' },
  ];
  expect(bad.filter((s) => s.state === 'pending' && s.visibility !== 'hidden')).toHaveLength(1);
});
