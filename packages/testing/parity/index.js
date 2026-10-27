// @ts-check
// Parity matrix generator (W1-313, ADR-013 L6). Rows are
// `component / scenario / action / browser / adapter / path`; a cell is passed, failed,
// not-applicable or not-run (with a reason). Executed = passed + failed.
//
// Cell STATUS comes from the Playwright JSON results only. What the matrix must CONTAIN comes from
// a separate declaration (contract-derived: dimensions plus explicit exemptions), because "results
// only" cannot say what is missing. A declared cell with no result, and no exemption that carries a
// reason, is a MISSING cell and fails the check. Nothing is inferred, defaulted or papered over.

/**
 * @typedef {'passed'|'failed'|'not-applicable'|'not-run'} CellStatus
 * @typedef {{ component: string, adapter: string, scenario: string, action: string, path: string }} Title
 * @typedef {{ browser: string, adapter: string, path: string, component: string, scenario: string, action: string, status: CellStatus, executed: boolean, reason?: string, notes?: string[] }} Cell
 * @typedef {{ id: string, status?: 'not-applicable'|'not-run', reason?: string }} BrowserDecl
 * @typedef {{ browser?: string, adapter?: string, path?: string, scenario?: string, action?: string }} Match
 * @typedef {{ match: Match, status: 'not-applicable'|'not-run', reason: string }} Exemption
 * @typedef {{ version: 1, component: string, browsers: BrowserDecl[], adapters: string[], paths: { id: string }[], scenarios: { scenario: string, action: string }[], exemptions?: Exemption[] }} Expected
 */

export const SEP = ' | ';
const PATH_PREFIX = 'path=';

/**
 * Parses a matrix test title: `<component> | <adapter> | <scenario> | <action> | path=<path>`.
 * Anything else (harness checks, seeded-defect tests) is not a matrix row and returns null.
 * @param {string} title
 * @returns {Title | null}
 */
export function parseTitle(title) {
  const p = title.split(SEP);
  if (p.length !== 5 || !p[4].startsWith(PATH_PREFIX)) return null;
  const path = p[4].slice(PATH_PREFIX.length);
  if (p.some((s) => s.trim() === '') || path === '') return null;
  return { component: p[0], adapter: p[1], scenario: p[2], action: p[3], path };
}

export const cellKey = (
  /** @type {{browser:string,component:string,adapter:string,path:string,scenario:string,action:string}} */ c,
) => [c.component, c.scenario, c.action, c.browser, c.adapter, c.path].join('\u0000');

/**
 * Flattens one Playwright JSON report into result rows.
 * @param {any} report
 * @param {string} [source]
 */
export function collectResults(report, source = 'results') {
  /** @type {{ title: Title, browser: string, outcome: 'passed'|'failed'|'skipped'|'retried', reason?: string, notes: string[], source: string }[]} */
  const rows = [];
  let ignored = 0;
  /** @param {any} suite */
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const title = parseTitle(spec.title);
        if (title === null) {
          ignored += 1;
          continue;
        }
        const results = t.results ?? [];
        const notes = (t.annotations ?? [])
          .filter((/** @type {any} */ a) => a.type === 'noop')
          .map((/** @type {any} */ a) => String(a.description ?? a.type));
        /** @type {'passed'|'failed'|'skipped'|'retried'} */
        let outcome;
        /** @type {string|undefined} */
        let reason;
        if (results.length > 1 || t.status === 'flaky') {
          outcome = 'retried';
          reason = 'test was retried; retries diagnose, they never certify (ADR-013)';
        } else if (t.status === 'skipped' || results[0]?.status === 'skipped') {
          outcome = 'skipped';
          const a = (t.annotations ?? []).find((/** @type {any} */ x) => x.type === 'skip');
          reason = a?.description;
        } else if (t.status === 'expected' && results[0]?.status === 'passed') {
          outcome = 'passed';
        } else {
          outcome = 'failed';
          reason = results[0]?.error?.message?.split('\n')[0] ?? results[0]?.status ?? t.status;
        }
        rows.push({
          title,
          browser: String(t.projectName ?? ''),
          outcome,
          ...(reason !== undefined && { reason }),
          notes,
          source,
        });
      }
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of report.suites ?? []) walk(s);
  return { rows, ignored };
}

/** @param {Match} m @param {{browser:string,adapter:string,path:string,scenario:string,action:string}} c */
const matches = (m, c) =>
  (m.browser === undefined || m.browser === c.browser) &&
  (m.adapter === undefined || m.adapter === c.adapter) &&
  (m.path === undefined || m.path === c.path) &&
  (m.scenario === undefined || m.scenario === c.scenario) &&
  (m.action === undefined || m.action === c.action);

/**
 * Validates the declaration itself. A malformed declaration cannot certify anything.
 * @param {Expected} e
 * @returns {string[]}
 */
export function validateExpected(e) {
  /** @type {string[]} */
  const out = [];
  if (e?.version !== 1) out.push('declaration version must be 1');
  if (!e?.component) out.push('declaration has no component');
  for (const k of /** @type {const} */ (['browsers', 'adapters', 'paths', 'scenarios']))
    if (!Array.isArray(e?.[k]) || e[k].length === 0) out.push(`declaration has no ${k}`);
  for (const b of e?.browsers ?? [])
    if (b.status !== undefined && !b.reason)
      out.push(`browser "${b.id}" is declared ${b.status} without a reason`);
  for (const x of e?.exemptions ?? []) {
    if (!x.reason) out.push(`exemption ${JSON.stringify(x.match)} has no reason`);
    if (x.status !== 'not-applicable' && x.status !== 'not-run')
      out.push(`exemption ${JSON.stringify(x.match)} has status "${x.status}"`);
  }
  return out;
}

/**
 * Builds the matrix.
 * @param {{ expected: Expected, results: { rows: ReturnType<typeof collectResults>['rows'], ignored?: number }[] }} input
 */
export function buildMatrix({ expected, results }) {
  /** @type {string[]} */
  const invalid = validateExpected(expected);
  const exemptions = expected.exemptions ?? [];
  /** @type {Map<string, ReturnType<typeof collectResults>['rows'][number]>} */
  const byKey = new Map();
  let ignored = 0;
  for (const r of results) {
    ignored += r.ignored ?? 0;
    for (const row of r.rows) {
      const k = cellKey({ ...row.title, browser: row.browser });
      if (byKey.has(k)) {
        invalid.push(
          `duplicate result for ${describe({ ...row.title, browser: row.browser })} (${byKey.get(k)?.source} and ${row.source})`,
        );
        continue;
      }
      byKey.set(k, row);
    }
  }

  /** @type {Cell[]} */
  const cells = [];
  /** @type {Cell[]} */
  const missing = [];
  const used = new Set();
  for (const b of expected.browsers)
    for (const adapter of expected.adapters)
      for (const p of expected.paths)
        for (const s of expected.scenarios) {
          const id = {
            component: expected.component,
            scenario: s.scenario,
            action: s.action,
            browser: b.id,
            adapter,
            path: p.id,
          };
          const key = cellKey(id);
          const row = byKey.get(key);
          const exempt =
            b.status !== undefined
              ? { status: b.status, reason: /** @type {string} */ (b.reason) }
              : exemptions.find((x) => matches(x.match, id));
          if (row) {
            used.add(key);
            if (exempt)
              invalid.push(`${describe(id)} is declared ${exempt.status} but has a result`);
            if (row.outcome === 'retried' || (row.outcome === 'skipped' && !row.reason)) {
              invalid.push(
                `${describe(id)}: ${row.outcome === 'retried' ? row.reason : 'skipped without a reason (skip needs issue and owner)'}`,
              );
            }
            /** @type {CellStatus} */
            const status =
              row.outcome === 'passed'
                ? 'passed'
                : row.outcome === 'skipped'
                  ? 'not-run'
                  : 'failed';
            cells.push({
              ...id,
              status,
              executed: status === 'passed' || status === 'failed',
              ...(row.reason !== undefined && { reason: row.reason }),
              ...(row.notes.length > 0 && { notes: row.notes }),
            });
          } else if (exempt) {
            cells.push({
              ...id,
              status: exempt.status,
              executed: false,
              reason: exempt.reason,
            });
          } else {
            /** @type {Cell} */
            const c = {
              ...id,
              status: 'not-run',
              executed: false,
              reason: 'MISSING: declared by the matrix, no result and no exemption',
            };
            cells.push(c);
            missing.push(c);
          }
        }
  const extra = [...byKey.entries()]
    .filter(([k]) => !used.has(k))
    .map(([, r]) => ({ ...r.title, browser: r.browser, outcome: r.outcome }));

  const count = (/** @type {CellStatus} */ s) => cells.filter((c) => c.status === s).length;
  const summary = {
    cells: cells.length,
    executed: cells.filter((c) => c.executed).length,
    passed: count('passed'),
    failed: count('failed'),
    notApplicable: count('not-applicable'),
    notRun: count('not-run'),
    missing: missing.length,
    extra: extra.length,
    ignoredNonMatrixTests: ignored,
  };
  return {
    component: expected.component,
    summary,
    cells,
    missing,
    extra,
    invalid,
    /** The L6 gate: no missing cell, no failed cell, nothing invalid, nothing undeclared. */
    ok: missing.length === 0 && summary.failed === 0 && invalid.length === 0 && extra.length === 0,
  };
}

/** @param {{component:string,scenario:string,action:string,browser:string,adapter:string,path:string}} c */
export const describe = (c) =>
  `${c.component} / ${c.scenario} / ${c.action} / ${c.browser} / ${c.adapter} / ${c.path}`;

/** Deterministic Markdown view: counts per browser x adapter x path, then every problem and reason. */
export function renderMarkdown(/** @type {ReturnType<typeof buildMatrix>} */ m) {
  const s = m.summary;
  const out = [
    `# Parity matrix: ${m.component}`,
    '',
    `Gate: **${m.ok ? 'PASS' : 'FAIL'}**. ${s.cells} cells: ${s.executed} executed (${s.passed} passed, ${s.failed} failed), ${s.notApplicable} not-applicable, ${s.notRun} not run (${s.missing} of them MISSING).`,
    '',
    'Generated from results only; a declared cell without a result is listed as missing, never filled in.',
    '',
  ];
  /** @type {Map<string, Map<string, Map<string, Cell[]>>>} */
  const tree = new Map();
  for (const c of m.cells) {
    const a = tree.get(c.browser) ?? new Map();
    const b = a.get(c.adapter) ?? new Map();
    b.set(c.path, [...(b.get(c.path) ?? []), c]);
    a.set(c.adapter, b);
    tree.set(c.browser, a);
  }
  const paths = [...new Set(m.cells.map((c) => c.path))];
  for (const [browser, adapters] of tree) {
    out.push(
      `## ${browser}`,
      '',
      `| adapter | ${paths.join(' | ')} |`,
      `|---|${paths.map(() => '---').join('|')}|`,
    );
    for (const [adapter, byPath] of adapters)
      out.push(
        `| ${adapter} | ${paths.map((p) => cellSummary(byPath.get(p) ?? [])).join(' | ')} |`,
      );
    out.push('');
  }
  const reasons = new Map();
  for (const c of m.cells)
    if (c.status === 'not-run' || c.status === 'not-applicable')
      reasons.set(`${c.browser}: ${c.status}: ${c.reason}`, true);
  if (reasons.size > 0)
    out.push(
      '## Not run / not applicable (reasons)',
      '',
      ...[...reasons.keys()].map((r) => `- ${r}`),
      '',
    );
  const noop = m.cells.filter((c) => c.notes);
  if (noop.length > 0) {
    out.push('## Forced-false paths identical to native on that engine', '');
    const seen = new Set(noop.map((c) => `${c.browser}: ${c.path} (${c.notes?.[0]})`));
    for (const n of seen) out.push(`- ${n}`);
    out.push('');
  }
  if (m.invalid.length > 0) out.push('## Invalid', '', ...m.invalid.map((i) => `- ${i}`), '');
  if (m.missing.length > 0)
    out.push('## Missing cells', '', ...m.missing.map((c) => `- ${describe(c)}`), '');
  const failed = m.cells.filter((c) => c.status === 'failed');
  if (failed.length > 0)
    out.push(
      '## Failed cells',
      '',
      ...failed.map((c) => `- ${describe(c)}: ${c.reason ?? ''}`),
      '',
    );
  if (m.extra.length > 0)
    out.push('## Results with no declared cell', '', ...m.extra.map((c) => `- ${describe(c)}`), '');
  return out.join('\n') + '\n';
}

/** @param {Cell[]} cs */
function cellSummary(cs) {
  if (cs.length === 0) return 'n/a';
  const n = (/** @type {CellStatus} */ s) => cs.filter((c) => c.status === s).length;
  if (n('passed') === cs.length) return `${cs.length}/${cs.length} passed`;
  const parts = [];
  if (n('passed')) parts.push(`${n('passed')} passed`);
  if (n('failed')) parts.push(`${n('failed')} FAILED`);
  if (n('not-applicable')) parts.push(`${n('not-applicable')} n/a`);
  if (n('not-run')) parts.push(`${n('not-run')} not run`);
  return parts.join(', ');
}
