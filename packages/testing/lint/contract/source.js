// @ts-check
// Contract-driven source lint (W1-307, ADR-010 "Lint"): unknown `kind`, preset using internals,
// missing label. Every rule reads the contracts; nothing is hard-coded about a component except
// the role vocabulary below. Pure (no fs): callers pass the parsed contracts.

/**
 * @typedef {{ kind: string }} KindLike
 * @typedef {{ name: string, kinds?: string[], props?: Array<{ name: string }>, anatomy: Array<{ part: string, element: string, role?: string }> }} ContractLike
 * @typedef {{ rule: string, file: string, line: number, message: string }} SourceFinding
 * @typedef {{ components: Map<string, { name: string, needsName: boolean, iconOnly: boolean }>, kinds: Set<string> }} ContractIndex
 */

// Roles and native controls that must expose an accessible name (WCAG 4.1.2). A component whose
// anatomy has one of these needs a label at the usage site.
const NAMED_ROLES = new Set([
  'button',
  'switch',
  'checkbox',
  'radio',
  'combobox',
  'textbox',
  'searchbox',
  'slider',
  'spinbutton',
  'tab',
  'menuitem',
  'option',
  'link',
]);
const NAMED_ELEMENTS = new Set(['button', 'input', 'select', 'textarea']);

/**
 * @param {{ contracts: ContractLike[], kinds: KindLike[] }} data
 * @returns {ContractIndex}
 */
export function buildIndex({ contracts, kinds }) {
  /** @type {ContractIndex['components']} */
  const components = new Map();
  for (const c of contracts) {
    components.set(c.name, {
      name: c.name,
      // A component with an `iconOnly` prop can render with no visible text (ADR-010, W1-C01).
      iconOnly: (c.props ?? []).some((p) => p.name === 'iconOnly'),
      needsName: c.anatomy.some(
        (p) => (p.role !== undefined && NAMED_ROLES.has(p.role)) || NAMED_ELEMENTS.has(p.element),
      ),
    });
  }
  return { components, kinds: new Set(kinds.map((k) => k.kind)) };
}

/**
 * Contract files themselves: a `kinds` entry must exist in the kinds contract.
 * @param {ContractLike & { kinds: string[] }} contract
 * @param {ContractIndex} index
 * @param {string} [file]
 * @returns {SourceFinding[]}
 */
export function lintContractData(contract, index, file = contract.name) {
  /** @type {SourceFinding[]} */
  const out = contract.kinds
    .filter((k) => !index.kinds.has(k))
    .map((k) => ({
      rule: 'contract/unknown-kind',
      file,
      line: 1,
      message: `${contract.name} declares kind "${k}", which is not in kinds.contract.json`,
    }));
  // An icon-only component must give consumers a way to supply the name (WCAG 4.1.2).
  const props = new Set((contract.props ?? []).map((p) => p.name));
  if (props.has('iconOnly') && !props.has('label'))
    out.push({
      rule: 'contract/icon-only-name',
      file,
      line: 1,
      message: `${contract.name} has an iconOnly prop but no label prop: an icon-only control needs an accessible name`,
    });
  return out;
}

/**
 * @typedef {{ name: string, attrs: string, selfClosing: boolean, start: number, end: number }} Tag
 */

/**
 * Opening tags of `SJ*` components. Walks quotes and brace depth so `>` inside an attribute
 * expression does not end the tag.
 * @param {string} source
 * @returns {Tag[]}
 */
function sjTags(source) {
  /** @type {Tag[]} */
  const tags = [];
  for (const m of source.matchAll(/<(SJ[A-Za-z0-9]*)(?=[\s/>])/g)) {
    const start = m.index ?? 0;
    let i = start + m[0].length;
    let quote = '';
    let depth = 0;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth <= 0) break;
    }
    const raw = source.slice(start + m[0].length, i);
    tags.push({
      name: m[1] ?? '',
      attrs: raw.replace(/\/\s*$/, ''),
      selfClosing: /\/\s*$/.test(raw),
      start,
      end: i + 1,
    });
  }
  return tags;
}

const ATTR_RE = /(?:^|\s)((?:v-bind)?:?[\w.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;

/**
 * @param {string} attrs
 * @returns {Array<{ name: string, value: string | undefined, expr: boolean }>}
 */
function parseAttrs(attrs) {
  return [...attrs.matchAll(ATTR_RE)].map((m) => {
    const name = m[1] ?? '';
    // A bound attribute (`:kind`, `v-bind:kind`) or a JSX `{...}` value is an expression; a plain
    // quoted value is a literal string.
    return { name, value: m[2] ?? m[3] ?? m[4], expr: m[4] !== undefined || name.includes(':') };
  });
}

/**
 * The static string an attribute holds: a plain quoted value, or an expression that is just a
 * string literal (`'email'`); anything dynamic returns undefined.
 */
function literalOf(/** @type {{ value: string | undefined, expr: boolean }} */ a) {
  if (a.value === undefined) return undefined;
  if (!a.expr) return a.value;
  const t = a.value.trim();
  const q = /^(['"`])([^'"`$]*)\1$/.exec(t);
  return q ? q[2] : undefined;
}

/** @param {string} source @param {number} index */
function lineAt(source, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) n++;
  return n;
}

const INTERNAL_SPEC = /(^|\/)(internal|runtime|src)(\/|$)/;
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;

/**
 * @param {string} source
 * @param {ContractIndex} index
 * @param {{ file?: string }} [options] `file` decides whether preset rules apply (a `presets/` path)
 * @returns {SourceFinding[]}
 */
export function lintSource(source, index, options = {}) {
  const file = options.file ?? '<source>';
  /** @type {SourceFinding[]} */
  const out = [];
  const tags = sjTags(source);

  for (const tag of tags) {
    const attrs = parseAttrs(tag.attrs);
    const line = lineAt(source, tag.start);

    // Rule: unknown kind. Only a literal is judged; a dynamic value makes no claim.
    for (const a of attrs) {
      if (a.name !== 'kind' && a.name !== ':kind' && a.name !== 'v-bind:kind') continue;
      const lit = literalOf(a);
      if (lit !== undefined && !index.kinds.has(lit)) {
        out.push({
          rule: 'contract/unknown-kind',
          file,
          line,
          message: `<${tag.name} kind="${lit}">: "${lit}" is not in kinds.contract.json`,
        });
      }
    }

    // Rule: icon-only without an accessible name. Visible content does not count: an icon-only
    // control's content is an icon. Only a name attribute does. A dynamic value is not judged.
    const comp = index.components.get(tag.name);
    const iconAttr = attrs.find((a) => /^(?::|v-bind:)?(?:iconOnly|icon-only)$/.test(a.name));
    const iconOnly =
      comp?.iconOnly === true &&
      iconAttr !== undefined &&
      !['false', '0'].includes((iconAttr.value ?? '').trim());
    if (iconOnly) {
      const spread =
        attrs.some((a) => a.name === 'v-bind' || a.name.startsWith('...')) ||
        /\{\s*\.\.\./.test(tag.attrs);
      const named = attrs.some((a) =>
        [
          'label',
          ':label',
          'aria-label',
          ':aria-label',
          'aria-labelledby',
          ':aria-labelledby',
        ].includes(a.name),
      );
      if (!named && !spread)
        out.push({
          rule: 'contract/icon-only-name',
          file,
          line,
          message: `<${tag.name} iconOnly> has no accessible name: add label, aria-label or aria-labelledby (visible content is only an icon)`,
        });
    }

    // Rule: missing label. Only components with a contract are judged.
    if (comp?.needsName && !iconOnly) {
      const spread = attrs.some((a) => a.name === 'v-bind' || a.name.startsWith('...'));
      const spreadJsx = /\{\s*\.\.\./.test(tag.attrs);
      const named = attrs.some((a) =>
        [
          'label',
          ':label',
          'aria-label',
          ':aria-label',
          'aria-labelledby',
          ':aria-labelledby',
        ].includes(a.name),
      );
      let hasContent = false;
      if (!tag.selfClosing) {
        const close = source.indexOf(`</${tag.name}>`, tag.end);
        hasContent = close !== -1 && source.slice(tag.end, close).trim() !== '';
      }
      if (!named && !hasContent && !spread && !spreadJsx) {
        out.push({
          rule: 'contract/missing-label',
          file,
          line,
          message: `<${tag.name}> has no accessible name: add label, aria-label, aria-labelledby or content`,
        });
      }
    }
  }

  // Rules for presets: only public primitives, and library-owned hooks are not set by hand.
  if (/(^|[\\/])presets[\\/]/.test(file)) {
    for (const m of source.matchAll(IMPORT_RE)) {
      const spec = (m[2] ?? '').replace(/\\/g, '/');
      const deepPrimitive = /(^|\/)primitives\/[^/]+\/.+/.test(spec);
      if (INTERNAL_SPEC.test(spec) || deepPrimitive) {
        out.push({
          rule: 'contract/preset-internals',
          file,
          line: lineAt(source, m.index ?? 0),
          message: `preset imports "${spec}": presets compose public primitives only (ADR-002)`,
        });
      }
    }
    for (const m of source.matchAll(/(?:^|[\s<{(,])(data-part|data-state)\s*=/g)) {
      out.push({
        rule: 'contract/preset-internals',
        file,
        line: lineAt(source, m.index ?? 0),
        message: `preset sets "${m[1]}" by hand: the adapter owns this hook (ADR-010)`,
      });
    }
  }
  return out;
}

/**
 * Reducer rule (G1 SHOULD-4, R2-SHOULD-1, ADR-003 "Controlled/uncontrolled"): a reducer never
 * reads a field the contract lists as `state.controllable`. Controlled values live only in
 * `view()`; the prop getter computes the next value from `view()` and submits `request(field,
 * next)`. Writing the field is the pipeline's path (uncontrolled mode applies `toEvent(next)`),
 * so `{ ...state, open: e.open }` passes.
 *
 * Honest scope: this is a textual check of `core/src/<slug>/reducer.ts` (comments removed). It
 * finds each function-like first parameter, then flags, per controllable field name `f`, a read
 * from that parameter (`p.f`, `p?.f`, `p['f']`) or a destructure of it (`({ f }, e)`). Reads of
 * the event or any other parameter are not flagged. It cannot see aliasing (`const t = s; t.open`,
 * `const k = 'open'; s[k]`), computed keys or helpers defined elsewhere. A clean result means "no
 * direct read of the first parameter", not "provably independent".
 * @param {string} source reducer module text
 * @param {string[]} controllable the contract's `state.controllable` names
 * @param {string} [file]
 * @returns {SourceFinding[]}
 */
export function lintReducerSource(source, controllable, file = '<reducer>') {
  // Blank comments but keep newlines so line numbers survive; leave strings (bracket access).
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
  // First parameter of every function-like: `name(p, ..) {`, `function (p, ..) {`, `(p, ..) =>`.
  const sig =
    /([\w$]*)\s*\(\s*(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*(?::[^,)]*)?(?:,[^)]*)?\)\s*(?::[^={]+)?\s*(=>|\{)/g;
  const notFn = new Set(['if', 'while', 'for', 'switch', 'catch', 'with']);
  /** @type {string[]} */
  const names = [];
  /** @type {string[]} */
  const patterns = [];
  for (const m of code.matchAll(sig)) {
    if (m[3] === '{' && notFn.has(m[1] ?? '')) continue;
    const p = m[2] ?? '';
    if (p.startsWith('{')) patterns.push(p);
    else names.push(p);
  }
  /** @type {SourceFinding[]} */
  const out = [];
  for (const f of controllable) {
    const id = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /** @type {RegExp[]} */
    const res = [];
    for (const n of new Set(names)) {
      const pn = n.replace(/\$/g, '\\$');
      res.push(new RegExp(`\\b${pn}\\s*\\??\\.\\s*${id}\\b`, 'g')); // s.open, s?.open
      res.push(new RegExp(`\\b${pn}\\s*(?:\\?\\.)?\\[\\s*['"\`]${id}['"\`]\\s*\\]`, 'g')); // s['open']
    }
    const destructure = new RegExp(`[{,]\\s*${id}\\s*(?::|,|\\}|=)`);
    /** @type {Set<number>} */
    const seen = new Set();
    /** @param {number} at */
    const add = (at) => {
      const line = lineAt(code, at);
      if (seen.has(line)) return;
      seen.add(line);
      out.push({
        rule: 'contract/reducer-controlled-field',
        file,
        line,
        message: `reducer reads controllable field "${f}" from its state parameter: a reducer never reads a controlled field; the prop getter computes the next value from view() and calls request("${f}", next) (ADR-003)`,
      });
    };
    for (const re of res) for (const m of code.matchAll(re)) add(m.index ?? 0);
    for (const m of code.matchAll(sig)) {
      if (m[2]?.startsWith('{') && destructure.test(m[2])) add(m.index ?? 0);
    }
  }
  return out.sort((a, b) => a.line - b.line);
}
