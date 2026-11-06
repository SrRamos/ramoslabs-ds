// L2 + L6 for SJField, SJInput and SJForm (W1-C02.f): every scenario of matrix.ts on 3 engines x 3 adapters x the
// executed supports paths (`native`, `fallback:all`), real browser input only (fill, Tab, click, Enter). Nothing
// is dispatched synthetically except `form.reset()`, which is the native method. The ADR-007 expectations come
// from `kinds.contract.json` (matrix.ts), not from the core table. Title (parsed by the parity matrix, W1-313):
// <component> | <adapter> | <scenario> | <action> | path=<path>
import { test, expect, type Page } from '@playwright/test';
import { injectionProblems } from '../../e2e/supports/injection';
import { isNoop, parsePath, type SupportsMap } from '../../e2e/supports/paths';
import { ADAPTERS, ERROR, HINT, LABEL, type Adapter, type FieldSpec, type Scene } from './fixtures';
import {
  INPUT_KINDS,
  expectedAttrs,
  expectedHints,
  fieldScenarios,
  matrixTitle,
  paths,
  type KindCtx,
  type Scenario,
} from './matrix';
import { control, mountScene, openHost, settle, updateScene } from './open';

// ---- builders -------------------------------------------------------------------------------------------
const f = (name: string, kind: string | undefined, over: Partial<FieldSpec> = {}): FieldSpec => ({
  name,
  ...(kind !== undefined && { kind }),
  label: `${name} label`,
  ...over,
});
const inForm = (fields: FieldSpec[], form: Extract<Scene['form'], object> = {}): Scene => ({
  form,
  fields,
});
const plain = (fields: FieldSpec[]): Scene => ({ form: false, fields });

interface Read {
  tag: string;
  type: string | null;
  inputmode: string | null;
  autocomplete: string | null;
  enterkeyhint: string | null;
  autocapitalize: string | null;
  autocorrect: string | null;
  spellcheck: string | null;
  maxlength: string | null;
  maxLength: number;
}

const readAttrs = (page: Page, name: string): Promise<Read> =>
  control(page, name).evaluate((el: HTMLInputElement | HTMLTextAreaElement) => ({
    tag: el.localName,
    type: el.getAttribute('type'),
    inputmode: el.getAttribute('inputmode'),
    autocomplete: el.getAttribute('autocomplete'),
    enterkeyhint: el.getAttribute('enterkeyhint'),
    autocapitalize: el.getAttribute('autocapitalize'),
    autocorrect: el.getAttribute('autocorrect'),
    spellcheck: el.getAttribute('spellcheck'),
    maxlength: el.getAttribute('maxlength'),
    maxLength: el.maxLength,
  }));

const matchesKind = (actual: Read, kind: string, ctx: KindCtx, why: string) => {
  const want = expectedAttrs(kind, ctx);
  expect(
    {
      tag: actual.tag,
      type: actual.type,
      inputmode: actual.inputmode,
      autocomplete: actual.autocomplete,
      enterkeyhint: actual.enterkeyhint,
      autocapitalize: actual.autocapitalize,
      autocorrect: actual.autocorrect,
      spellcheck: actual.spellcheck,
    },
    `${why} (${kind})`,
  ).toEqual(want);
  // ADR-007: never a maxlength; type=number only for quantity.
  expect(actual.maxlength, `${kind}: no maxlength attribute`).toBeNull();
  expect(actual.maxLength, `${kind}: no maxLength`).toBe(-1);
  if (actual.type === 'number') expect(kind).toBe('quantity');
};

const hintsOf = (page: Page, names: string[]) =>
  Promise.all(names.map((n) => control(page, n).getAttribute('enterkeyhint')));
const domOrder = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#f input, #f textarea')].map(
      (e) => (e as HTMLInputElement).name,
    ),
  );

async function seenSupports(page: Page): Promise<SupportsMap | null> {
  return page.evaluate(() => window.__sj.seen as SupportsMap | null);
}

/** The visible invalid paint of a control: the border is twice as thick and error-coloured (input.css). */
async function paint(page: Page, name: string) {
  return control(page, name).evaluate((el: HTMLInputElement) => {
    const s = getComputedStyle(el);
    const safe = (sel: string) => {
      try {
        return el.matches(sel);
      } catch {
        return false;
      }
    };
    return {
      width: parseFloat(s.borderTopWidth),
      color: s.borderTopColor,
      touched: el.getAttribute('data-touched'),
      userInvalid: safe(':user-invalid'),
      fallbackRule: safe('[data-touched]:invalid'),
      invalid: safe(':invalid'),
      ariaInvalid: el.getAttribute('aria-invalid'),
    };
  });
}
type Paint = Awaited<ReturnType<typeof paint>>;
const shown = (p: Paint, rest: Paint) => p.width > rest.width && p.color !== rest.color;

const ec = (page: Page) => page.locator('#f');
const live = (page: Page) => page.evaluate(() => [...window.__fl.log]);
const wait = (page: Page, ms: number) =>
  page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

type Ctx = { page: Page; adapter: Adapter; path: string; browserName: string };
type Run = (c: Ctx) => Promise<void>;

const userInvalidScene = (): Scene =>
  inForm([f('email', 'email', { label: LABEL, required: true }), f('name', 'name')]);

/** Whether the touched fallback is the mechanism on this run: the runtime's userInvalid support is false. */
const fallbackRuns = async (page: Page): Promise<boolean> =>
  (await seenSupports(page))!.userInvalid !== true;

const RUN: Record<string, Run> = {
  async kinds({ page, adapter, path }) {
    await mountScene(page, adapter, plain(INPUT_KINDS.map((k) => f(`k-${k}`, k))), path);
    for (const k of INPUT_KINDS) matchesKind(await readAttrs(page, `k-${k}`), k, {}, 'kind row');
    // A textarea only for the textarea kind, and no `type` attribute on it.
    expect(await page.locator('#f textarea').count()).toBe(1);
    expect(await readAttrs(page, 'k-address').then((r) => r.tag)).toBe('textarea');
    // Identifiers are never spinbuttons: only `quantity` is type=number.
    const numbers = await page
      .locator('#f input[type=number]')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name));
    expect(numbers).toEqual(['k-quantity']);
  },

  async 'kind-flags'({ page, adapter, path }) {
    const cases: [string, Partial<FieldSpec>][] = [
      ['quantity', { variant: 'text' }],
      ['quantity', {}],
      ['country', {}],
      ['country', { variant: 'text' }],
      ['postal', { digits: false }],
      ['postal', {}],
      ['reference', { autocomplete: 'postal-code' }],
      ['account', { digits: false }],
      ['tax-id', { digits: true }],
      ['tax-id', {}],
      ['email', { section: 'billing' }],
      ['name', { autocomplete: 'given-name' }],
      ['name', { autocomplete: 'bogus' }],
      ['phone', { autocomplete: 'tel-national' }],
      ['url', { meaningful: true }],
      ['url', {}],
      ['amount', { meaningful: true }],
      ['amount-signed', {}],
      ['otp-alnum', { uppercase: true }],
      ['otp-alnum', {}],
      ['text', { autocomplete: 'organization' }],
      ['cc-exp', {}],
      ['address-line', {}],
    ];
    await mountScene(page, adapter, plain(cases.map(([k, o], i) => f(`c${i}`, k, o))), path);
    for (const [i, [kind, o]] of cases.entries()) {
      const ctx: KindCtx = {
        ...(o.variant && { variant: o.variant }),
        ...(o.autocomplete !== undefined && { autocomplete: o.autocomplete }),
        ...(o.section && { section: o.section }),
        ...(o.meaningful && { meaningful: true }),
        ...(o.digits !== undefined && { digits: o.digits }),
        ...(o.uppercase && { uppercase: true }),
      };
      matchesKind(await readAttrs(page, `c${i}`), kind, ctx, JSON.stringify(o));
    }
    // quantity is the one number control, and only in its default variant.
    expect(await readAttrs(page, 'c0').then((r) => r.type)).toBe('text');
    expect(await readAttrs(page, 'c1').then((r) => r.type)).toBe('number');
  },

  async hints({ page, adapter, path }) {
    const kinds = ['name', 'email', 'url', 'search', 'otp', 'cc-csc', 'phone'];
    await mountScene(page, adapter, inForm(kinds.map((k) => f(k, k))), path);
    expect(await hintsOf(page, kinds)).toEqual(expectedHints(kinds));
    // The last editable field submits (`go`), every earlier position kind is `next`; fixed kinds keep theirs.
    expect(await hintsOf(page, kinds)).toEqual([
      'next',
      'next',
      'go',
      'search',
      'done',
      'done',
      'go',
    ]);
  },

  async 'hints-send-search'({ page, adapter, path }) {
    const kinds = ['name', 'email'];
    const fields = kinds.map((k) => f(k, k));
    for (const form of [
      { enter: 'send' as const },
      { enter: 'search' as const },
      { enter: 'go' as const },
      { submits: false },
      { submits: true },
    ]) {
      await mountScene(page, adapter, inForm(fields, form), path);
      expect(await hintsOf(page, kinds), JSON.stringify(form)).toEqual(expectedHints(kinds, form));
    }
    await mountScene(page, adapter, inForm(fields, { submits: false }), path);
    expect(await hintsOf(page, kinds)).toEqual(['next', 'done']);
    await mountScene(page, adapter, inForm(fields, { enter: 'send' }), path);
    expect(await hintsOf(page, kinds)).toEqual(['next', 'send']);
  },

  async 'hints-textarea'({ page, adapter, path }) {
    for (const kinds of [
      ['name', 'address', 'email'],
      ['name', 'email', 'address'],
      ['address'],
      ['address', 'name'],
    ]) {
      await mountScene(page, adapter, inForm(kinds.map((k) => f(k, k))), path);
      const got = await hintsOf(page, kinds);
      expect(got, kinds.join()).toEqual(expectedHints(kinds));
      expect(got[kinds.indexOf('address')]).toBe('enter');
      // The textarea never takes the `go` position away from the last editable field.
      const lastEditable = kinds.map((k) => k !== 'address').lastIndexOf(true);
      if (lastEditable >= 0) expect(got[lastEditable]).toBe('go');
    }
  },

  async 'hints-late'({ page, adapter, path }) {
    const name = f('name', 'name');
    const email = f('email', 'email');
    const phone = f('phone', 'phone');
    await mountScene(page, adapter, inForm([name, email]), path);
    expect(await hintsOf(page, ['name', 'email'])).toEqual(['next', 'go']);
    await updateScene(page, inForm([name, email, phone]));
    expect(await hintsOf(page, ['name', 'email', 'phone'])).toEqual(['next', 'next', 'go']);
    // Late in the middle of the DOM, not just at the end.
    const url = f('site', 'url');
    await updateScene(page, inForm([name, url, email, phone]));
    expect(await domOrder(page)).toEqual(['name', 'site', 'email', 'phone']);
    expect(await hintsOf(page, ['name', 'site', 'email', 'phone'])).toEqual(
      expectedHints(['name', 'url', 'email', 'phone']),
    );
    // A late textarea does not move the Enter position.
    await updateScene(page, inForm([name, email, phone, f('street', 'address')]));
    expect(await hintsOf(page, ['name', 'email', 'phone', 'street'])).toEqual([
      'next',
      'next',
      'go',
      'enter',
    ]);
    // And the field that leaves gives the position back.
    await updateScene(page, inForm([name, email]));
    expect(await hintsOf(page, ['name', 'email'])).toEqual(['next', 'go']);
  },

  async 'hints-reorder'({ page, adapter, path }) {
    const a = f('name', 'name');
    const b = f('email', 'email');
    const c = f('phone', 'phone');
    const d = f('street', 'address');
    await mountScene(page, adapter, inForm([a, b, c, d]), path);
    expect(await hintsOf(page, ['name', 'email', 'phone', 'street'])).toEqual([
      'next',
      'next',
      'go',
      'enter',
    ]);
    for (const order of [
      [c, a, b, d],
      [d, b, c, a],
      [b, d, a, c],
      [a, b, c, d],
    ]) {
      await updateScene(page, inForm(order));
      const names = order.map((x) => x.name);
      expect(await domOrder(page), 'the DOM follows the new order').toEqual(names);
      expect(await hintsOf(page, names), names.join()).toEqual(
        expectedHints(order.map((x) => x.kind!)),
      );
    }
  },

  async 'hints-data-first'({ page, adapter, path }) {
    const name = f('name', 'name');
    const email = f('email', 'email');
    const street = f('street', 'address');
    // The data-first list is the order the owner uses, whatever the registration order.
    await mountScene(
      page,
      adapter,
      inForm([name, email, street], {
        fields: [
          { key: 'name', kind: 'name' },
          { key: 'email', kind: 'email' },
          { key: 'street', kind: 'address' },
        ],
      }),
      path,
    );
    expect(await hintsOf(page, ['name', 'email', 'street'])).toEqual(['next', 'go', 'enter']);
    await mountScene(
      page,
      adapter,
      inForm([email, name], {
        fields: [
          { key: 'name', kind: 'name' },
          { key: 'email', kind: 'email' },
        ],
      }),
      path,
    );
    expect(await domOrder(page)).toEqual(['email', 'name']);
    expect(await hintsOf(page, ['name', 'email'])).toEqual(['next', 'go']);
  },

  async 'otp-owner'({ page, adapter, path }) {
    const cases: { form: Extract<Scene['form'], object>; own?: boolean; want: string }[] = [
      { form: { autoSubmit: true }, own: false, want: 'go' },
      { form: { autoSubmit: true }, want: 'go' },
      { form: { autoSubmit: false }, own: true, want: 'done' },
      { form: {}, own: true, want: 'done' },
      { form: {}, want: 'done' },
    ];
    for (const c of cases) {
      await mountScene(
        page,
        adapter,
        inForm(
          [f('email', 'email'), f('code', 'otp', c.own !== undefined ? { autoSubmit: c.own } : {})],
          c.form,
        ),
        path,
      );
      const got = await readAttrs(page, 'code');
      expect(got.enterkeyhint, JSON.stringify(c)).toBe(c.want);
      matchesKind(got, 'otp', { autoSubmit: c.want === 'go' }, JSON.stringify(c));
      expect(await readAttrs(page, 'email').then((r) => r.enterkeyhint)).toBe('next');
    }
    // otp-alnum follows the same owner rule.
    await mountScene(
      page,
      adapter,
      inForm([f('code', 'otp-alnum', { autoSubmit: false })], { autoSubmit: true }),
      path,
    );
    expect(await readAttrs(page, 'code').then((r) => r.enterkeyhint)).toBe('go');
  },

  async 'otp-standalone'({ page, adapter, path }) {
    await mountScene(
      page,
      adapter,
      plain([
        f('bare-on', 'otp', { autoSubmit: true, standalone: true }),
        f('field-on', 'otp', { autoSubmit: true }),
        f('field-off', 'otp'),
        f('bare-off', 'otp', { standalone: true }),
      ]),
      path,
    );
    const got = await Promise.all(
      ['bare-on', 'field-on', 'field-off', 'bare-off'].map((n) =>
        readAttrs(page, n).then((r) => r.enterkeyhint),
      ),
    );
    expect(got).toEqual(['go', 'go', 'done', 'done']);
  },

  async 'form-native'({ page, adapter, path }) {
    // `action` is a native URL here, and it collides in name with the old Enter-label prop: it must reach the
    // <form> untouched and must not become the label; the label is the `enter` prop.
    await mountScene(
      page,
      adapter,
      inForm([f('name', 'name'), f('q', 'email')], {
        enter: 'search',
        action: 'send',
        method: 'get',
      }),
      path,
    );
    const form = await ec(page).evaluate((el: HTMLFormElement) => ({
      action: el.getAttribute('action'),
      method: el.getAttribute('method'),
      enter: el.getAttribute('enter'),
      novalidate: el.hasAttribute('novalidate'),
      cls: el.getAttribute('class'),
      part: el.getAttribute('data-part'),
      tag: el.localName,
    }));
    expect(form).toEqual({
      action: 'send',
      method: 'get',
      enter: null,
      novalidate: false,
      cls: 'sj-form__root',
      part: 'root',
      tag: 'form',
    });
    expect(await hintsOf(page, ['name', 'q'])).toEqual(['next', 'search']);
    // The other way round: a label that looks like a URL, a URL that looks like a label.
    await mountScene(
      page,
      adapter,
      inForm([f('name', 'name'), f('q', 'email')], { enter: 'send', action: 'search' }),
      path,
    );
    expect(await ec(page).getAttribute('action')).toBe('search');
    expect(await hintsOf(page, ['name', 'q'])).toEqual(['next', 'send']);
  },

  async 'form-enter-submits'({ page, adapter, path }) {
    await mountScene(page, adapter, inForm([f('name', 'name'), f('email', 'email')]), path);
    await control(page, 'name').fill('Ada Lovelace');
    await control(page, 'email').fill('ada@example.com');
    await control(page, 'email').focus();
    await Promise.all([page.waitForURL(/\/echo/), page.keyboard.press('Enter')]);
    expect(new URL(page.url()).search).toBe('?name=Ada+Lovelace&email=ada%40example.com');
  },

  async 'form-state'({ page, adapter, path }) {
    const scene = formStateScene();
    await mountScene(page, adapter, scene, path);
    await bareTwin(page, scene);
    expect(await snapshot(page), 'untouched').toEqual(await snapshotBare(page));
    for (const [n, v] of VALUES) {
      await control(page, n).fill(v);
      await page.locator(`#bare [name="${n}"]`).fill(v);
    }
    await page.keyboard.press('Tab');
    await settle(page);
    const sj = await snapshot(page);
    expect(sj, 'filled').toEqual(await snapshotBare(page));
    expect(sj.entries.map((e) => e[0])).toEqual(['name', 'email', 'phone', 'street', 'pw']);
    const q = await page.evaluate(() => window.__fl.query('bare'));
    expect(await page.evaluate(() => window.__fl.query('f'))).toBe(q);
    await Promise.all([page.waitForURL(/\/echo/), page.locator('#go').click()]);
    expect(new URL(page.url()).search).toBe(`?${q}`);
  },

  async 'form-reset'({ page, adapter, path }) {
    const scene = formStateScene();
    await mountScene(page, adapter, scene, path);
    await bareTwin(page, scene);
    const fill = async (n: string, v: string) => {
      await control(page, n).fill(v);
      await page.locator(`#bare [name="${n}"]`).fill(v);
    };
    const reset = () => page.evaluate(() => (window.__fl.reset('f'), window.__fl.reset('bare')));
    const check = async (why: string) => {
      await settle(page, 40);
      expect(await snapshot(page), why).toEqual(await snapshotBare(page));
    };
    await reset();
    await check('reset untouched');
    await fill('name', 'Grace');
    await fill('email', 'grace@example.com');
    await check('filled');
    await reset();
    await check('reset after fill');
    const afterReset = await snapshot(page);
    expect(afterReset.controls.find((c) => c.name === 'name')?.value).toBe('Ada');
    expect(afterReset.controls.find((c) => c.name === 'email')?.value).toBe('');
    await fill('street', 'Line 1\nLine 2');
    await reset();
    await reset();
    await check('reset twice');
    await fill('pw', 'secret');
    await check('fill after reset');
    await reset();
    await check('reset after fill after reset');
  },

  async 'uv-tab-through'({ page, adapter, path }) {
    await mountScene(page, adapter, userInvalidScene(), path);
    const rest = await paint(page, 'email');
    await control(page, 'email').focus();
    await page.keyboard.press('Tab'); // out of an empty required field, never edited
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    const after = await paint(page, 'email');
    expect(after.invalid, 'the empty required field is invalid').toBe(true);
    expect(shown(after, rest), 'no error on a field the user only tabbed through').toBe(false);
    expect(after.touched).toBeNull();
    expect(after.userInvalid).toBe(false);
    expect(after.ariaInvalid).toBeNull();
  },

  async 'uv-change'({ page, adapter, path }) {
    await mountScene(page, adapter, userInvalidScene(), path);
    const rest = await paint(page, 'email');
    await control(page, 'email').fill('not-an-email');
    await page.keyboard.press('Tab'); // blur commits the change
    await settle(page, 40);
    const after = await paint(page, 'email');
    expect(shown(after, rest), 'the error appears after a change').toBe(true);
    expect(after.invalid).toBe(true);
    await expectMechanism(page, after);
  },

  async 'uv-submit'({ page, adapter, path }) {
    await mountScene(page, adapter, userInvalidScene(), path);
    const rest = await paint(page, 'email');
    await page.locator('#go').click(); // blocked by validation: `invalid` fires on the empty required field
    await settle(page, 40);
    expect(page.url()).not.toMatch(/\/echo/);
    const after = await paint(page, 'email');
    expect(shown(after, rest), 'the error appears after a submit attempt').toBe(true);
    await expectMechanism(page, after);
  },

  async 'uv-reset'({ page, adapter, path }) {
    await mountScene(page, adapter, userInvalidScene(), path);
    const rest = await paint(page, 'email');
    // After a change.
    await control(page, 'email').fill('not-an-email');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    expect(shown(await paint(page, 'email'), rest)).toBe(true);
    await page.evaluate(() => window.__fl.reset('f'));
    await settle(page, 60);
    const cleared = await paint(page, 'email');
    expect(shown(cleared, rest), 'reset clears the error after a change').toBe(false);
    expect(cleared.touched).toBeNull();
    // After a failed submit.
    await page.locator('#go').click();
    await settle(page, 40);
    expect(shown(await paint(page, 'email'), rest)).toBe(true);
    await page.evaluate(() => window.__fl.reset('f'));
    await settle(page, 60);
    const again = await paint(page, 'email');
    expect(shown(again, rest), 'reset clears the error after a submit attempt').toBe(false);
    expect(again.touched).toBeNull();
    // The cleared field can show the error again.
    await control(page, 'email').fill('x');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    expect(shown(await paint(page, 'email'), rest)).toBe(true);
  },

  async 'uv-code-path'({ page, adapter, path }) {
    await mountScene(page, adapter, userInvalidScene(), path);
    const real = await page.evaluate(() => window.__sj.real as SupportsMap);
    const seen = await seenSupports(page);
    expect(injectionProblems(real, seen, parsePath(path))).toEqual([]);
    // `native` hands the component real detection, `fallback:all` hands it false.
    expect(seen!.userInvalid).toBe(path === 'native' ? real.userInvalid : false);
    if (path !== 'native')
      expect(isNoop(real, parsePath(path)), 'forced-false is not a no-op here').toBe(
        real.userInvalid === false,
      );
    await control(page, 'email').fill('not-an-email');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    const p = await paint(page, 'email');
    if (seen!.userInvalid) {
      // Native path: the browser's :user-invalid does the work; the touched state is never involved.
      expect(p.touched, 'native path sets no data-touched').toBeNull();
      expect(p.userInvalid).toBe(true);
    } else {
      // Fallback path: the component's own touched state, the [data-touched]:invalid rule.
      expect(p.touched, 'fallback path sets data-touched').toBe('true');
      expect(p.fallbackRule).toBe(true);
    }
  },

  async 'retain-offered'({ page, adapter, path }) {
    await mountScene(page, adapter, retentionScene(), path);
    await control(page, 'email').fill('ada@example.com');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    const read = (n: string) =>
      page.evaluate(
        (k) => ({ prior: window.__fl.fields[k]!.prior(), offers: window.__fl.fields[k]!.offers() }),
        n,
      );
    expect(await read('email')).toEqual({ prior: 'ada@example.com', offers: [] });
    expect(await read('billing')).toEqual({ prior: undefined, offers: ['ada@example.com'] });
    await control(page, 'billing').fill('pay@example.com');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    expect(await read('email')).toEqual({ prior: 'ada@example.com', offers: ['pay@example.com'] });
    expect(await read('billing')).toEqual({
      prior: 'pay@example.com',
      offers: ['ada@example.com'],
    });
    // The same value under two keys is offered once.
    await control(page, 'other').fill('ada@example.com');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    expect((await read('billing')).offers).toEqual(['ada@example.com']);
  },

  async 'retain-secrets'({ page, adapter, path }) {
    await mountScene(page, adapter, retentionScene(), path);
    for (const [n, v] of [
      ['pw', 'hunter2-secret'],
      ['code', '123456'],
      ['csc', '987'],
    ] as const) {
      await control(page, n).fill(v);
      await page.keyboard.press('Tab');
    }
    await control(page, 'email').fill('ada@example.com');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    const all = await page.evaluate(() =>
      Object.entries(window.__fl.fields).map(([k, p]) => ({
        k,
        prior: p.prior(),
        offers: p.offers(),
      })),
    );
    for (const { k, prior, offers } of all) {
      expect(JSON.stringify(offers), `${k} is offered no secret`).not.toMatch(/hunter2|123456|987/);
      if (['pw', 'code', 'csc'].includes(k))
        expect(prior, `${k} is never retained`).toBeUndefined();
    }
    expect(all.find((a) => a.k === 'billing')!.offers).toEqual(['ada@example.com']);
  },

  async 'retain-tab-through'({ page, adapter, path }) {
    await mountScene(page, adapter, retentionScene(), path);
    await control(page, 'email').fill('ada@example.com');
    await page.keyboard.press('Tab');
    await settle(page, 40);
    // Tab through every field, forward and back, without editing anything.
    await control(page, 'email').focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+Tab');
    await settle(page, 40);
    const after = await page.evaluate(() => ({
      value: (document.querySelector('[name=email]') as HTMLInputElement).value,
      prior: window.__fl.fields['email']!.prior(),
      offers: window.__fl.fields['billing']!.offers(),
      emptyOffered: Object.values(window.__fl.fields).some((p) => p.offers().includes('')),
    }));
    expect(after.value).toBe('ada@example.com');
    expect(after.prior).toBe('ada@example.com');
    expect(after.offers).toEqual(['ada@example.com']);
    expect(after.emptyOffered, 'a tab-through retains no empty value').toBe(false);
  },

  async 'announce-once'({ page, adapter, path }) {
    // Silent at mount, with and without a standing error; the region exists before any text.
    await mountScene(page, adapter, plain([f('email', 'email', { error: ERROR })]), path);
    await wait(page, 300);
    expect(await live(page), 'a standing error at mount is silent').toEqual([]);
    expect(await page.locator('body > [role="status"]').count()).toBe(1);
    expect(await page.locator('body > [role="status"]').textContent()).toBe('');
    await mountScene(page, adapter, plain([f('email', 'email')]), path);
    await page.evaluate(() => (window.__fl.log.length = 0));
    await updateScene(page, plain([f('email', 'email', { error: ERROR })]));
    await wait(page, 300);
    expect(await live(page), 'announced exactly once on the transition').toEqual([ERROR]);
    // Re-rendering with the same error says nothing more; the error element is not itself a live region.
    await updateScene(page, plain([f('email', 'email', { error: ERROR })]));
    await updateScene(page, plain([f('email', 'email', { error: ERROR, hint: HINT })]));
    await wait(page, 300);
    expect(await live(page)).toEqual([ERROR]);
    const err = page.locator('#f .sj-field__error');
    expect(await err.getAttribute('role')).toBeNull();
    expect(await err.getAttribute('aria-live')).toBeNull();
    expect(await page.locator('#f [role=alert], #f [role=status], #f [aria-live]').count()).toBe(0);
  },

  async 'announce-repeat'({ page, adapter, path }) {
    await mountScene(page, adapter, plain([f('email', 'email')]), path);
    await updateScene(page, plain([f('email', 'email', { error: 'First problem' })]));
    await wait(page, 300);
    await updateScene(page, plain([f('email', 'email', { error: 'Second problem' })]));
    await wait(page, 300);
    expect(await live(page), 'a changed text announces').toEqual([
      'First problem',
      'Second problem',
    ]);
    // Cleared, then the same text again once the registry's dedupe window has passed.
    await updateScene(page, plain([f('email', 'email')]));
    await wait(page, 1300);
    await updateScene(page, plain([f('email', 'email', { error: 'Second problem' })]));
    await wait(page, 300);
    expect(await live(page)).toEqual(['First problem', 'Second problem', 'Second problem']);
  },

  async 'announce-icon'({ page, adapter, path }) {
    await mountScene(
      page,
      adapter,
      plain([f('email', 'email', { label: LABEL, error: ERROR })]),
      path,
    );
    const icon = page.locator('#f .sj-field__error [data-part="icon"]');
    expect(await icon.getAttribute('aria-hidden')).toBe('true');
    expect(await icon.locator('svg').getAttribute('aria-hidden')).toBe('true');
    expect(await icon.locator('svg').getAttribute('role')).toBeNull();
    expect(await icon.textContent()).toBe('');
    const err = page.locator('#f .sj-field__error');
    expect((await err.textContent())!.trim()).toBe(ERROR);
    // The description is the words and nothing else: no "!" marker, no icon name.
    await expect(control(page, 'email')).toHaveAccessibleDescription(ERROR);
    const desc = await control(page, 'email').evaluate((el) =>
      (el.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim(),
    );
    expect(desc).toBe(ERROR);
    expect(desc).not.toContain('!');
    // No generated content anywhere in the error part.
    const content = await page.evaluate(() =>
      ['.sj-field__error', '.sj-field__icon'].flatMap((sel) =>
        ['::before', '::after'].map(
          (pseudo) => getComputedStyle(document.querySelector(sel)!, pseudo).content,
        ),
      ),
    );
    for (const c of content) expect(['none', 'normal']).toContain(c);
  },

  async 'announce-limit'({ page, adapter, path }) {
    // KNOWN LIMIT (C02 a1 SHOULD-2): the registry holds one pending text per role, so two fields whose errors
    // appear in the same commit speak only the last one. The consumer provides a summary or moves focus.
    const quiet = [f('email', 'email'), f('name', 'name')];
    await mountScene(page, adapter, plain(quiet), path);
    await page.evaluate(() => (window.__fl.log.length = 0));
    await updateScene(
      page,
      plain([f('email', 'email', { error: 'Error A' }), f('name', 'name', { error: 'Error B' })]),
    );
    await wait(page, 300);
    const spoken = await live(page);
    expect(spoken).toHaveLength(1);
    expect(['Error A', 'Error B']).toContain(spoken[0]);
    // Both messages are still visible text and both fields are described by their own error.
    expect(await page.locator('#f .sj-field__error').allTextContents()).toEqual([
      'Error A',
      'Error B',
    ]);
    for (const n of ['email', 'name'])
      expect(await control(page, n).getAttribute('aria-invalid')).toBe('true');
    // One change at a time each announce.
    await updateScene(page, plain(quiet));
    await wait(page, 1300);
    await page.evaluate(() => (window.__fl.log.length = 0));
    await updateScene(page, plain([f('email', 'email', { error: 'Error A' }), f('name', 'name')]));
    await wait(page, 300);
    await updateScene(
      page,
      plain([f('email', 'email', { error: 'Error A' }), f('name', 'name', { error: 'Error B' })]),
    );
    await wait(page, 300);
    expect(await live(page)).toEqual(['Error A', 'Error B']);
  },

  async 'field-ids'({ page, adapter, path }) {
    await mountScene(
      page,
      adapter,
      plain([
        f('full', 'email', { label: LABEL, hint: HINT, error: ERROR, required: true }),
        f('bare', 'email', { label: 'Plain label' }),
      ]),
      path,
    );
    const ids = await control(page, 'full').evaluate((el: HTMLInputElement) => {
      const root = el.closest('.sj-field__root')!;
      const part = (p: string) => root.querySelector(`:scope > [data-part="${p}"]`);
      return {
        id: el.id,
        labelFor: part('label')?.getAttribute('for'),
        labelId: part('label')?.id,
        hintId: part('hint')?.id,
        errorId: part('error')?.id,
        describedby: el.getAttribute('aria-describedby'),
        invalid: el.getAttribute('aria-invalid'),
        labelledby: el.getAttribute('aria-labelledby'),
        ariaRequired: el.getAttribute('aria-required'),
        required: el.required,
      };
    });
    expect(ids.id).toBeTruthy();
    expect(ids.labelFor).toBe(ids.id);
    expect(ids.labelId).toBe(`${ids.id}-label`);
    expect(ids.hintId).toBe(`${ids.id}-hint`);
    expect(ids.errorId).toBe(`${ids.id}-error`);
    expect(ids.describedby).toBe(`${ids.id}-hint ${ids.id}-error`);
    expect(ids.invalid).toBe('true');
    expect(ids.labelledby, 'the native label names the control').toBeNull();
    expect(ids.ariaRequired, 'native required, no aria-required').toBeNull();
    expect(ids.required).toBe(true);
    await expect(control(page, 'full')).toHaveAccessibleName(LABEL);
    // A field with no hint and no error references nothing and is not invalid.
    const bare = await control(page, 'bare').evaluate((el) => ({
      describedby: el.getAttribute('aria-describedby'),
      invalid: el.getAttribute('aria-invalid'),
      hint: !!el.closest('.sj-field__root')!.querySelector('[data-part="hint"]'),
      error: !!el.closest('.sj-field__root')!.querySelector('[data-part="error"]'),
    }));
    expect(bare).toEqual({ describedby: null, invalid: null, hint: false, error: false });
    // Every IDREF resolves, and the ids of the two fields are distinct.
    const all = await page.evaluate(() =>
      [...document.querySelectorAll('#f [id]')].map((e) => e.id),
    );
    expect(new Set(all).size).toBe(all.length);
  },

  async 'field-invalid'({ page, adapter, path }) {
    const at = () =>
      control(page, 'email').evaluate((el) => ({
        invalid: el.getAttribute('aria-invalid'),
        describedby: el.getAttribute('aria-describedby'),
        error: !!el.closest('.sj-field__root')!.querySelector('[data-part="error"]'),
      }));
    await mountScene(page, adapter, plain([f('email', 'email')]), path);
    expect(await at()).toEqual({ invalid: null, describedby: null, error: false });
    await updateScene(page, plain([f('email', 'email', { error: ERROR })]));
    const on = await at();
    expect(on.invalid).toBe('true');
    expect(on.error).toBe(true);
    expect(on.describedby).toMatch(/-error$/);
    // Whitespace is not an error.
    await updateScene(page, plain([f('email', 'email', { error: '   ' })]));
    expect(await at()).toEqual({ invalid: null, describedby: null, error: false });
    await updateScene(page, plain([f('email', 'email', { error: ERROR })]));
    await updateScene(page, plain([f('email', 'email')]));
    const off = await at();
    expect(off).toEqual({ invalid: null, describedby: null, error: false });
    // Never the string "false".
    expect(await page.locator('#f [aria-invalid="false"]').count()).toBe(0);
  },

  async 'field-errormessage'({ page, adapter, path }) {
    const am = () =>
      control(page, 'email').evaluate((el) => ({
        errormessage: el.getAttribute('aria-errormessage'),
        invalid: el.getAttribute('aria-invalid'),
        id: el.id,
      }));
    await mountScene(page, adapter, plain([f('email', 'email', { error: ERROR })]), path);
    expect((await am()).errormessage, 'off by default').toBeNull();
    await updateScene(page, plain([f('email', 'email', { error: ERROR, errorMessage: true })]));
    const on = await am();
    expect(on.errormessage).toBe(`${on.id}-error`);
    expect(on.invalid).toBe('true');
    expect(await page.locator(`[id="${on.id}-error"]`).count()).toBe(1);
    await updateScene(page, plain([f('email', 'email', { errorMessage: true })]));
    expect((await am()).errormessage, 'only while invalid').toBeNull();
  },

  async 'field-native'({ page, adapter, path }) {
    await mountScene(
      page,
      adapter,
      plain([
        f('req', 'text', { required: true }),
        f('off', 'text', { disabled: true }),
        f('alone', 'text', { standalone: true, required: true }),
        f('alone-off', 'text', { standalone: true, disabled: true }),
        f('plain', 'text'),
      ]),
      path,
    );
    const at = (n: string) =>
      control(page, n).evaluate((el: HTMLInputElement) => ({
        name: el.getAttribute('name'),
        required: el.hasAttribute('required'),
        disabled: el.hasAttribute('disabled'),
        ariaRequired: el.getAttribute('aria-required'),
        ariaDisabled: el.getAttribute('aria-disabled'),
      }));
    expect(await at('req')).toEqual({
      name: 'req',
      required: true,
      disabled: false,
      ariaRequired: null,
      ariaDisabled: null,
    });
    expect(await at('off')).toEqual({
      name: 'off',
      required: false,
      disabled: true,
      ariaRequired: null,
      ariaDisabled: null,
    });
    expect(await at('alone')).toEqual({
      name: 'alone',
      required: true,
      disabled: false,
      ariaRequired: null,
      ariaDisabled: null,
    });
    expect(await at('alone-off')).toEqual({
      name: 'alone-off',
      required: false,
      disabled: true,
      ariaRequired: null,
      ariaDisabled: null,
    });
    expect(await at('plain')).toEqual({
      name: 'plain',
      required: false,
      disabled: false,
      ariaRequired: null,
      ariaDisabled: null,
    });
    // A disabled control is not focusable and is left out of the submission.
    expect(await control(page, 'off').isDisabled()).toBe(true);
    await control(page, 'req').fill('v');
    expect(await page.evaluate(() => window.__fl.query('f'))).toBe('req=v&alone=&plain=');
  },
};

// ---- shared pieces ---------------------------------------------------------------------------------------
const VALUES: [string, string][] = [
  ['name', 'Grace Hopper'],
  ['email', 'grace@example.com'],
  ['phone', '+57 300 000 0000'],
  ['street', 'Calle 1\nApto 2'],
  ['pw', 'p@ss word'],
];

function formStateScene(): Scene {
  return inForm([
    f('name', 'name', { value: 'Ada' }),
    f('email', 'email', { required: true }),
    f('phone', 'phone'),
    f('street', 'address'),
    f('pw', 'password'),
    f('locked', 'text', { disabled: true, value: 'x' }),
  ]);
}

/** A bare native twin of a scene: the same names, defaults, required and disabled, types from the contract. */
async function bareTwin(page: Page, scene: Scene): Promise<void> {
  const specs = scene.fields.map((s) => {
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
  });
  await page.evaluate((s) => window.__fl.bare(s), specs);
}

/** What a form would submit and each control's value state; the comparison drops nothing but the type. */
const snapshotOf = (formId: 'f' | 'bare') => (page: Page) =>
  page.evaluate((id) => {
    const r = window.__fl.read(id);
    return { entries: r.entries, controls: r.controls, query: window.__fl.query(id) };
  }, formId);
const snapshot = snapshotOf('f');
const snapshotBare = snapshotOf('bare');

function retentionScene(): Scene {
  return inForm([
    f('email', 'email'),
    f('billing', 'email'),
    f('other', 'email'),
    f('pw', 'password'),
    f('code', 'otp'),
    f('csc', 'cc-csc'),
  ]);
}

/** On this run the right mechanism produced the paint (and only it): :user-invalid natively, data-touched below. */
async function expectMechanism(page: Page, p: Paint): Promise<void> {
  if (await fallbackRuns(page)) {
    expect(p.touched, 'fallback: the touched state is set').toBe('true');
    expect(p.fallbackRule, 'fallback: the [data-touched]:invalid rule matches').toBe(true);
  } else {
    expect(p.touched, 'native: the browser decides, the component sets nothing').toBeNull();
    expect(p.userInvalid, 'native: :user-invalid matches').toBe(true);
  }
}

// ---- the matrix ------------------------------------------------------------------------------------------
test.describe.configure({ mode: 'parallel' });

for (const adapter of ADAPTERS) {
  for (const p of paths()) {
    for (const s of fieldScenarios() as Scenario[]) {
      test(matrixTitle(adapter, s, p.id), async ({ page, browserName }) => {
        const errors = await openHost(page);
        const run = RUN[s.id];
        if (!run) throw new Error(`no runner for scenario ${s.id}`);
        await run({ page, adapter, path: p.id, browserName });
        expect(errors).toEqual([]);
      });
    }
  }
}

test('harness | every declared scenario has a runner, and the runner table has no orphan', () => {
  expect(Object.keys(RUN).sort()).toEqual(
    fieldScenarios()
      .map((s) => s.id)
      .sort(),
  );
});
