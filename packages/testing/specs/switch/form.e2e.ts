// Form participation (W1-C03s.f, ADR-014, C03s row): the form state of an SJSwitch must be IDENTICAL to a
// bare `<input type=checkbox>` in a real browser, in all three adapters (and the `<sj-switch>` element),
// at every step of the same operation sequence, INCLUDING after `form.reset()`. "State" is what
// `new FormData(form)` submits, the input's checked / defaultChecked / `checked` attribute / :checked /
// :disabled, and, for the real-submit cases, the query string the browser actually navigates with.
// Harness-check titles (not matrix rows): they carry no `path=` suffix.
import { test, expect, type Page } from '@playwright/test';
import { ADAPTERS, FORM_FIXTURES, LABEL, type Adapter, type SwitchFixtureProps } from './fixtures';

type Op = 'click' | 'space' | 'reset';
const OPS: { name: string; ops: Op[] }[] = [
  { name: 'untouched', ops: [] },
  { name: 'click', ops: ['click'] },
  { name: 'click click', ops: ['click', 'click'] },
  { name: 'space', ops: ['space'] },
  { name: 'reset untouched', ops: ['reset'] },
  { name: 'click then reset', ops: ['click', 'reset'] },
  { name: 'click then reset then click', ops: ['click', 'reset', 'click'] },
  { name: 'click click then reset', ops: ['click', 'click', 'reset'] },
  { name: 'reset then click', ops: ['reset', 'click'] },
  { name: 'space then reset then space', ops: ['space', 'reset', 'space'] },
];

type Kind = Adapter | 'vanilla-element';
const KINDS: Kind[] = [...ADAPTERS, 'vanilla-element'];

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  return errors;
}

async function mountPair(page: Page, kind: Kind, props: SwitchFixtureProps): Promise<void> {
  if (kind === 'vanilla-element') await page.evaluate((p) => window.__sw.mountElement(p), props);
  else
    await page.evaluate(
      ([a, p]) => window.__sj.mount(a as 'react', p as never).then(() => undefined),
      [kind, props] as const,
    );
  await page.evaluate((p) => window.__sw.bare(p), props);
  await page.locator('#f input[type=checkbox]').waitFor();
  await settle(page);
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => setTimeout(r, 40)));

async function apply(page: Page, op: Op, disabled: boolean): Promise<void> {
  for (const id of ['f', 'bare'] as const) {
    const input = page.locator(`#${id} input[type=checkbox]`);
    if (op === 'reset') await page.evaluate((i) => window.__sw.reset(i), id);
    else if (disabled)
      continue; // a disabled control cannot be operated; reset is the only op
    else if (op === 'click') await input.click();
    else {
      await input.focus();
      await page.keyboard.press('Space');
    }
    await settle(page);
  }
}

/** Entries, flags and the model/data-state agreement of both forms, for one comparison point. */
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const f = window.__sw.read('f');
    const b = window.__sw.read('bare');
    const control = document.querySelector('#f input[type=checkbox]') as HTMLInputElement;
    return {
      f,
      b,
      fQuery: window.__sw.query('f'),
      bQuery: window.__sw.query('bare'),
      // The switch's reported state (data-state) must follow the native input: a model that drifts
      // from the DOM is the reset bug.
      dataState: control.getAttribute('data-state'),
    };
  });
}

for (const kind of KINDS) {
  test.describe(`SJSwitch | ${kind} | form equals a bare input`, () => {
    for (const [fixtureName, props] of Object.entries(FORM_FIXTURES)) {
      for (const seq of OPS) {
        test(`form | ${kind} | ${fixtureName} | ${seq.name}`, async ({ page }) => {
          const errors = await open(page);
          await mountPair(page, kind, props);
          const disabled = props.disabled === true;
          const check = async (where: string) => {
            const s = await snapshot(page);
            expect(s.f, `${where}: input state`).toEqual(s.b);
            expect(s.fQuery, `${where}: submitted query`).toBe(s.bQuery);
            if (!disabled)
              expect(s.dataState, `${where}: data-state follows the input`).toBe(
                s.f.checked ? 'on' : 'off',
              );
          };
          await check('initial');
          for (const [i, op] of seq.ops.entries()) {
            await apply(page, op, disabled);
            await check(`after ${op} #${i + 1}`);
          }
          expect(errors).toEqual([]);
        });
      }
    }
  });
}

// Real submission: the browser itself serialises and navigates. The switch and the bare input are
// submitted in separate loads (a submit navigates away) and the query strings must be identical.
async function submitted(
  page: Page,
  kind: Kind,
  props: SwitchFixtureProps,
  ops: Op[],
  id: 'f' | 'bare',
) {
  await open(page);
  await mountPair(page, kind, props);
  for (const op of ops) {
    // Operate only the form under test, the other is irrelevant to this load.
    const input = page.locator(`#${id} input[type=checkbox]`);
    if (op === 'reset') await page.evaluate((i) => window.__sw.reset(i), id);
    else await input.click();
    await settle(page);
  }
  await Promise.all([
    page.waitForURL(/\/echo/),
    page.evaluate((i) => (document.getElementById(i) as HTMLFormElement).requestSubmit(), id),
  ]);
  return new URL(page.url()).search;
}

for (const kind of KINDS) {
  for (const [fixtureName, ops] of [
    ['on custom value', [] as Op[]],
    ['on custom value', ['click'] as Op[]],
    ['off custom value', ['click'] as Op[]],
    ['off custom value', ['click', 'reset'] as Op[]],
    ['on named', ['click', 'reset'] as Op[]],
    ['disabled on', [] as Op[]],
    ['no name on', [] as Op[]],
  ] as const) {
    test(`real submit | ${kind} | ${fixtureName} | ${ops.join(' ') || 'untouched'}`, async ({
      page,
    }) => {
      const props = FORM_FIXTURES[fixtureName]!;
      const withSwitch = await submitted(page, kind, props, [...ops], 'f');
      const bare = await submitted(page, kind, props, [...ops], 'bare');
      expect(withSwitch).toBe(bare);
    });
  }
}

// The comparison is only evidence if a divergent switch fails it. Seeded defects:
test.describe('seeded defects are reported', () => {
  test('a FACE-style hidden mirror input makes the submitted entries differ', async ({ page }) => {
    await open(page);
    await mountPair(page, 'react', FORM_FIXTURES['on named']!);
    await page.evaluate(() => {
      const mirror = document.createElement('input');
      mirror.type = 'hidden';
      mirror.name = 'alerts';
      mirror.value = 'on';
      document.getElementById('f')!.appendChild(mirror);
    });
    const s = await snapshot(page);
    expect(s.f.entries).not.toEqual(s.b.entries);
  });

  test('mirroring the live state into the checked attribute breaks reset equality', async ({
    page,
  }) => {
    await open(page);
    await mountPair(page, 'react', FORM_FIXTURES['off named']!);
    // The Vue bug: the framework writes `checked` as an ATTRIBUTE on every change.
    await page.evaluate(() => {
      const i = document.querySelector('#f input') as HTMLInputElement;
      i.addEventListener('change', () => i.toggleAttribute('checked', i.checked));
    });
    await apply(page, 'click', false);
    await apply(page, 'reset', false);
    const s = await snapshot(page);
    expect(s.f).not.toEqual(s.b);
  });

  test('a switch that does not follow reset leaves data-state out of step', async ({ page }) => {
    await open(page);
    await mountPair(page, 'vue', FORM_FIXTURES['off named']!);
    await apply(page, 'click', false);
    await page.evaluate(() => {
      const c = document.querySelector('#f input') as HTMLInputElement;
      c.setAttribute('data-state', 'on'); // what a model that ignored reset would still say
      window.__sw.reset('f');
    });
    await settle(page);
    // Only a corrected model repairs the attribute; force the stale value back to prove the check sees it.
    await page.evaluate(() =>
      (document.querySelector('#f input') as HTMLInputElement).setAttribute('data-state', 'on'),
    );
    const s = await snapshot(page);
    expect(s.dataState).not.toBe(s.f.checked ? 'on' : 'off');
  });
});

test.describe('label text is not part of form state', () => {
  test('the label never reaches the submitted entries', async ({ page }) => {
    await open(page);
    await mountPair(page, 'vanilla', { name: 'alerts', defaultChecked: true, label: LABEL });
    const s = await snapshot(page);
    expect(s.f.entries.flat().join()).not.toContain(LABEL);
  });
});
