// L2 + L6 for SJDisclosure (W1-C06.f, ADR-013): every contract step on 3 engines x 3 adapters x the supports
// paths. Drives the REAL adapters. The stock sequence executor is not reused: it assumes `on`/`off` data-state
// values and a boolean event log, while a disclosure has `open`/`closed` and one event (`openChange`) per
// member. The scenarios come from the same derived plan, so a contract step that is not driven here fails the
// matrix. Title format, parsed by the parity matrix:
// `<component> | <adapter> | <scenario> | <action> | path=<path>`; titles without `path=` are harness checks.
//
// Exclusive groups (Fable ruling): every engine the suite can launch has native `<details name>`, so the
// browser closes the peers itself on both paths. What differs is the code that runs, and the group-scan probe
// (open.ts) makes that observable: on `native` the fallback must NOT have scanned for peers, on `fallback:all`
// it must have. The closing itself is asserted on both paths.
import { test, expect, type Page } from '@playwright/test';
import { injectionProblems } from '../../e2e/supports/injection';
import { SUPPORT_KEYS, isNoop, parsePath, type SupportsMap } from '../../e2e/supports/paths';
import {
  ADAPTERS,
  FIXTURES,
  contract,
  dataStateOf,
  disclosureScenarios,
  matrixTitle,
  openOf,
  paths,
  plan,
  spec,
  type GroupKind,
  type Step,
} from './matrix';
import {
  CONTENT,
  GROUP_NAME,
  POSITIONS,
  SUMMARY,
  groupControlled,
  groupFirstOpen,
  type Adapter,
  type DisclosureFixtureProps,
  type Mount,
} from './fixtures';
import { PANEL, ROOT, TRIGGER, openHost, settle } from './open';

async function open(page: Page): Promise<{ errors: string[]; real: SupportsMap }> {
  const errors = await openHost(page, { probe: true });
  const real = await page.evaluate(() => ({ ...window.__sj.real }) as SupportsMap);
  return { errors, real };
}

const seenMap = (page: Page) => page.evaluate(() => window.__sj.seen as SupportsMap | null);

const mount = (page: Page, adapter: Adapter, props: Mount, path: string) =>
  page.evaluate(
    ([a, p, path]) =>
      window.__sj.mount(a as 'react', p as never, 'none', path).then(() => undefined),
    [adapter, props, path] as const,
  );

interface Member {
  open: boolean;
  state: string | null;
  panelVisible: boolean;
  summaryAttrs: string[];
  focused: boolean;
}
interface View {
  members: Member[];
  events: string[];
  scans: number;
}

const view = (page: Page): Promise<View> =>
  page.evaluate(
    ([root, trigger, content]) => ({
      members: [...document.querySelectorAll<HTMLDetailsElement>(root!)].map((d) => ({
        open: d.open,
        state: d.getAttribute('data-state'),
        panelVisible: (d.querySelector(content!) as HTMLElement).checkVisibility(),
        summaryAttrs: (d.querySelector(trigger!) as HTMLElement).getAttributeNames(),
        focused: document.activeElement === d.querySelector(trigger!),
      })),
      events: (window.__sj.events as unknown as string[]).slice(),
      scans: (window as unknown as { __scans: number }).__scans,
    }),
    [ROOT, TRIGGER, PANEL] as const,
  );

function expectPosition(
  out: string[],
  where: string,
  position: string,
  m: Member | undefined,
): void {
  if (!m) return void out.push(`${where}: no disclosure rendered`);
  const state = dataStateOf(position);
  if (m.state !== state) out.push(`${where}: root data-state "${m.state}", expected "${state}"`);
  if (m.open !== openOf(position))
    out.push(`${where}: details.open ${m.open}, expected ${openOf(position)}`);
  if (m.panelVisible !== openOf(position))
    out.push(`${where}: panel visible ${m.panelVisible}, expected ${openOf(position)}`);
  for (const forbidden of ['aria-expanded', 'aria-controls', 'role'])
    if (m.summaryAttrs.includes(forbidden)) out.push(`${where}: summary carries ${forbidden}`);
}

const sameSet = (a: string[], b: string[]): boolean =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** Run one `toggle` step: mount at `from`, activate by pointer or key, assert `to` and the events. */
export async function runToggle(
  page: Page,
  adapter: Adapter,
  path: string,
  step: Step,
  action: string,
): Promise<string[]> {
  const out: string[] = [];
  await mount(page, adapter, POSITIONS[step.from]!, path);
  const trigger = page.locator(TRIGGER);
  await trigger.waitFor({ timeout: 5000 });
  await settle(page);
  expectPosition(out, `${step.id} initial`, step.from, (await view(page)).members[0]);
  if (action === 'pointer') await trigger.click();
  else {
    await trigger.focus();
    await page.keyboard.press(action);
  }
  await settle(page);
  const v = await view(page);
  expectPosition(out, `${step.id} [${action}]`, step.to, v.members[0]);
  if (JSON.stringify(v.events) !== JSON.stringify([`open:${openOf(step.to)}`]))
    out.push(
      `${step.id}: events ${JSON.stringify(v.events)}, expected ["open:${openOf(step.to)}"]`,
    );
  if (action !== 'pointer' && !v.members[0]?.focused)
    out.push(`${step.id}: focus left the summary`);
  return out;
}

/** `open` / `close`: the owner drives them as a controlled prop; nothing is emitted. */
export async function runProp(
  page: Page,
  adapter: Adapter,
  path: string,
  step: Step,
): Promise<string[]> {
  const out: string[] = [];
  const props = (position: string): DisclosureFixtureProps => ({
    open: openOf(position),
    summary: SUMMARY,
    content: CONTENT,
  });
  await mount(page, adapter, props(step.from), path);
  await page.locator(TRIGGER).waitFor({ timeout: 5000 });
  await settle(page);
  expectPosition(out, `${step.id} initial`, step.from, (await view(page)).members[0]);
  await page.evaluate((p) => window.__sj.update(p as never), props(step.to));
  await settle(page);
  const v = await view(page);
  expectPosition(out, `${step.id} [prop]`, step.to, v.members[0]);
  if (v.events.length > 0)
    out.push(`${step.id}: a prop change emitted ${JSON.stringify(v.events)}`);
  return out;
}

/** The `disabled` fixture: no trigger may change state or emit; the summary stays focusable. */
async function runInert(
  page: Page,
  adapter: Adapter,
  path: string,
  fixture: string,
): Promise<string[]> {
  const out: string[] = [];
  await mount(page, adapter, FIXTURES[fixture]!, path);
  const trigger = page.locator(TRIGGER);
  await trigger.waitFor({ timeout: 5000 });
  const before = await view(page);
  if ((await trigger.getAttribute('aria-disabled')) !== 'true')
    out.push('summary has no aria-disabled="true"');
  await trigger.click();
  await trigger.focus();
  if (!(await page.evaluate((s) => document.activeElement === document.querySelector(s), TRIGGER)))
    out.push('the disabled summary cannot take focus (it must stay reachable)');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await settle(page);
  const after = await view(page);
  if (after.members[0]?.open !== before.members[0]?.open)
    out.push('details.open changed while inert');
  if (after.members[0]?.state !== before.members[0]?.state)
    out.push('data-state changed while inert');
  if (after.events.length > 0) out.push(`${after.events.length} events emitted while inert`);
  return out;
}

/** Controlled `open`: a request is reported, the owner decides, the view follows only the prop. */
async function runControlledOpen(page: Page, adapter: Adapter, path: string): Promise<string[]> {
  const out: string[] = [];
  const props = (o: boolean): DisclosureFixtureProps => ({
    open: o,
    summary: SUMMARY,
    content: CONTENT,
  });
  await mount(page, adapter, props(false), path);
  const trigger = page.locator(TRIGGER);
  await trigger.waitFor({ timeout: 5000 });
  await trigger.click();
  await settle(page);
  let v = await view(page);
  if (JSON.stringify(v.events) !== '["open:true"]')
    out.push(`events ${JSON.stringify(v.events)}, expected ["open:true"]`);
  expectPosition(out, 'rejected request', 'closed', v.members[0]);
  await page.evaluate((p) => window.__sj.update(p as never), props(true));
  await settle(page);
  v = await view(page);
  expectPosition(out, 'prop true', 'open', v.members[0]);
  if (v.events.length !== 1) out.push(`prop change emitted: ${JSON.stringify(v.events)}`);
  await trigger.click();
  await settle(page);
  v = await view(page);
  if (JSON.stringify(v.events) !== '["open:true","open:false"]')
    out.push(`events ${JSON.stringify(v.events)}`);
  expectPosition(out, 'second rejected request', 'open', v.members[0]);
  return out;
}

const openSet = (v: View): boolean[] => v.members.map((m) => m.open);

/**
 * Exclusive groups. `ranPath` is the supports path the host was mounted with, `expectPath` the path whose
 * contract is asserted; they are equal except in the seeded negative that proves the probe can fail.
 */
export async function runGroup(
  page: Page,
  adapter: Adapter,
  ranPath: string,
  group: GroupKind,
  expectPath: string = ranPath,
): Promise<string[]> {
  const out: string[] = [];
  const fallback = expectPath !== 'native';
  const T = (i: number) => page.locator(TRIGGER).nth(i);
  const scanned = async (): Promise<number> => (await view(page)).scans;
  const reset = () =>
    page.evaluate(() => void ((window as unknown as { __scans: number }).__scans = 0));
  const assertScan = async (where: string): Promise<void> => {
    const n = await scanned();
    if (fallback && n === 0)
      out.push(`${where}: the owned fallback never scanned for peers (it was not invoked)`);
    if (!fallback && n > 0)
      out.push(`${where}: the fallback scanned ${n} time(s) although the engine groups natively`);
  };
  const names = await (async () => {
    await mount(page, adapter, groupFirstOpen(), ranPath);
    await page.locator(TRIGGER).first().waitFor({ timeout: 5000 });
    return page.evaluate(
      (s) => [...document.querySelectorAll(s)].map((e) => e.getAttribute('name')),
      ROOT,
    );
  })();
  if (names.some((n) => n !== GROUP_NAME))
    out.push(`members do not share the name: ${JSON.stringify(names)}`);

  if (group === 'pointer') {
    await settle(page);
    let v = await view(page);
    if (!sameSet(openSet(v).map(String), ['true', 'false', 'false']))
      out.push('initial group is not [open, closed, closed]');
    await reset();
    await T(1).click();
    await settle(page);
    v = await view(page);
    if (JSON.stringify(openSet(v)) !== '[false,true,false]')
      out.push(`after opening 1: ${JSON.stringify(openSet(v))}`);
    if (!sameSet(v.events, ['m0:open:false', 'm1:open:true']))
      out.push(`events ${JSON.stringify(v.events)}`);
    await assertScan('open member 1');
    await reset();
    await T(2).click();
    await settle(page);
    v = await view(page);
    if (JSON.stringify(openSet(v)) !== '[false,false,true]')
      out.push(`after opening 2: ${JSON.stringify(openSet(v))}`);
    if (!sameSet(v.events, ['m0:open:false', 'm1:open:true', 'm1:open:false', 'm2:open:true']))
      out.push(`events ${JSON.stringify(v.events)}`);
    await assertScan('open member 2');
    // Closing the open member leaves a group with none open (a group allows zero).
    await T(2).click();
    await settle(page);
    if (JSON.stringify(openSet(await view(page))) !== '[false,false,false]')
      out.push('closing the open member did not leave all closed');
  }

  if (group === 'programmatic') {
    await settle(page);
    await reset();
    await page.evaluate(
      (s) => void (document.querySelectorAll<HTMLDetailsElement>(s)[2]!.open = true),
      ROOT,
    );
    await settle(page);
    const v = await view(page);
    if (JSON.stringify(openSet(v)) !== '[false,false,true]')
      out.push(`after details.open = true on 2: ${JSON.stringify(openSet(v))}`);
    if (!sameSet(v.events, ['m0:open:false', 'm2:open:true']))
      out.push(`events ${JSON.stringify(v.events)}`);
    await assertScan('programmatic open');
  }

  if (group === 'controlled') {
    // Every member is the owner's: the owner first lets the request pass unanswered (rejection), then accepts.
    await mount(page, adapter, groupControlled([true, false, false]), ranPath);
    await page.locator(TRIGGER).first().waitFor({ timeout: 5000 });
    await settle(page);
    await reset();
    await T(2).click();
    await settle(page);
    let v = await view(page);
    if (!sameSet(v.events, ['m0:open:false', 'm2:open:true']))
      out.push(`events ${JSON.stringify(v.events)}`);
    // Neither owner moved: the corrective effects put both members back where the props say.
    if (JSON.stringify(openSet(v)) !== '[true,false,false]')
      out.push(`while the owner keeps its props: ${JSON.stringify(openSet(v))}`);
    await assertScan('controlled member');
    const n = v.events.length;
    await page.evaluate(
      (p) => window.__sj.update(p as never),
      groupControlled([false, false, true]),
    );
    await settle(page);
    v = await view(page);
    if (JSON.stringify(openSet(v)) !== '[false,false,true]')
      out.push(`after the owner accepted: ${JSON.stringify(openSet(v))}`);
    if (v.events.length !== n)
      out.push(`the owner's prop change emitted ${JSON.stringify(v.events.slice(n))}`);
  }

  if (group === 'rejected') {
    // m0 uncontrolled and open, m1 controlled closed (the owner rejects), m2 uncontrolled.
    const members = groupFirstOpen();
    members[1] = { ...members[1]!, open: false };
    await mount(page, adapter, members, ranPath);
    await page.locator(TRIGGER).first().waitFor({ timeout: 5000 });
    await settle(page);
    await reset();
    await T(1).click();
    await settle(page);
    const v = await view(page);
    // The rejected member goes back to closed, but its peer still closed: a rejected open closes peers too.
    if (JSON.stringify(openSet(v)) !== '[false,false,false]')
      out.push(`after the rejected open: ${JSON.stringify(openSet(v))}`);
    if (!sameSet(v.events, ['m0:open:false', 'm1:open:true']))
      out.push(`events ${JSON.stringify(v.events)}`);
    await assertScan('rejected open');
  }
  return out;
}

export async function runScenario(
  page: Page,
  adapter: Adapter,
  path: string,
  s: ReturnType<typeof disclosureScenarios>[number],
): Promise<string[]> {
  switch (s.run.kind) {
    case 'toggle':
      return runToggle(page, adapter, path, s.run.step, s.action);
    case 'prop':
      return runProp(page, adapter, path, s.run.step);
    case 'inert':
      return runInert(page, adapter, path, s.run.fixture);
    case 'controlled-open':
      return runControlledOpen(page, adapter, path);
    case 'group':
      return runGroup(page, adapter, path, s.run.group);
  }
}

test.describe('harness checks (not matrix rows)', () => {
  test('the plan is derived from the contract and every contract step has a scenario', () => {
    expect(plan.sequences.length).toBeGreaterThan(0);
    expect(spec.unreachable).toEqual([]);
    for (const s of spec.scenarios) expect(FIXTURES).toHaveProperty(s.fixture);
    expect(spec.states).toEqual([...contract.state.machine].sort());
    const covered = new Set(
      disclosureScenarios()
        .filter((s) => 'step' in s.run)
        .map((s) => (s.run as { step: Step }).step.id),
    );
    expect([...covered].sort()).toEqual(spec.steps.map((s: Step) => s.id).sort());
  });

  test('the contract declares details-name, so native and fallback:all run (fallback:all forces detailsName)', () => {
    expect(spec.component).toBe('SJDisclosure');
    expect(contract.support.map((s: { feature: string }) => s.feature)).toEqual(['details-name']);
    expect(paths().map((p) => p.id)).toEqual(['native', 'fallback:all']);
    expect(parsePath('fallback:all').forced).toContain('detailsName');
  });

  test('engine evidence | a bare <details name> pair groups natively on this engine, and detection agrees', async ({
    page,
    browser,
    browserName,
  }) => {
    // Real-engine evidence for ADR-001's `<details name>` row (recorded in the notes): no adapter involved.
    const { real } = await open(page);
    const r = await page.evaluate(() => {
      const root = document.createElement('div');
      root.innerHTML =
        '<details name="g"><summary>a</summary>a</details><details name="g"><summary>b</summary>b</details>';
      document.body.appendChild(root);
      const [a, b] = [...root.querySelectorAll('details')] as HTMLDetailsElement[];
      a!.open = true;
      b!.open = true;
      const out = {
        aOpen: a!.open,
        bOpen: b!.open,
        hasName: 'name' in HTMLDetailsElement.prototype,
      };
      root.remove();
      return out;
    });
    test.info().annotations.push({
      type: 'engine',
      description: `${browserName} ${browser.version()}: supports.detailsName=${real.detailsName}, native grouping=${!r.aOpen && r.bOpen}`,
    });
    expect(r.hasName).toBe(true);
    expect(real.detailsName).toBe(true);
    expect({ aOpen: r.aOpen, bOpen: r.bOpen }).toEqual({ aOpen: false, bOpen: true });
  });

  for (const adapter of ADAPTERS) {
    test(`${adapter} | forcing every capability false is visible to the runtime`, async ({
      page,
    }) => {
      const { real } = await open(page);
      await mount(page, adapter, FIXTURES['closed']!, 'fallback:all');
      const seen = (await seenMap(page))!;
      for (const k of SUPPORT_KEYS) expect(seen[k], k).toBe(false);
      expect(Object.values(real).some(Boolean)).toBe(true);
    });

    test(`${adapter} | real detection on this engine reports native details name, so the native path skips the fallback`, async ({
      page,
      browserName,
    }) => {
      const { real } = await open(page);
      // All three engines launched here (Chromium 120+, Firefox 130+, WebKit/Safari 17.2+) group natively.
      expect(real.detailsName, `${browserName} supports.detailsName`).toBe(true);
      await mount(page, adapter, FIXTURES['exclusive-group']!, 'native');
      expect((await seenMap(page))!.detailsName).toBe(true);
    });
  }
});

for (const path of paths()) {
  for (const adapter of ADAPTERS) {
    test.describe(`${spec.component} | ${adapter} | path=${path.id}`, () => {
      for (const s of disclosureScenarios()) {
        test(matrixTitle(adapter, s, path.id), async ({ page }) => {
          const { errors, real } = await open(page);
          if (isNoop(real, path))
            test.info().annotations.push({
              type: 'noop',
              description: `engine already lacks ${path.forced.join(', ')}; path equals native here`,
            });
          expect(await runScenario(page, adapter, path.id, s)).toEqual([]);
          expect(errors).toEqual([]);
          expect(injectionProblems(real, await seenMap(page), parsePath(path.id))).toEqual([]);
        });
      }
    });
  }
}

// The runner is only evidence if a broken disclosure fails it. Seeded defects, per adapter:
//  1. the root stops following its data-state (a wrapper that forgets to re-render);
//  2. a native-path run is judged as a fallback run: the probe must report that the fallback never scanned;
//  3. a fallback-path run is judged as a native run: the probe must report the stray scan.
const toggleStep = spec.steps.find((s: Step) => s.id === 'toggle:closed>open')!;
for (const adapter of ADAPTERS) {
  test(`seeded defect | ${adapter} | a disclosure whose data-state never advances is reported`, async ({
    page,
  }) => {
    await open(page);
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const c = document.querySelector('[data-part="root"]');
        if (c && c.getAttribute('data-state') !== 'closed') c.setAttribute('data-state', 'closed');
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
    });
    await page.reload();
    await page.waitForFunction(() => window.__sj?.ready === true);
    expect(
      (await runToggle(page, adapter, 'native', toggleStep, 'pointer')).length,
    ).toBeGreaterThan(0);
  });

  test(`seeded defect | ${adapter} | a native-path run that is judged as a fallback run reports no scan`, async ({
    page,
  }) => {
    await open(page);
    const problems = await runGroup(page, adapter, 'native', 'pointer', 'fallback:all');
    expect(problems.join('\n')).toContain('never scanned');
  });

  test(`seeded defect | ${adapter} | a fallback-path run that is judged as a native run reports the scan`, async ({
    page,
  }) => {
    await open(page);
    const problems = await runGroup(page, adapter, 'fallback:all', 'pointer', 'native');
    expect(problems.join('\n')).toContain('scanned');
  });
}
