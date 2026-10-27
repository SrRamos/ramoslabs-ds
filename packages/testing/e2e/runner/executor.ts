// Action executor for L2 (W1-309a, ADR-013 L2). Consumes the plan `l2Plan(deriveSpec(contract))`
// that the L1 reducer harness replays too, so both layers run the same sequences. It drives a real
// browser page that hosts one adapter's component (host/entry.ts) and asserts the contract's
// semantics: state, ARIA, FOCUS TARGET, emitted events and the IDREF graph. It never compares DOM
// bytes across adapters (ADR-013: adapters may differ in markup noise; behaviour must not).
//
// The executor returns failures instead of throwing, so the seeded-defect tests can assert that a
// broken wrapper is reported, and so a run can list every failed step at once.
import type { Page } from '@playwright/test';
import type { DerivedSpec, Step, Trigger } from '../../spec/derive/index.js';

export type Plan = { sequences: string[][]; scenarios: DerivedSpec['scenarios']; steps: Step[] };
export type Props = Record<string, unknown>;

export interface RunOptions {
  readonly adapter: 'react' | 'vue' | 'vanilla';
  readonly defect?: string;
  /** Supports path (W1-309b): `native` (default) or `fallback:<key>`. */
  readonly path?: string;
  /** Props for each fixture name of the contract (the component author's mapping). */
  readonly fixtures: Record<string, Props>;
  /** `pointer`, or a keyboard key to use wherever a step declares it. */
  readonly variant: string;
  /** Per-wait budget. Short on purpose: a missing transition must fail fast. */
  readonly timeoutMs?: number;
}

export interface Failure {
  readonly where: string;
  readonly message: string;
}

const ROOT = (part: string) => `[data-part="${part}"]`;

/** Every trigger key the plan declares, in code-unit order. The variants a sequence runs under. */
export function variantsOf(plan: Plan): string[] {
  const keys = new Set<string>();
  for (const s of plan.steps)
    for (const t of s.triggers) if (t.kind === 'keyboard') keys.add(t.key);
  return ['pointer', ...[...keys].sort()];
}

/** The trigger a step uses under a variant, or `pointer`. Falls back to the step's first trigger. */
export function triggerFor(step: Step, variant: string): Trigger | 'pointer' {
  if (variant === 'pointer') return 'pointer';
  return step.triggers.find((t) => t.key === variant) ?? step.triggers[0] ?? 'pointer';
}

/** In-page graph check: duplicate ids and IDREFs that resolve to nothing. */
async function idrefProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const ids = new Map<string, number>();
    for (const el of document.querySelectorAll('[id]')) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
    for (const [id, n] of ids) if (n > 1) out.push(`duplicate id "${id}" (${n}x)`);
    const lists = [
      'aria-labelledby',
      'aria-describedby',
      'aria-controls',
      'aria-owns',
      'aria-flowto',
      'aria-details',
      'aria-errormessage',
    ];
    for (const el of document.querySelectorAll('*')) {
      for (const attr of [...lists, 'aria-activedescendant']) {
        const v = el.getAttribute(attr);
        if (v === null) continue;
        for (const ref of v.split(/\s+/).filter(Boolean))
          if (!ids.has(ref)) out.push(`${attr} -> "${ref}" resolves to nothing`);
      }
      const f = el.getAttribute('for');
      if (f !== null && !ids.has(f)) out.push(`for -> "${f}" resolves to nothing`);
    }
    return out;
  });
}

const snapshot = (page: Page, part: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const active = document.activeElement;
    return {
      found: el !== null,
      state: el?.getAttribute('data-state') ?? null,
      attrs: el ? Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])) : {},
      focused: el !== null && active === el,
      activeDesc: active
        ? `${active.tagName.toLowerCase()}${active.id ? '#' + active.id : ''}`
        : 'none',
      events: window.__sj.events.slice(),
    };
  }, ROOT(part));

async function mount(page: Page, opts: RunOptions, props: Props): Promise<void> {
  await page.evaluate(
    ([adapter, p, defect, path]) =>
      window.__sj
        .mount(adapter as 'react', p as never, defect as 'none', path)
        .then(() => undefined),
    [opts.adapter, props, opts.defect ?? 'none', opts.path ?? 'native'] as const,
  );
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => setTimeout(r, 40)));

/** Runs one derived sequence under one variant on a freshly mounted component. */
export async function runSequence(
  page: Page,
  plan: Plan,
  spec: Pick<DerivedSpec, 'initial' | 'focus'>,
  sequence: string[],
  opts: RunOptions,
): Promise<Failure[]> {
  const fails: Failure[] = [];
  const timeout = opts.timeoutMs ?? 1500;
  const owner = spec.focus.owner ?? 'root';
  const fixture = plan.scenarios.find((s) => s.interactive && s.fixture === spec.initial)?.fixture;
  if (fixture === undefined || !(fixture in opts.fixtures))
    return [
      { where: 'setup', message: `no interactive fixture for initial state "${spec.initial}"` },
    ];
  const fail = (where: string, message: string) => void fails.push({ where, message });
  await mount(page, opts, opts.fixtures[fixture]);
  await page.locator(ROOT(owner)).waitFor({ timeout });

  let at = await snapshot(page, owner);
  if (at.state !== spec.initial) fail('initial', `state "${at.state}", expected "${spec.initial}"`);
  const keyboard = opts.variant !== 'pointer';
  if (keyboard) await page.locator(ROOT(owner)).focus();
  let emitted = 0;

  for (const id of sequence) {
    const step = plan.steps.find((s) => s.id === id);
    if (!step) {
      fail(id, 'sequence names a step that is not in the plan');
      break;
    }
    const where = `${id} [${opts.variant}]`;
    const before = await snapshot(page, owner);
    if (before.state !== step.from) {
      fail(where, `precondition: state "${before.state}", expected "${step.from}"`);
      break;
    }
    const trig = triggerFor(step, opts.variant);
    if (trig === 'pointer') await page.locator(ROOT(owner)).click({ timeout });
    else await page.keyboard.press(trig.key);

    try {
      await page.waitForFunction(
        ([sel, want]) => document.querySelector(sel)?.getAttribute('data-state') === want,
        [ROOT(owner), step.to] as const,
        { timeout },
      );
    } catch {
      fail(where, `state never became "${step.to}"`);
    }
    await settle(page);
    at = await snapshot(page, owner);
    if (at.state !== step.to) {
      fail(where, `state "${at.state}", expected "${step.to}"`);
      break;
    }
    for (const [part, attrs] of Object.entries(
      step.expect.aria as Record<string, Record<string, string>>,
    )) {
      const s = part === owner ? at : await snapshot(page, part);
      for (const [name, want] of Object.entries(attrs))
        if (s.attrs[name] !== want)
          fail(where, `${part} ${name}="${s.attrs[name]}", expected "${want}"`);
    }
    // Focus target (not byte-identical DOM): pointer focus on a button is engine policy (WebKit does
    // not focus buttons on click), so it is asserted for keyboard runs only.
    const focusPart = step.expect.focus ?? owner;
    if (keyboard) {
      const f = focusPart === owner ? at.focused : (await snapshot(page, focusPart)).focused;
      if (!f) fail(where, `focus is on ${at.activeDesc}, expected [data-part="${focusPart}"]`);
    }
    if (step.emit !== null) {
      emitted += 1;
      const want = step.to === 'on';
      if (at.events.length !== emitted)
        fail(where, `${at.events.length} ${step.emit} events so far, expected ${emitted}`);
      else if (at.events[emitted - 1] !== want)
        fail(where, `${step.emit} payload ${at.events[emitted - 1]}, expected ${want}`);
    }
    for (const p of await idrefProblems(page)) fail(where, p);
  }
  return fails;
}

/** The `disabled` fixture: no trigger may change state or emit; the control is not operable. */
export async function runInert(
  page: Page,
  plan: Plan,
  spec: Pick<DerivedSpec, 'focus'>,
  fixture: string,
  opts: RunOptions,
): Promise<Failure[]> {
  const fails: Failure[] = [];
  const owner = spec.focus.owner ?? 'root';
  const keys = new Set(plan.steps.flatMap((s) => s.triggers.map((t) => t.key)));
  await mount(page, opts, opts.fixtures[fixture]);
  const root = page.locator(ROOT(owner));
  await root.waitFor({ timeout: 1500 });
  const first = await snapshot(page, owner);
  if (first.attrs['disabled'] === undefined && first.attrs['aria-disabled'] !== 'true')
    fails.push({ where: fixture, message: 'inert fixture is neither disabled nor aria-disabled' });
  await root.click({ force: true, timeout: 1500 }).catch(() => undefined);
  await root.focus().catch(() => undefined);
  for (const k of keys) await page.keyboard.press(k);
  await settle(page);
  const after = await snapshot(page, owner);
  if (after.state !== first.state)
    fails.push({ where: fixture, message: `state changed ${first.state} -> ${after.state}` });
  if (after.events.length > 0)
    fails.push({ where: fixture, message: `${after.events.length} events emitted while inert` });
  for (const p of await idrefProblems(page)) fails.push({ where: fixture, message: p });
  return fails;
}

/** Controlled field: a request is reported, the owner decides, the view follows only the prop. */
export async function runControlled(
  page: Page,
  spec: Pick<DerivedSpec, 'focus'>,
  opts: RunOptions,
): Promise<Failure[]> {
  const fails: Failure[] = [];
  const owner = spec.focus.owner ?? 'root';
  const fail = (message: string) => void fails.push({ where: 'controlled', message });
  await mount(page, opts, { pressed: false });
  const root = page.locator(ROOT(owner));
  await root.waitFor({ timeout: 1500 });
  await root.click({ timeout: 1500 });
  await settle(page);
  let s = await snapshot(page, owner);
  if (s.events.length !== 1 || s.events[0] !== true)
    fail(`events ${JSON.stringify(s.events)}, expected [true]`);
  if (s.state !== 'off') fail(`rejected request changed the view to "${s.state}"`);
  await page.evaluate((p) => window.__sj.update(p as never), { pressed: true });
  await settle(page);
  s = await snapshot(page, owner);
  if (s.state !== 'on') fail(`prop change to true left the view at "${s.state}"`);
  if (s.attrs['aria-checked'] !== 'true')
    fail(`aria-checked "${s.attrs['aria-checked']}" after prop true`);
  if (s.events.length !== 1) fail(`prop change emitted: ${JSON.stringify(s.events)}`);
  return fails;
}
