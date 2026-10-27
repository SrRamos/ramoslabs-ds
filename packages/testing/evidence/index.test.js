import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEvidence, PENDING } from './index.js';

const PAIRS = [
  ['nvda', 'NVDA', 'windows', 'chrome', 'nvda'],
  ['jaws', 'JAWS', 'windows', 'chrome', 'jaws'],
  ['voiceover-macos', 'VoiceOver', 'macos', 'safari', 'vo-macos'],
  ['voiceover-ios', 'VoiceOver', 'ios', 'safari', 'vo-ios'],
  ['talkback', 'TalkBack', 'android', 'chrome', 'talkback'],
];

const entry = (over = {}) => ({
  id: 'x',
  kind: 'observation',
  pattern: 'button',
  at: 'NVDA',
  at_version: null,
  browser: 'Chrome',
  browser_version: null,
  platform: 'windows',
  platform_version: null,
  behavior: 'b',
  impact: 'none',
  source_url: 'https://example.org/a',
  source_date: '2026-01-01',
  retrieved: '2026-10-27',
  source_tier: 'T1',
  decision: 'd',
  constraints: { focusStrategy: 'native' },
  test_status: 'evidence-only',
  next_review: '2027-01-27',
  ...over,
});

/** A complete, valid registry file for `button` plus a matching contract. */
function build() {
  const entries = [
    entry({
      id: 'cross',
      kind: 'contract',
      impact: undefined,
      at: 'cross-AT',
      platform: 'cross',
      browser: 'cross-browser',
    }),
    ...PAIRS.map(([, at, platform, browser, id]) =>
      entry({
        id: `${id}-1`,
        at,
        platform,
        browser: browser[0].toUpperCase() + browser.slice(1),
        test_status: at === 'VoiceOver' ? 'pending-real-test' : 'evidence-only',
      }),
    ),
  ];
  const registry = {
    pattern: 'button',
    recommended: {
      variant: 'v',
      constraints: { focusStrategy: 'native' },
      supportedBy: ['cross'],
      atEvidence: Object.fromEntries(PAIRS.map(([key, , , , id]) => [key, [`${id}-1`]])),
    },
    entries,
  };
  const contract = {
    pattern: { apg: 'button', evidence: 'button' },
    focus: { strategy: 'native', owner: 'root' },
    a11y: {
      atSupport: PAIRS.map(([, at, platform, browser, id]) => ({
        at: at.toLowerCase(),
        platform,
        browser,
        test_status: at === 'VoiceOver' ? 'pending-real-test' : 'evidence-only',
        evidence: [`at-support/button.json#${id}-1`],
      })),
    },
  };
  return { registry, contract };
}

/** @param {{registry: any, contract: any}} parts */
function setup({ registry, contract }) {
  const base = mkdtempSync(join(tmpdir(), 'evidence-'));
  const contractsDir = join(base, 'contracts');
  const registryDir = join(base, 'at-support');
  mkdirSync(contractsDir);
  mkdirSync(registryDir);
  writeFileSync(join(registryDir, 'button.json'), JSON.stringify(registry));
  writeFileSync(join(contractsDir, 'button.contract.json'), JSON.stringify(contract));
  return { contractsDir, registryDir, today: '2026-10-27' };
}
const run = (/** @type {(p: any) => void} */ mutate = () => {}) => {
  const parts = build();
  mutate(parts);
  return checkEvidence(setup(parts));
};
const text = (/** @type {{errors: string[]}} */ r) => r.errors.join('\n');

describe('evidence:check baseline', () => {
  it('passes a complete registry and contract, and nothing is pending', () => {
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.checkedRefs).toBe(5);
    expect(PENDING).toEqual([]);
  });
});

describe('ref resolution and staleness', () => {
  it('fails a seeded stale entry', () => {
    const r = run(({ registry }) => {
      registry.entries[1].retrieved = '2026-04-01';
      registry.entries[1].next_review = '2026-10-26';
    });
    expect(text(r)).toMatch(/stale/);
  });

  it('fails a dangling entry id and a missing registry file', () => {
    expect(
      text(
        run(
          ({ contract }) => (contract.a11y.atSupport[0].evidence = ['at-support/button.json#nope']),
        ),
      ),
    ).toMatch(/no entry "nope"/);
    expect(
      text(
        run(({ contract }) => {
          contract.pattern.evidence = undefined;
          contract.a11y.atSupport[0].evidence = ['at-support/ghost.json#x'];
        }),
      ),
    ).toMatch(/does not exist/);
  });

  it('fails a malformed ref and an AT mismatch', () => {
    expect(
      text(run(({ contract }) => (contract.a11y.atSupport[0].evidence = ['button.json#nvda-1']))),
    ).toMatch(/malformed/);
    expect(text(run(({ contract }) => (contract.a11y.atSupport[0].at = 'jaws')))).toMatch(
      /does not match/,
    );
  });

  it('fails a ref that points outside the declared registry pattern', () => {
    expect(text(run(({ contract }) => (contract.pattern.evidence = 'switch')))).toMatch(
      /outside the declared pattern.evidence/,
    );
  });
});

describe('decision-conflict (structured constraints only)', () => {
  it('fails a conflicting focusStrategy on the recommended block and on a referenced entry', () => {
    expect(
      text(run(({ registry }) => (registry.recommended.constraints.focusStrategy = 'roving'))),
    ).toMatch(/focusStrategy "roving" but contract focus.strategy is "native"/);
    expect(
      text(run(({ registry }) => (registry.entries[1].constraints.focusStrategy = 'roving'))),
    ).toMatch(/registry button.json#nvda-1/);
  });

  it('never compares prose decision', () => {
    expect(
      run(({ registry }) => (registry.entries[1].decision = 'use roving, not native')).errors,
    ).toEqual([]);
  });

  it('fails a listboxMount that the contract resolves differently, and accepts one it resolves equally', () => {
    const withMount =
      (/** @type {any} */ contractMount) =>
      (/** @type {any} */ { registry, contract }) => {
        registry.recommended.constraints.listboxMount = { fine: 'top-layer', coarse: 'inline' };
        contract.overlay = { kind: 'popover', listboxMount: contractMount };
      };
    expect(
      run(withMount({ default: 'top-layer', byAnyPointer: { coarse: 'inline' } })).errors,
    ).toEqual([]);
    expect(text(run(withMount({ default: 'top-layer' })))).toMatch(
      /listboxMount.coarse "inline" but the contract resolves it to "top-layer"/,
    );
    expect(
      text(
        run(
          ({ registry }) => (registry.recommended.constraints.listboxMount = { coarse: 'inline' }),
        ),
      ),
    ).toMatch(/no overlay.listboxMount/);
  });

  it('fails nativeOnTouch with no nativeFallback', () => {
    expect(
      text(run(({ registry }) => (registry.recommended.constraints.nativeOnTouch = true))),
    ).toMatch(/nativeOnTouch is true/);
  });
});

describe('pattern coverage', () => {
  it('fails a pattern with no registry file (returned to the research peer)', () => {
    expect(text(run(({ contract }) => (contract.pattern = { apg: 'ghost' })))).toMatch(
      /unmapped pattern, return to the research peer/,
    );
  });

  it('fails a registry file missing an entry for a primary pair', () => {
    const r = run(({ registry, contract }) => {
      registry.entries = registry.entries.filter((/** @type {any} */ e) => e.id !== 'talkback-1');
      registry.recommended.atEvidence.talkback = 'no-measured-evidence';
      contract.a11y.atSupport = contract.a11y.atSupport.filter(
        (/** @type {any} */ r) => r.at !== 'talkback',
      );
    });
    expect(text(r)).toMatch(/has no entry for talkback \(talkback\/android\)/);
    expect(text(r)).toMatch(/atSupport has no row with evidence for talkback/);
  });

  it('fails a contract that omits a primary pair the registry has', () => {
    expect(text(run(({ contract }) => contract.a11y.atSupport.pop()))).toMatch(
      /atSupport has no row with evidence for talkback/,
    );
  });
});

describe('registry validation runs inside evidence:check (W1-315)', () => {
  it('fails an invalid registry file even when no contract uses it', () => {
    expect(text(run(({ registry }) => (registry.entries[1].test_status = 'tested-real')))).toMatch(
      /registry button.json: .*tested_on/,
    );
  });
});
