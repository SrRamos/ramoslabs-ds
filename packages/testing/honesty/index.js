// @ts-check
// AT honesty scan (W1-319, ADR-010 AT honesty gate, ADR-015, decision D2).
// Pure functions: no I/O here, so seeded violations are testable. `cli.js` does the file walk.
//
// Data rules (atSupport entries in contracts, entries in the evidence registry):
//   - `tested-real` needs a `tested_on` date and a non-empty `log`.
//   - Only VoiceOver may be `tested-real` (D2). NVDA, JAWS and TalkBack stay `evidence-only`.
//   - Any other status must not carry `tested_on` or `log`.
// Wording rules (prose, JSON strings, generated text):
//   - A sentence that names an evidence-only AT (NVDA, JAWS, TalkBack) or the status `evidence-only`
//     must not claim it is tested, verified or certified, unless the sentence negates the claim.
//   - A sentence that claims VoiceOver is tested, verified or certified needs a real `tested-real`
//     VoiceOver entry in the scanned data, unless it negates, defers or defines the claim.

/** @typedef {{ file: string, line: number, rule: string, text: string }} Violation */

const EVIDENCE_AT = /\b(nvda|jaws|talkback)\b|evidence-only/i;
const VOICEOVER = /\bvoice\s?over\b/i;
const CLAIM = /\b(tested|verified|certified|real-tested|validated)\b/i;
// Words that make a claim a negation, a definition or a deferral rather than a claim.
const NEGATED =
  /\b(not|never|no|none|nor|neither|without|untested|un-tested|cannot|can't|isn't|aren't|wasn't|weren't|doesn't|don't|n't|unverified|forbidden|forbids|fails?|reject(?:s|ed)?|label(?:l?ed|s)?|labelling|labeling|wording|wording|honesty|claims?|claiming|dishonest|dishonestly|until|unless|pending|planned|optional|later|upgrades?|once|when|if|would|will|should|must|may|future|todo|requires?|needs?|equivalent|to be)\b/i;
const DEFERRED_VO = NEGATED;

/** Neutralise status tokens so `tested-real` and `pending-real-test` are not read as claims. */
/** @param {string} s */
function stripStatusTokens(s) {
  return s
    .replace(/tested[-_]real/gi, 'STATUSTOKEN')
    .replace(/pending[-_]real[-_]test/gi, 'STATUSTOKEN')
    .replace(/real[-\s]test lane/gi, 'STATUSTOKEN')
    .replace(/no-measured-evidence/gi, 'STATUSTOKEN')
    .replace(/tested[_-]on/gi, 'STATUSTOKEN');
}

/**
 * Wording scan over text. Splits into sentences on newlines and sentence punctuation.
 * @param {string} file
 * @param {string} text
 * @param {{ hasRealVoiceOver?: boolean }} [opts]
 * @returns {Violation[]}
 */
export function scanWording(file, text, opts = {}) {
  /** @type {Violation[]} */
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const sentences = raw.split(/(?<=[.!?;])\s+(?=[A-Z"'`([*|-])/);
    for (const sentence of sentences) {
      const s = stripStatusTokens(sentence);
      if (!CLAIM.test(s)) continue;
      const negated = NEGATED.test(s);
      if (EVIDENCE_AT.test(s) && !negated) {
        out.push({
          file,
          line: i + 1,
          rule: 'evidence-only-claimed-tested',
          text: sentence.trim().slice(0, 200),
        });
      } else if (VOICEOVER.test(s) && !DEFERRED_VO.test(s) && !opts.hasRealVoiceOver) {
        out.push({
          file,
          line: i + 1,
          rule: 'voiceover-claimed-tested-without-entry',
          text: sentence.trim().slice(0, 200),
        });
      }
    }
  });
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Data scan over one parsed entry (an atSupport element or a registry record) carrying `test_status`.
 * @param {string} file
 * @param {string} where
 * @param {Record<string, any>} entry
 * @returns {Violation[]}
 */
export function scanEntry(file, where, entry) {
  /** @type {Violation[]} */
  const out = [];
  const at = String(entry.at ?? '').toLowerCase();
  /** @type {(rule: string, text: string) => number} */
  const add = (rule, text) => out.push({ file, line: 0, rule, text: `${where}: ${text}` });
  if (entry.test_status === 'tested-real') {
    if (at !== 'voiceover')
      add('non-voiceover-tested-real', `${at || '?'} cannot be tested-real (D2)`);
    if (typeof entry.tested_on !== 'string' || !DATE.test(entry.tested_on))
      add('tested-real-missing-date', 'tested-real needs a tested_on date');
    if (typeof entry.log !== 'string' || entry.log.trim() === '')
      add('tested-real-missing-log', 'tested-real needs a log reference');
  } else if (entry.tested_on !== undefined || entry.log !== undefined) {
    add(
      'tested-fields-without-tested-real',
      `${entry.test_status ?? 'no status'} must not carry tested_on or log`,
    );
  }
  return out;
}

/**
 * Walk parsed JSON, scan every object that has `test_status`, and report whether a real
 * VoiceOver entry exists.
 * @param {string} file
 * @param {unknown} json
 * @returns {{ violations: Violation[], realVoiceOver: boolean }}
 */
export function scanJsonData(file, json) {
  /** @type {Violation[]} */
  const violations = [];
  let realVoiceOver = false;
  /** @type {(node: any, path: string) => void} */
  const walk = (node, path) => {
    if (Array.isArray(node)) node.forEach((n, i) => walk(n, `${path}[${i}]`));
    else if (node && typeof node === 'object') {
      if (typeof node.test_status === 'string') {
        const v = scanEntry(file, path, node);
        violations.push(...v);
        if (
          node.test_status === 'tested-real' &&
          String(node.at).toLowerCase() === 'voiceover' &&
          v.length === 0
        )
          realVoiceOver = true;
      }
      for (const [k, val] of Object.entries(node)) walk(val, `${path}.${k}`);
    }
  };
  walk(json, '$');
  return { violations, realVoiceOver };
}

/**
 * Scan a set of files.
 * @param {{ file: string, content: string }[]} files
 * @returns {{ violations: Violation[], realVoiceOver: boolean }}
 */
export function scanFiles(files) {
  /** @type {Violation[]} */
  const violations = [];
  let realVoiceOver = false;
  for (const { file, content } of files) {
    if (file.endsWith('.json')) {
      try {
        const r = scanJsonData(file, JSON.parse(content));
        violations.push(...r.violations);
        realVoiceOver ||= r.realVoiceOver;
      } catch {
        // not parseable JSON: fall through to the wording scan only
      }
    }
  }
  for (const { file, content } of files) {
    violations.push(...scanWording(file, content, { hasRealVoiceOver: realVoiceOver }));
  }
  return { violations, realVoiceOver };
}
