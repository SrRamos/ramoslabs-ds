// Form participation (W1-C02.f, ADR-014, C02 row): the form state of an SJField > SJInput must be IDENTICAL to a
// bare native `<input>` / `<textarea>` in a real browser, in all three adapters (and the `<sj-form>` element), at
// every step of the same operation sequence, INCLUDING after `form.reset()`. "State" is what `new FormData(form)`
// submits, each control's value / defaultValue / `value` attribute / required / disabled / validity /
// `:invalid`, and for the real-submit cases the query string the browser actually navigates with. SJForm adds no
// handler, no `novalidate` and no FACE (ADR-014), so nothing here may differ from the native form.
// Harness-check titles (not matrix rows): they carry no `path=` suffix.
import { test, expect, type Page } from '@playwright/test';
import { ADAPTERS, LABEL, type Adapter, type FieldSpec, type Scene } from './fixtures';
import { expectedAttrs } from './matrix';
import { control, mountScene, openHost, settle } from './open';

const f = (name: string, kind: string, over: Partial<FieldSpec> = {}): FieldSpec => ({
  name,
  kind,
  label: `${name} label`,
  ...over,
});

const SCENES: Record<string, Scene> = {
  'defaults and required': {
    form: {},
    fields: [
      f('name', 'name', { value: 'Ada' }),
      f('email', 'email', { required: true }),
      f('note', 'text', { value: 'keep' }),
    ],
  },
  'textarea and password': {
    form: { enter: 'send' },
    // (A Vue textarea has no default-value channel: `value` is a DOM property there, so no default here.)
    fields: [f('street', 'address'), f('pw', 'password'), f('phone', 'phone')],
  },
  'disabled and plain form': {
    form: false,
    fields: [
      f('locked', 'text', { disabled: true, value: 'x' }),
      f('email', 'email', { value: 'a@b.co' }),
    ],
  },
};
const NAMES: Record<string, string[]> = {
  'defaults and required': ['name', 'email', 'note'],
  'textarea and password': ['street', 'pw', 'phone'],
  'disabled and plain form': ['email'],
};

type Op = 'fill' | 'clear' | 'reset' | 'retype';
const OPS: { name: string; ops: Op[] }[] = [
  { name: 'untouched', ops: [] },
  { name: 'fill', ops: ['fill'] },
  { name: 'reset untouched', ops: ['reset'] },
  { name: 'fill then reset', ops: ['fill', 'reset'] },
  { name: 'fill then reset then fill', ops: ['fill', 'reset', 'fill'] },
  { name: 'clear', ops: ['clear'] },
  { name: 'clear then reset', ops: ['clear', 'reset'] },
  { name: 'fill clear fill', ops: ['fill', 'clear', 'fill'] },
  { name: 'reset twice', ops: ['reset', 'reset'] },
  { name: 'retype after reset', ops: ['fill', 'reset', 'retype'] },
];

const FILL: Record<string, string> = {
  name: 'Grace Hopper',
  email: 'grace@example.com',
  note: 'a note',
  street: 'Calle 1\nApto 2',
  pw: 'p@ss word',
  phone: '+57 300 000 0000',
};

async function mountPair(page: Page, adapter: Adapter, name: string): Promise<string[]> {
  const scene = SCENES[name]!;
  await mountScene(page, adapter, scene);
  await page.evaluate(
    (specs) => window.__fl.bare(specs),
    scene.fields.map((s) => {
      const want = expectedAttrs(s.kind ?? 'text');
      return {
        name: s.name,
        type: want.type ?? 'text',
        label: s.label,
        textarea: want.tag === 'textarea',
        ...(s.value !== undefined && { value: s.value }),
        ...(s.required && { required: true }),
        ...(s.disabled && { disabled: true }),
      };
    }),
  );
  return NAMES[name]!;
}

async function apply(page: Page, op: Op, names: string[]): Promise<void> {
  for (const id of ['f', 'bare'] as const) {
    if (op === 'reset') {
      await page.evaluate((i) => window.__fl.reset(i), id);
      continue;
    }
    for (const n of names) {
      const c = page.locator(`#${id} [name="${n}"]`);
      if (op === 'fill') await c.fill(FILL[n]!);
      else if (op === 'clear') await c.fill('');
      else {
        await c.fill('');
        await c.pressSequentially('re', { delay: 5 });
      }
    }
  }
  await page.keyboard.press('Tab');
  await settle(page, 40);
}

const snapshot = (page: Page) =>
  page.evaluate(() => ({
    f: window.__fl.read('f'),
    b: window.__fl.read('bare'),
    fQuery: window.__fl.query('f'),
    bQuery: window.__fl.query('bare'),
  }));

for (const adapter of ADAPTERS) {
  for (const scene of Object.keys(SCENES)) {
    for (const seq of OPS) {
      test(`form | ${adapter} | ${scene} | ${seq.name} | state equals a bare native form`, async ({
        page,
      }) => {
        const errors = await openHost(page);
        const names = await mountPair(page, adapter, scene);
        // Only the controls the bare twin also has: a disabled control is read the same way on both.
        const live = names.filter(
          (n) => !SCENES[scene]!.fields.find((s) => s.name === n)?.disabled,
        );
        const check = async (why: string) => {
          const s = await snapshot(page);
          expect(s.f.entries, `${why}: entries`).toEqual(s.b.entries);
          expect(s.f.controls, `${why}: control state`).toEqual(s.b.controls);
          expect(s.fQuery, `${why}: query`).toBe(s.bQuery);
        };
        await check('mounted');
        for (const [i, op] of seq.ops.entries()) {
          await apply(page, op, live);
          await check(`step ${i + 1} (${op})`);
        }
        expect(errors).toEqual([]);
      });
    }

    test(`form | ${adapter} | ${scene} | a real submit carries what the bare form carries`, async ({
      page,
    }) => {
      await openHost(page);
      const names = await mountPair(page, adapter, scene);
      const live = names.filter((n) => !SCENES[scene]!.fields.find((s) => s.name === n)?.disabled);
      await apply(page, 'fill', live);
      const bare = await page.evaluate(() => window.__fl.query('bare'));
      // required fields are filled, so validation passes and the browser navigates.
      await Promise.all([page.waitForURL(/\/echo/), page.locator('#go').click()]);
      expect(new URL(page.url()).search).toBe(`?${bare}`);
    });
  }
}

test('form | the form is native: no handler, no novalidate, validation blocks submit with the browser message', async ({
  page,
}) => {
  for (const adapter of ADAPTERS) {
    await openHost(page);
    await mountScene(page, adapter, SCENES['defaults and required']!);
    const form = await page.locator('#f').evaluate((el: HTMLFormElement) => ({
      noValidate: el.noValidate,
      valid: el.checkValidity(),
      novalidate: el.hasAttribute('novalidate'),
    }));
    expect(form).toEqual({ noValidate: false, valid: false, novalidate: false });
    await page.locator('#go').click();
    await settle(page, 40);
    expect(page.url(), 'a required empty field blocks the native submit').not.toMatch(/\/echo/);
    expect(
      await control(page, 'email').evaluate((el: HTMLInputElement) => el.validationMessage),
    ).not.toBe('');
  }
});

test('form | <sj-form> custom elements: state equals a bare form after fill, reset and submit', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/host.html');
  await page.waitForFunction(() => window.__sj?.ready === true);
  await page.evaluate((label) => {
    document.getElementById('root')!.innerHTML =
      `<sj-form id="el" action="/echo" method="get">` +
      `<sj-field name="name" label="Name"><sj-input kind="name"></sj-input></sj-field>` +
      `<sj-field name="email" label="${label}" required><sj-input kind="email"></sj-input></sj-field>` +
      `<button type="submit" id="go">Send</button></sj-form>`;
  }, LABEL);
  await page.evaluate(() => window.__fl.defineElements());
  await page.evaluate(() =>
    window.__fl.bare([
      { name: 'name', type: 'text', label: 'Name' },
      { name: 'email', type: 'email', label: 'Email', required: true },
    ]),
  );
  const read = (form: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLFormElement;
      const controls = [...el.elements].filter(
        (e): e is HTMLInputElement => e instanceof HTMLInputElement,
      );
      return {
        entries: [...new FormData(el).entries()].map(([k, v]) => [k, String(v)]),
        controls: controls.map((c) => [c.name, c.value, c.required, c.validity.valueMissing]),
      };
    }, form);
  expect(await read('#el form')).toEqual(await read('#bare'));
  for (const id of ['#el form', '#bare']) {
    await page.locator(`${id} input[name="name"]`).fill('Ada');
    await page.locator(`${id} input[name="email"]`).fill('ada@example.com');
  }
  await page.keyboard.press('Tab');
  expect(await read('#el form')).toEqual(await read('#bare'));
  await page.evaluate(() => {
    (document.querySelector('#el form') as HTMLFormElement).reset();
    (document.querySelector('#bare') as HTMLFormElement).reset();
  });
  await settle(page, 40);
  expect(await read('#el form')).toEqual(await read('#bare'));
  for (const id of ['#el form']) {
    await page.locator(`${id} input[name="name"]`).fill('Ada');
    await page.locator(`${id} input[name="email"]`).fill('ada@example.com');
  }
  await Promise.all([page.waitForURL(/\/echo/), page.locator('#el #go').click()]);
  expect(new URL(page.url()).search).toBe('?name=Ada&email=ada%40example.com');
  expect(errors).toEqual([]);
});
