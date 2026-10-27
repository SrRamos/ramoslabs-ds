// @ts-check
// Contract-aware CSS checks (W1-307, ADR-010 "Lint"). Pure and dependency-free: the worker's
// `lint_css` tool and the repo lint both call it, so the rule has one definition.
//
// A selector can reference a component's public hooks: the per-part class `sj-<slug>__<part>`
// and the attributes `data-part` and `data-state` (ARCHITECTURE, styling contract). The truth
// for those names is the registry (generated from the contracts), never this file. A name the
// registry does not hold is reported; a component the registry does not hold is reported as
// having no contract rather than guessed at.

/**
 * @typedef {{ part: string }} PartLike
 * @typedef {{ slug: string, anatomy: PartLike[], state: { machine: string[] } }} ComponentLike
 * @typedef {{ value: string, issue: string, suggestion: string, rule: string }} CssContractFinding
 */

const CLASS_HOOK = /\.sj-([a-z0-9]+(?:-[a-z0-9]+)*)__([a-z0-9]+(?:-[a-z0-9]+)*)/g;
const ROOT_CLASS = /\.sj-([a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9_-])/g;
const ATTR =
  /\[\s*(data-part|data-state)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]"']+))\s*(?:[is]\s*)?\]/gi;

/**
 * Selector preludes (text before `{`) outside at-rule preludes, comments removed.
 * @param {string} css
 * @returns {string[]}
 */
export function selectorsOf(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  /** @type {string[]} */
  const out = [];
  for (const m of code.matchAll(/([^{}]+)\{/g)) {
    const prelude = (m[1] ?? '').split(';').pop()?.trim() ?? '';
    if (prelude && !prelude.startsWith('@')) out.push(prelude);
  }
  return out;
}

/**
 * @param {string} css
 * @param {ComponentLike[]} components registry `components` (or any list with the same fields)
 * @returns {CssContractFinding[]}
 */
export function lintCssContract(css, components) {
  const bySlug = new Map(components.map((c) => [c.slug, c]));
  const known = [...bySlug.keys()].join(', ') || 'none yet';
  /** @type {CssContractFinding[]} */
  const findings = [];
  const seen = new Set();
  /** @param {CssContractFinding} f */
  const add = (f) => {
    const key = `${f.rule}|${f.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(f);
  };

  for (const selector of selectorsOf(css).flatMap((s) => s.split(','))) {
    /** @type {Set<string>} */
    const slugs = new Set();

    for (const m of selector.matchAll(CLASS_HOOK)) {
      const [hook, slug = '', part = ''] = m;
      slugs.add(slug);
      const c = bySlug.get(slug);
      if (!c) {
        add({
          rule: 'contract/unknown-component',
          value: hook,
          issue: `no contract for component "${slug}" in the registry`,
          suggestion: `use a component from the registry (${known}); call list_components`,
        });
      } else if (!c.anatomy.some((p) => p.part === part)) {
        add({
          rule: 'contract/unknown-part',
          value: hook,
          issue: `"${part}" is not an anatomy part of ${slug}`,
          suggestion: `parts of ${slug}: ${c.anatomy.map((p) => p.part).join(', ')}`,
        });
      }
    }
    for (const m of selector.matchAll(ROOT_CLASS)) slugs.add(m[1] ?? '');

    // data-part / data-state are checked only against the components this selector names, so a
    // selector with no known component makes no claim.
    const scope = [...slugs].flatMap((s) => bySlug.get(s) ?? []);
    if (scope.length === 0) continue;
    for (const m of selector.matchAll(ATTR)) {
      const attr = m[1];
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      if (attr === 'data-part' && !scope.some((c) => c.anatomy.some((p) => p.part === value))) {
        add({
          rule: 'contract/unknown-data-part',
          value: `[data-part="${value}"]`,
          issue: `"${value}" is not an anatomy part of ${scope.map((c) => c.slug).join(', ')}`,
          suggestion: scope
            .map((c) => `${c.slug}: ${c.anatomy.map((p) => p.part).join(', ')}`)
            .join('; '),
        });
      }
      if (attr === 'data-state' && !scope.some((c) => c.state.machine.includes(value))) {
        add({
          rule: 'contract/unknown-data-state',
          value: `[data-state="${value}"]`,
          issue: `"${value}" is not a state of ${scope.map((c) => c.slug).join(', ')}`,
          suggestion: scope.map((c) => `${c.slug}: ${c.state.machine.join(', ')}`).join('; '),
        });
      }
    }
  }
  return findings;
}
