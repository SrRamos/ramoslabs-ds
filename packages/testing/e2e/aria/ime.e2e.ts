// CDP IME composition (W1-309c, ADR-013 L2, ADR-012). Drives a real composition on Chromium with
// `Input.imeSetComposition` / `Input.insertText` against the test-only editable host (ime/host.ts)
// built on core's typeahead/IME module (W1-107). Asserted: nothing is fed to typeahead while a
// composition is open, compositionend releases the guard, and typing afterwards works again.
// Chromium only (CDP); other engines report skipped with the reason.
import { test, expect, type Page, type CDPSession } from '@playwright/test';

interface ImeState {
  active: string | null;
  buffer: string;
  composing: boolean;
  log: string[];
  value: string;
}
const state = (page: Page): Promise<ImeState> => page.evaluate(() => window.__ime.state());

async function open(page: Page, query = ''): Promise<CDPSession> {
  await page.goto(`/ime.html${query}`);
  await page.waitForFunction(() => window.__ime?.ready === true);
  await page.locator('#field').focus();
  return page.context().newCDPSession(page);
}

const compose = (cdp: CDPSession, text: string) =>
  cdp.send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });

/** The full scenario; returns every violated expectation so the seeded run can assert non-empty. */
async function scenario(page: Page, cdp: CDPSession): Promise<string[]> {
  const bad: string[] = [];
  const check = (cond: boolean, msg: string) => void (cond || bad.push(msg));

  // Type-ahead before composing: `a` -> Apple, buffer `a`.
  await page.keyboard.type('a');
  let s = await state(page);
  check(s.active === 'apple' && s.buffer === 'a', `plain typing: ${s.active}/${s.buffer}`);

  // Composition opens: the session flag is set and the stale buffer is dropped.
  await compose(cdp, 'あ');
  s = await state(page);
  check(
    s.log.some((l) => l.startsWith('compositionstart')),
    'no compositionstart reached the page',
  );
  check(
    s.log.some((l) => l === 'beforeinput|insertCompositionText|isComposing=true|あ'),
    'composition beforeinput not flagged isComposing',
  );
  check(s.composing, 'typeahead did not enter composing');
  check(s.buffer === '', `buffer "${s.buffer}" while composing`);
  // `あ` is a prefix of the item "あおい": feeding it would move the active option there.
  check(s.active === 'apple', `active moved to ${s.active} during composition`);

  await compose(cdp, 'あお');
  s = await state(page);
  check(s.buffer === '' && s.active === 'apple', `update fed typeahead: ${s.active}/${s.buffer}`);

  // Commit: compositionend releases the guard; the committed text is not typeahead input.
  await cdp.send('Input.insertText', { text: 'あお' });
  s = await state(page);
  check(
    s.log.some((l) => l.startsWith('compositionend')),
    'no compositionend',
  );
  check(!s.composing, 'typeahead still composing after compositionend');
  check(s.value.endsWith('あお'), `value "${s.value}" lacks the committed text`);
  check(s.buffer === '' && s.active === 'apple', `commit fed typeahead: ${s.active}/${s.buffer}`);

  // After the session, ordinary typing is typeahead again.
  await page.keyboard.type('b');
  s = await state(page);
  check(s.active === 'banana' && s.buffer === 'b', `typing after commit: ${s.active}/${s.buffer}`);
  return bad;
}

test.describe('ime composition', () => {
  test.beforeEach(({ browserName }) => {
    // #49 owner: SrRamos
    test.skip(browserName !== 'chromium', 'CDP Input.imeSetComposition exists on Chromium only');
  });

  test('SJTypeahead | core | ime composition is guarded', async ({ page }) => {
    const cdp = await open(page);
    expect(await scenario(page, cdp)).toEqual([]);
  });

  test('SJTypeahead | core | ime guard off is reported (seeded)', async ({ page }) => {
    const cdp = await open(page, '?guard=off');
    const bad = await scenario(page, cdp);
    expect(bad.length, 'bypassing the IME guard went undetected').toBeGreaterThan(0);
    expect(bad.join('\n')).toContain('while composing');
  });
});
