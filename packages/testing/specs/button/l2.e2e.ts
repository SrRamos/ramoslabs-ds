// L2 + L6 for SJButton (W1-C01.f): every scenario of the contract-derived list on 3 engines x 3 adapters x
// (real detection + all `supports` keys forced false). Real browser input only: pointer through
// `page.mouse`, keys through `page.keyboard`, and native form submission observed from the form's own `submit`
// event. Title (parsed by the parity matrix, W1-313): <component> | <adapter> | <scenario> | <action> | path=<path>
import { test, expect } from '@playwright/test';
import { injectionProblems } from '../../e2e/supports/injection';
import { isNoop, parsePath, type SupportsMap } from '../../e2e/supports/paths';
import { FIXTURES, NARROW_PX } from './fixtures';
import {
  ADAPTERS,
  EXECUTED_PATHS,
  buttonScenarios,
  matrixTitle,
  COMPONENT,
  type Scenario,
} from './matrix';
import { clickCentre, control, focusByKeyboard, mountButton, openHost, settle } from './open';

const sequence = (s: Scenario) =>
  s.outcome === 'none' ? 'none' : s.outcome === 'press-no-submit' ? 'press, no submit' : s.outcome;

async function act(page: import('@playwright/test').Page, s: Scenario): Promise<void> {
  if (s.action === 'pointer') return clickCentre(page);
  const focused = await focusByKeyboard(page);
  // A disabled <button> is not focusable: the key then goes to <body> and must do nothing.
  if (!focused) expect(s.fixture).toBe('disabled');
  await page.keyboard.press(s.action);
}

for (const path of EXECUTED_PATHS) {
  for (const adapter of ADAPTERS) {
    test.describe(`${COMPONENT} | ${adapter} | path=${path}`, () => {
      for (const s of buttonScenarios()) {
        test(matrixTitle(adapter, s, path), async ({ page }) => {
          const errors = await openHost(page);
          const real = await page.evaluate(() => ({ ...window.__btn.real }) as SupportsMap);
          const p = parsePath(path);
          if (isNoop(real, p))
            test.info().annotations.push({
              type: 'noop',
              description: `engine already lacks ${p.forced.join(', ')}; path equals native here`,
            });
          await mountButton(page, adapter, s.fixture, path, { form: s.form });

          await act(page, s);
          await settle(page);

          const presses = await page.evaluate(() => window.__btn.presses);
          const submits = await page.evaluate(() => window.__btn.submits);
          const hash = await page.evaluate(() => location.hash);
          const expectPress = s.outcome !== 'none';
          expect(presses.length, `presses for ${sequence(s)}`).toBe(expectPress ? 1 : 0);
          // The payload carries the native event that caused it (ADR-004 events), never a synthetic one.
          if (expectPress) expect(presses[0]!.type).toBe('click');

          if (s.outcome === 'submit') {
            expect(submits).toHaveLength(1);
            // The submitter's name/value reach the form data exactly as for a bare <button>.
            expect(submits[0]!.submitter).toEqual({ name: 'intent', value: 'save' });
            expect(submits[0]!.data).toEqual({ intent: 'save' });
          } else {
            expect(submits).toHaveLength(0);
          }
          if (s.part === 'link') expect(hash).toBe(expectPress ? FIXTURES.link!.href : '');

          // Element and a few contract markers, identical on every adapter.
          const el = control(page);
          expect(await el.evaluate((n) => n.localName)).toBe(s.part === 'link' ? 'a' : 'button');
          expect(await el.getAttribute('data-variant')).toBe('solid');
          expect(await el.getAttribute('data-tone')).toBe('primary');
          expect(await el.getAttribute('data-size')).toBe('md');
          if (s.part === 'root' && s.fixture !== 'submit')
            expect(await el.getAttribute('type')).toBe('button');

          if (s.fixture === 'disabled') {
            expect(await el.isDisabled()).toBe(true);
          }
          if (s.fixture === 'long-label') {
            // Wraps inside its container instead of overflowing it.
            const m = await el.evaluate((n) => ({
              w: n.getBoundingClientRect().width,
              sw: n.scrollWidth,
              cw: n.clientWidth,
            }));
            expect(m.w).toBeLessThanOrEqual(NARROW_PX + 0.5);
            expect(m.sw).toBeLessThanOrEqual(m.cw + 1);
          }
          if (s.fixture === 'icon-only') {
            // No visible text; the name comes from `label`, and the icon is hidden from the tree.
            expect(await el.getAttribute('aria-label')).toBe(FIXTURES['icon-only']!.label);
            expect(await el.locator('[aria-hidden="true"]').count()).toBe(1);
          }

          // The path is what the adapter's own runtime reported, not a label we attached.
          const seen = await page.evaluate(() => window.__btn.seen as SupportsMap | null);
          expect(injectionProblems(real, seen, p)).toEqual([]);
          expect(errors).toEqual([]);
        });
      }
    });
  }
}
