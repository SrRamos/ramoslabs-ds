// Text safety on every adapter (W1-311, ADR-002 text nodes only, ADR-013 L2). Markup-like consumer
// strings go through the probe label in a real browser and must render as literal text: no element
// created from the string, no script run, no dialog opened. A seeded innerHTML wrapper must fail.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostScript } from './bundle';
import type { AdapterName, Mode } from './host/entry';

const here = dirname(fileURLToPath(import.meta.url));
const component: string = JSON.parse(
  readFileSync(join(here, '../probe/probe.contract.json'), 'utf8'),
).name;

const ADAPTERS: readonly AdapterName[] = ['react', 'vue', 'vanilla'];

/** Markup-like consumer strings. `creates` marks payloads that would add elements if written as markup. */
const PAYLOADS = [
  { name: 'img onerror', text: '<img src=x onerror="window.__pwned=1">', creates: true },
  { name: 'img alert', text: '<img src=x onerror=alert(1)>', creates: true },
  { name: 'bold', text: '<b>x</b>', creates: true },
  { name: 'script', text: '<script>window.__pwned=1</script>', creates: true },
  { name: 'entity', text: '&lt;', creates: false },
  { name: 'mustache', text: '{{x}}', creates: false },
] as const;

const PLAIN = 'plain';

interface Snapshot {
  buttons: number;
  text: string | null;
  tags: string[];
  pwned: unknown;
}

/** Loads the host page once per test; the bundle is injected as an inline module. */
async function open(page: Page): Promise<void> {
  await page.setContent(
    '<!doctype html><html lang="en"><body><main id="root"></main></body></html>',
  );
  await page.addScriptTag({ content: await hostScript(), type: 'module' });
  await page.waitForFunction(() => window.__ts?.ready === true);
}

/** Mounts one adapter with a label and reads what the DOM actually contains. */
async function snapshot(
  page: Page,
  adapter: AdapterName,
  label: string,
  mode: Mode,
): Promise<Snapshot> {
  await page.evaluate(() => {
    delete (window as unknown as { __pwned?: unknown }).__pwned;
  });
  await page.evaluate(([a, l, m]) => window.__ts.mount(a, l, m), [adapter, label, mode] as const);
  // Let any injected `onerror` handler fire before reading the page.
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
  return page.evaluate(() => {
    const buttons = document.querySelectorAll('#root button');
    const button = buttons[0];
    return {
      buttons: buttons.length,
      text: button?.textContent ?? null,
      tags: button ? Array.from(button.querySelectorAll('*'), (el) => el.tagName) : [],
      pwned: (window as unknown as { __pwned?: unknown }).__pwned,
    };
  });
}

/** Returns the list of violations for one label (empty when the text is safe). */
async function check(
  page: Page,
  adapter: AdapterName,
  label: string,
  mode: Mode,
): Promise<string[]> {
  const dialogs: string[] = [];
  const onDialog = (d: { message(): string; dismiss(): Promise<void> }) => {
    dialogs.push(d.message());
    void d.dismiss();
  };
  page.on('dialog', onDialog);
  try {
    // The plain-text baseline has the same mode, so only what the label adds is counted.
    const base = await snapshot(page, adapter, PLAIN, mode);
    const snap = await snapshot(page, adapter, label, mode);
    const failures: string[] = [];
    if (snap.buttons !== 1) failures.push(`expected one button, found ${snap.buttons}`);
    if (snap.text !== label) {
      failures.push(
        `text ${JSON.stringify(snap.text)} is not the literal ${JSON.stringify(label)}`,
      );
    }
    if (JSON.stringify(snap.tags) !== JSON.stringify(base.tags)) {
      failures.push(
        `elements ${JSON.stringify(snap.tags)} created from the string (plain baseline ${JSON.stringify(base.tags)})`,
      );
    }
    if (snap.pwned !== undefined) failures.push('script ran: window.__pwned was set');
    for (const message of dialogs) failures.push(`dialog opened: ${message}`);
    return failures;
  } finally {
    page.off('dialog', onDialog);
  }
}

for (const adapter of ADAPTERS) {
  test.describe(`${component} | ${adapter}`, () => {
    for (const p of PAYLOADS) {
      test(`${component} | ${adapter} | text-safety | ${p.name}`, async ({ page }) => {
        await open(page);
        expect(await check(page, adapter, p.text, 'safe')).toEqual([]);
      });

      if (p.creates) {
        test(`${component} | ${adapter} | text-safety | ${p.name} | seeded innerHTML is caught`, async ({
          page,
        }) => {
          await open(page);
          const failures = await check(page, adapter, p.text, 'innerhtml');
          expect(failures, 'seeded innerHTML defect went undetected').not.toEqual([]);
          expect(failures.join('\n')).toMatch(/created from the string|script ran|dialog opened/);
        });
      }
    }
  });
}
