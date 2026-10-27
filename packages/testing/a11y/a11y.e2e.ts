// L3 automated accessibility gates (W1-310, ADR-013 L3). Three engines.
//   @pr      axe per probe state x adapter, 2.4.11, 2.4.13, 2.5.7, 2.5.8
//   @release 3.3.7, 3.3.8, 3.2.6
// Every criterion has a PASS fixture and at least one SEEDED-FAIL fixture; a seeded fixture passes
// its test only when the gate REPORTS it. Title format: `<gate> | <fixture or state> | <expectation>`.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectAuth,
  collectDragCandidates,
  collectFocusAppearance,
  collectFocusObscured,
  collectHelp,
  collectStepFields,
  collectTargets,
  inspectDragAlt,
  readScope,
} from './collectors.js';
import {
  accessibleAuthentication,
  applyAxeTriage,
  consistentHelp,
  draggingAlternative,
  focusAppearance,
  focusNotObscured,
  redundantEntry,
  targetSize,
  validateTriage,
  type Triage,
} from './verdicts.js';

const here = dirname(fileURLToPath(import.meta.url));
const triage: Triage = JSON.parse(readFileSync(join(here, 'triage.json'), 'utf8'));

const fx = (name: string) => `/fixtures/${name}.html`;

/**
 * Moves keyboard focus to the element matching `selector`, so :focus-visible applies.
 * Chromium and Firefox: Tab presses. WebKit on macOS skips buttons on Tab by default (an OS-level
 * Safari setting), so there one Tab press establishes keyboard modality and the element is then
 * focused programmatically; engines keep :focus-visible after a keyboard interaction.
 */
async function tabTo(page: Page, selector: string, max = 40): Promise<void> {
  const reached = () => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);
  if (test.info().project.name === 'webkit') {
    await page.keyboard.press('Tab');
    await page.locator(selector).first().focus();
    if (await reached()) return;
  } else {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      if (await reached()) return;
    }
  }
  throw new Error(`could not focus ${selector}`);
}

// ---------------------------------------------------------------------------------------------
// axe per state (every affected state), target-size enabled explicitly, zero untriaged
// ---------------------------------------------------------------------------------------------

/** The one axe configuration of the gate. `target-size` is switched on by name, never by default. */
const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .options({ rules: { 'target-size': { enabled: true } } });

const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
const STATES = [
  { name: 'off', props: { label: 'Notifications' }, focus: false },
  { name: 'on', props: { label: 'Notifications', defaultPressed: true }, focus: false },
  { name: 'disabled', props: { label: 'Notifications', disabled: true }, focus: false },
  { name: 'on + focused', props: { label: 'Notifications', defaultPressed: true }, focus: true },
] as const;

test.describe('axe', () => {
  test('@pr triage file is valid: every entry names an issue and an owner', () => {
    expect(validateTriage(triage)).toEqual([]);
  });

  for (const adapter of ADAPTERS) {
    for (const state of STATES) {
      test(`@pr axe | probe ${adapter} | ${state.name} | zero untriaged violations`, async ({
        page,
      }) => {
        await page.goto('/a11y-host.html');
        await page.waitForFunction(() => window.__sj?.ready === true);
        await page.evaluate(([a, p]) => window.__sj.mount(a, p), [adapter, state.props] as const);
        if (state.focus) await tabTo(page, '[role=switch]');
        const results = await axe(page).analyze();
        // `target-size` must have been evaluated, not skipped: it appears in any result bucket (a disabled control makes it inapplicable).
        const ran = [
          ...results.passes,
          ...results.violations,
          ...results.incomplete,
          ...results.inapplicable,
        ].some((r) => r.id === 'target-size');
        expect(ran, 'axe target-size did not run').toBe(true);
        const { untriaged } = applyAxeTriage(results.violations, `probe-${state.name}`, triage);
        expect(untriaged.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });
    }
  }

  test('@pr axe | seeded fixture | image-alt, button-name and target-size are reported', async ({
    page,
  }) => {
    await page.goto(fx('axe/fail'));
    const { violations } = await axe(page).analyze();
    const ids = violations.map((v) => v.id);
    for (const id of ['image-alt', 'button-name', 'target-size']) expect(ids).toContain(id);
  });

  test('@pr axe | seeded fixture | only a valid triage entry (issue AND owner) clears a violation', async ({
    page,
  }) => {
    await page.goto(fx('axe/fail'));
    const { violations } = await axe(page).analyze();
    const good = {
      rule: 'image-alt',
      fixture: 'f',
      issue: '#12',
      owner: '@a11y',
      reason: 'seeded',
    };
    const noOwner = { ...good, owner: '' };
    const noIssue = { ...good, issue: '' };
    const cleared = (e: typeof good) =>
      applyAxeTriage(violations, 'f', { axe: [e] }).triaged.length;
    expect(cleared(good)).toBe(1);
    expect(cleared(noOwner)).toBe(0);
    expect(cleared(noIssue)).toBe(0);
    expect(validateTriage({ axe: [noOwner] })).not.toEqual([]);
  });

  test('@pr axe | target-size pass fixture | zero violations', async ({ page }) => {
    await page.goto(fx('target-size/pass'));
    const { violations } = await axe(page).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// 2.4.11 Focus Not Obscured
// ---------------------------------------------------------------------------------------------

test.describe('2.4.11', () => {
  test('@pr 2.4.11 | pass-sticky | keyboard focus below a sticky header stays clear (scroll-margin)', async ({
    page,
  }) => {
    await page.goto(fx('focus-obscured/pass-sticky'));
    await tabTo(page, '#target');
    const v = focusNotObscured(await page.evaluate(collectFocusObscured));
    expect(v.failures).toEqual([]);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0); // it really scrolled
  });

  test('@pr 2.4.11 | pass-dialog | focus inside a keyboard-opened modal dialog is clear', async ({
    page,
  }) => {
    await page.goto(fx('focus-obscured/pass-dialog'));
    await tabTo(page, '#opener');
    await page.keyboard.press('Enter');
    await expect(page.locator('#dlg')).toHaveAttribute('open', '');
    await tabTo(page, '#close');
    const v = focusNotObscured(await page.evaluate(collectFocusObscured));
    expect(v.failures).toEqual([]);
    expect(v.fraction).toBe(0);
  });

  test('@pr 2.4.11 | fail-banner-full | a fixed banner hides the focused control', async ({
    page,
  }) => {
    await page.goto(fx('focus-obscured/fail-banner-full'));
    await tabTo(page, '#target');
    const v = focusNotObscured(await page.evaluate(collectFocusObscured));
    expect(v.pass).toBe(false);
    expect(v.entirelyHidden).toBe(true);
    expect(v.failures.join()).toContain('banner');
  });

  test('@pr 2.4.11 | fail-banner-partial | partial cover fails the ADR gate though not the literal AA text', async ({
    page,
  }) => {
    await page.goto(fx('focus-obscured/fail-banner-partial'));
    await tabTo(page, '#target');
    const v = focusNotObscured(await page.evaluate(collectFocusObscured));
    expect(v.pass).toBe(false);
    expect(v.fraction).toBeGreaterThan(0);
    expect(v.entirelyHidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// 2.4.13 Focus Appearance
// ---------------------------------------------------------------------------------------------

test.describe('2.4.13', () => {
  const measure = async (page: Page, name: string) => {
    await page.goto(fx(`focus-appearance/${name}`));
    await tabTo(page, '#target');
    return focusAppearance(await page.evaluate(collectFocusAppearance));
  };

  test('@pr 2.4.13 | pass | base focus ring is >= 2px and >= 3:1 against the unfocused pixels', async ({
    page,
  }) => {
    const v = await measure(page, 'pass');
    expect(v.failures).toEqual([]);
    expect(v.thickness).toBeGreaterThanOrEqual(2);
  });

  for (const [name, needle] of [
    ['fail-none', 'no visible focus indicator'],
    ['fail-thin', 'thickness'],
    ['fail-faint', 'contrast'],
  ] as const) {
    test(`@pr 2.4.13 | ${name} | seeded defect is reported`, async ({ page }) => {
      const v = await measure(page, name);
      expect(v.pass).toBe(false);
      expect(v.failures.join()).toContain(needle);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// 2.5.7 Dragging Movements
// ---------------------------------------------------------------------------------------------

async function dragVerdict(page: Page, name: string) {
  await page.goto(fx(`dragging/${name}`));
  const candidates = await page.evaluate(collectDragCandidates);
  const checks: Parameters<typeof draggingAlternative>[1] = {};
  for (const c of candidates) {
    if (!c.alt) continue;
    const before = await page.evaluate(inspectDragAlt, { alt: c.alt, scope: c.scope });
    let changedScope: boolean | null = null;
    if (before.exists && before.visible && before.enabled) {
      const was = await page.evaluate(readScope, c.scope);
      await page.locator(`#${c.alt}`).click(); // ONE pointer click, no movement
      changedScope = (await page.evaluate(readScope, c.scope)) !== was;
    }
    checks[c.id] = { ...before, changedScope };
  }
  return draggingAlternative(candidates, checks);
}

test.describe('2.5.7', () => {
  test('@pr 2.5.7 | pass | every drag source performs the same action from one click', async ({
    page,
  }) => {
    expect((await dragVerdict(page, 'pass')).failures).toEqual([]);
  });
  test('@pr 2.5.7 | fail-no-alt | a drag source without an alternative is reported', async ({
    page,
  }) => {
    const v = await dragVerdict(page, 'fail-no-alt');
    expect(v.pass).toBe(false);
    expect(v.failures.join()).toContain('declares no single-pointer alternative');
  });
  test('@pr 2.5.7 | fail-dead-alt | an alternative that does nothing, or is disabled, is reported', async ({
    page,
  }) => {
    const v = await dragVerdict(page, 'fail-dead-alt');
    expect(v.pass).toBe(false);
    expect(v.failures.join()).toMatch(/did not change the drag scope/);
    expect(v.failures.join()).toMatch(/disabled/);
  });
});

// ---------------------------------------------------------------------------------------------
// 2.5.8 Target Size (Minimum): axe target-size (above) plus measured bounds
// ---------------------------------------------------------------------------------------------

test.describe('2.5.8', () => {
  test('@pr 2.5.8 | pass | 44px defaults, 24px compact, spaced 16px targets and an inline link', async ({
    page,
  }) => {
    await page.goto(fx('target-size/pass'));
    const targets = await page.evaluate(collectTargets);
    const v = targetSize(targets, triage.targetSize, 'target-size/pass');
    expect(v.failures).toEqual([]);
    expect(v.exceptionsUsed.join()).toContain('spacing'); // the spacing exception really was exercised
    expect(targets.find((t) => t.id === '#terms')?.inline).toBe(true);
    const compact = targets.find((t) => t.id === '#compact');
    expect(compact?.h).toBeGreaterThanOrEqual(24);
  });

  test('@pr 2.5.8 | fail | adjacent 16px targets are reported', async ({ page }) => {
    await page.goto(fx('target-size/fail'));
    const v = targetSize(await page.evaluate(collectTargets), [], 'target-size/fail');
    expect(v.pass).toBe(false);
    expect(v.failures.length).toBeGreaterThanOrEqual(3);
  });

  test('@pr 2.5.8 | fail | an exact documented exception clears only its own target', async ({
    page,
  }) => {
    await page.goto(fx('target-size/fail'));
    const targets = await page.evaluate(collectTargets);
    const ex = {
      fixture: 'f',
      target: '#slim',
      exception: 'essential',
      reason: 'seeded',
      owner: '@a11y',
    };
    const withEx = targetSize(targets, [ex], 'f');
    expect(withEx.failures.join()).not.toContain('#slim');
    expect(withEx.pass).toBe(false);
    const noOwner = targetSize(targets, [{ ...ex, owner: '' }], 'f');
    expect(noOwner.failures.join()).toContain('#slim');
  });
});

// ---------------------------------------------------------------------------------------------
// 3.3.7 Redundant Entry
// ---------------------------------------------------------------------------------------------

async function redundantVerdict(page: Page, name: string) {
  await page.goto(fx(`redundant-entry/${name}`));
  // Step 1: fill every visible field with a value derived from its autocomplete token.
  const first = await page.evaluate(collectStepFields);
  const entered = new Map<string, string>();
  for (const f of first) {
    const value = f.token === 'email' ? 'ada@example.com' : `value-${f.token}`;
    await page.locator(`#${f.id}`).fill(value);
    entered.set(f.token === 'street-address' ? 'street-address' : f.token, value);
  }
  await page.locator('[data-sj-next]:visible').first().click();
  const later = await page.evaluate(collectStepFields);
  const fields = [];
  for (const f of later) {
    const original = entered.get(f.token);
    if (original === undefined) continue;
    let status: 'prefilled' | 'offered' | 'missing' = 'missing';
    if (f.value === original) status = 'prefilled';
    else if (f.listValues.includes(original)) status = 'offered';
    else if (f.reuse.length > 0) {
      await page.locator(`#${f.reuse[0]}`).check();
      const after = await page.evaluate(
        (id) => (document.getElementById(id) as HTMLInputElement).value,
        f.id,
      );
      if (after === original) status = 'offered';
    }
    fields.push({ id: `#${f.id}`, token: f.token, status, exempt: f.exempt });
  }
  return redundantEntry(fields);
}

test.describe('3.3.7', () => {
  test('@release 3.3.7 | pass-prefilled | earlier entries are prefilled', async ({ page }) => {
    expect((await redundantVerdict(page, 'pass-prefilled')).failures).toEqual([]);
  });
  test('@release 3.3.7 | pass-offered | a "same as" control reuses the earlier entries', async ({
    page,
  }) => {
    expect((await redundantVerdict(page, 'pass-offered')).failures).toEqual([]);
  });
  test('@release 3.3.7 | fail | asking again with no reuse is reported', async ({ page }) => {
    const v = await redundantVerdict(page, 'fail');
    expect(v.pass).toBe(false);
    expect(v.failures.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// 3.3.8 Accessible Authentication (Minimum)
// ---------------------------------------------------------------------------------------------

async function authVerdict(page: Page, name: string) {
  await page.goto(fx(`auth/${name}`));
  const m = await page.evaluate(collectAuth);
  const fields = [];
  for (const f of m.fields) {
    // Password-manager / OTP-autofill simulation: a programmatic fill must be kept as typed.
    const sample =
      f.kind === 'otp'
        ? '123456'
        : f.kind === 'password'
          ? 'c0rrect-horse-battery'
          : 'ada@example.com';
    await page.locator(`#${f.id}`).fill('');
    await page.locator(`#${f.id}`).fill(sample);
    await page.waitForTimeout(50);
    const kept = (await page.locator(`#${f.id}`).inputValue()) === sample;
    fields.push({ ...f, fillKept: kept });
  }
  return accessibleAuthentication({ fields: fields as never, cognitive: m.cognitive });
}

test.describe('3.3.8', () => {
  test('@release 3.3.8 | pass | manager attributes, paste, fill and one-time-code work; no cognitive test', async ({
    page,
  }) => {
    expect((await authVerdict(page, 'pass')).failures).toEqual([]);
  });
  test('@release 3.3.8 | fail-paste | blocked paste and autocomplete=off are reported', async ({
    page,
  }) => {
    const v = await authVerdict(page, 'fail-paste');
    expect(v.pass).toBe(false);
    expect(v.failures.join()).toContain('paste is blocked');
    expect(v.failures.join()).toContain('autocomplete');
  });
  test('@release 3.3.8 | fail-otp | a code field that truncates a filled code is reported', async ({
    page,
  }) => {
    const v = await authVerdict(page, 'fail-otp');
    expect(v.pass).toBe(false);
    expect(v.failures.join()).toContain('programmatic fill');
  });
  test('@release 3.3.8 | fail-captcha | a cognitive function test is reported', async ({
    page,
  }) => {
    const v = await authVerdict(page, 'fail-captcha');
    expect(v.pass).toBe(false);
    expect(v.failures.join()).toContain('cognitive function test');
  });
});

// ---------------------------------------------------------------------------------------------
// 3.2.6 Consistent Help
// ---------------------------------------------------------------------------------------------

async function helpVerdict(page: Page, urls: string[]) {
  const pages = [];
  for (const u of urls) {
    await page.goto(u);
    pages.push(await page.evaluate(collectHelp));
  }
  return consistentHelp(pages);
}

test.describe('3.2.6', () => {
  test('@release 3.2.6 | pass | help keeps its place across three pages', async ({ page }) => {
    const v = await helpVerdict(
      page,
      [1, 2, 3].map((i) => fx(`help/pass/page${i}`)),
    );
    expect(v.failures).toEqual([]);
  });
  test('@release 3.2.6 | fail | help that moves relative to other content is reported', async ({
    page,
  }) => {
    const v = await helpVerdict(
      page,
      [1, 2, 3].map((i) => fx(`help/fail/page${i}`)),
    );
    expect(v.pass).toBe(false);
    expect(v.failures.join()).toMatch(/page2/);
    expect(v.failures.join()).toMatch(/page3/);
  });
  test('@release 3.2.6 | fail | an unmarked help-like link is reported, not silently ignored', async ({
    page,
  }) => {
    const v = await helpVerdict(page, [fx('help/pass/page1'), fx('help/fail/unmarked')]);
    expect(v.pass).toBe(false);
    expect(v.failures.join()).toContain('not marked data-sj-help');
  });
});
