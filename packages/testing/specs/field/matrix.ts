// SJField / SJInput / SJForm L2 scenario list and the parity declaration (W1-C02.f, ADR-013 L2 and L6). One list
// feeds the Playwright spec and the expected-matrix declaration, so a declared scenario is a scenario that runs and
// a missing cell is a failure, never an inference. The three contracts have no actions and no events
// (`actions: []`, ADR-010 G-ICON ruling), so `deriveSpec` yields no steps; each scenario is a named behaviour the
// contracts promise (ADR-007 kind rows, ADR-014 field and form duties, WCAG 3.3.7), exercised through the
// real components with real browser input. The ADR-007 expectations are derived HERE from `kinds.contract.json`,
// independently of the core table the components use, so a drift in either shows up as a failing cell.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSpec } from '../../spec/derive/index.js';
import { SUPPORT_KEYS, supportsPaths } from '../../e2e/supports/paths';
import { ADAPTERS, ENGINES, FIELD_PATHS } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const contractsDir = join(here, '..', '..', '..', 'contracts', 'contracts');
const read = (name: string) =>
  JSON.parse(readFileSync(join(contractsDir, `${name}.contract.json`), 'utf8'));
export const contracts = { field: read('field'), input: read('input'), form: read('form') };
export const kindsContract = read('kinds');
export const specs = {
  field: deriveSpec(contracts.field),
  input: deriveSpec(contracts.input),
  form: deriveSpec(contracts.form),
};
/** The matrix `component` column: the three contracts are one conformance unit. */
export const COMPONENT = 'SJField';
export { ADAPTERS, ENGINES };

// ---- ADR-007 expectations, from the kinds contract ---------------------------------------------------------
export interface KindRow {
  kind: string;
  type: string[];
  inputmode: string | null;
  autocomplete: { policy: string; tokens?: string[]; variants?: string[]; default?: string };
  enter: string;
  autocapitalize: { value: string | null; when?: string };
  autocorrect: 'on' | 'off' | null;
  spellcheck: boolean | null;
  noMaxlength: boolean;
  enterAlternatives?: string[];
  forbiddenTypes?: string[];
  inputmodeWhen?: string;
  excludeFromEnterPosition?: boolean;
}
export const KIND_ROWS: KindRow[] = kindsContract.kinds;
export const rowOf = (kind: string): KindRow => {
  const r = KIND_ROWS.find((k) => k.kind === kind);
  if (!r) throw new Error(`unknown kind ${kind}`);
  return r;
};
/**
 * `choice` is a native select and `country` defaults to one: both belong to SJSelect (C10), not SJInput
 * (C02 a2 note), so the SJInput run covers `country` as its text variant and leaves `choice` to SJSelect.
 */
export const INPUT_KINDS = KIND_ROWS.filter((k) => k.kind !== 'choice').map((k) => k.kind);
/** The kinds whose value must never be retained for 3.3.7 (secrets). */
export const SECRET_KINDS = ['password', 'password-new', 'otp', 'otp-alnum', 'cc-csc'];

export interface KindCtx {
  variant?: 'text';
  autocomplete?: string;
  section?: string;
  meaningful?: boolean;
  digits?: boolean;
  uppercase?: boolean;
  autoSubmit?: boolean;
  /** The owner-computed Enter hint for a `position` kind, when there is one. */
  enter?: string;
}
export interface ExpectedAttrs {
  tag: 'input' | 'textarea';
  type: string | null;
  inputmode: string | null;
  autocomplete: string | null;
  enterkeyhint: string | null;
  autocapitalize: string | null;
  autocorrect: string | null;
  spellcheck: string | null;
}

/** What the rendered control must carry for one kind row (ADR-007), from the contract alone. */
export function expectedAttrs(kind: string, ctx: KindCtx = {}): ExpectedAttrs {
  const row = rowOf(kind);
  const tag = row.type[0] === 'textarea' ? 'textarea' : 'input';
  // SJInput renders `country` as its text variant (the select form is SJSelect's).
  const textVariant = (ctx.variant === 'text' || kind === 'country') && row.type[1] !== undefined;
  const type = tag === 'textarea' ? null : (row.type[textVariant ? 1 : 0] ?? null);

  let inputmode: string | null = row.inputmode;
  if (kind === 'country') inputmode = 'text'; // contract note: the text variant is type=text, inputmode=text
  if (type === 'number') inputmode = null;
  else if (row.inputmodeWhen === 'digits-only by contract' && ctx.digits === false)
    inputmode = null;
  else if (row.inputmodeWhen === 'digits-only' && ctx.digits !== true) inputmode = null;
  else if (row.inputmodeWhen === 'text variant' && !textVariant) inputmode = null;

  const ac = row.autocomplete;
  let autocomplete: string | null;
  const section = ctx.section ? `section-${ctx.section} ` : '';
  if (ac.policy === 'token') {
    const toks = ac.tokens ?? [];
    const asked = ctx.autocomplete;
    const allowed = [...toks, ...(ac.variants ?? [])];
    const ok =
      asked !== undefined &&
      allowed.some((t) => t === asked || (t.endsWith('*') && asked.startsWith(t.slice(0, -1))));
    autocomplete =
      section + (kind === 'country' ? (ac.variants?.[0] ?? '') : ok ? asked! : (toks[0] ?? ''));
  } else if (ac.policy === 'conditional') {
    autocomplete = ctx.meaningful ? section + (ac.tokens?.[0] ?? '') : null;
  } else if (ac.policy === 'context') autocomplete = ctx.autocomplete ?? ac.default ?? null;
  else if (ac.policy === 'off') autocomplete = 'off';
  else autocomplete = null; // omitted

  let enterkeyhint: string | null;
  if (row.enter === 'position') enterkeyhint = ctx.enter ?? null;
  else if (row.enterAlternatives?.includes('go')) enterkeyhint = ctx.autoSubmit ? 'go' : row.enter;
  else enterkeyhint = row.enter;

  let autocapitalize = row.autocapitalize.value;
  if (row.autocapitalize.when === 'canonical uppercase')
    autocapitalize = ctx.uppercase ? 'characters' : null;

  return {
    tag,
    type,
    inputmode,
    autocomplete,
    enterkeyhint,
    autocapitalize,
    autocorrect: row.autocorrect,
    spellcheck: row.spellcheck === null ? null : String(row.spellcheck),
  };
}

/**
 * The form owner's Enter hint per field, in DOM order (ADR-007): textarea kinds are `enter` and excluded from
 * the position; a fixed kind keeps its own hint (url go, search search, otp done or go, cc-csc done); the
 * remaining ones are `next` while another editable field follows and the last one gets `enter ?? go/done`.
 */
export function expectedHints(
  kinds: string[],
  o: { enter?: 'go' | 'send' | 'search'; submits?: boolean; autoSubmit?: boolean } = {},
): string[] {
  const rows = kinds.map(rowOf);
  const editable = rows.map((r) => !r.excludeFromEnterPosition);
  const last = editable.lastIndexOf(true);
  const submits = o.submits ?? true;
  return rows.map((r, i) => {
    if (r.excludeFromEnterPosition) return 'enter';
    if (r.enter !== 'position')
      return r.enterAlternatives?.includes('go') && o.autoSubmit ? 'go' : r.enter;
    return i < last ? 'next' : (o.enter ?? (submits ? 'go' : 'done'));
  });
}

// ---- scenarios -----------------------------------------------------------------------------------------------
export interface Scenario {
  readonly scenario: string;
  readonly action: string;
  readonly id: string;
}

const S = (id: string, scenario: string, action: string): Scenario => ({ id, scenario, action });

/** Every named behaviour, once; the l2 spec has a runner per `id`. */
export function fieldScenarios(): Scenario[] {
  return [
    S('kinds', 'input: every ADR-007 kind row on a rendered control', 'render'),
    S('kind-flags', 'input: variants, tokens, sections and digits flags', 'render'),
    S('hints', 'form: owner Enter hints from field order and kind overrides', 'render'),
    S('hints-send-search', 'form: enter prop send/search and submits=false', 'render'),
    S('hints-textarea', 'form: textarea kinds are excluded from the Enter position', 'render'),
    S('hints-late', 'form: a late-mounted field moves the Enter position', 'update'),
    S('hints-reorder', 'form: reordered fields recompute the Enter hints', 'update'),
    S('hints-data-first', 'form: the data-first fields prop wins over registration', 'render'),
    S('otp-owner', 'otp: the form owner autoSubmit is final', 'render'),
    S('otp-standalone', 'otp: the input autoSubmit applies standalone', 'render'),
    S('form-native', 'form: enter prop and native action/method reach the form', 'render'),
    S('form-enter-submits', 'form: Enter submits natively', 'Enter'),
    S('form-state', 'form: submitted state equals bare native inputs', 'pointer'),
    S('form-reset', 'form: reset restores the same state as bare native inputs', 'pointer'),
    S('uv-tab-through', 'user-invalid: tabbing through shows no error', 'Tab'),
    S('uv-change', 'user-invalid: the error appears after a change', 'keyboard'),
    S('uv-submit', 'user-invalid: the error appears after a submit attempt', 'pointer'),
    S('uv-reset', 'user-invalid: reset clears the error', 'pointer'),
    S('uv-code-path', 'user-invalid: native and fallback paths run different code', 'render'),
    S('retain-offered', '3.3.7: entered values are retained and offered', 'keyboard'),
    S('retain-secrets', '3.3.7: secret kinds are never retained', 'keyboard'),
    S('retain-tab-through', '3.3.7: tabbing through keeps a retained value', 'Tab'),
    S(
      'announce-once',
      'field: an error is announced once on transition, silent at mount',
      'update',
    ),
    S('announce-repeat', 'field: the same error again is silent, a new text announces', 'update'),
    S('announce-icon', 'field: the aria-hidden icon is never read', 'render'),
    S(
      'announce-limit',
      'field: two errors in one commit speak only the last (known limit)',
      'update',
    ),
    S('field-ids', 'field: ids, label and aria-describedby are derived', 'render'),
    S('field-invalid', 'field: aria-invalid only while an error shows', 'update'),
    S('field-errormessage', 'field: aria-errormessage only when asked for', 'render'),
    S('field-native', 'field: required, disabled and name are native attributes', 'render'),
  ];
}

export const matrixTitle = (adapter: string, s: Scenario, path: string): string =>
  `${COMPONENT} | ${adapter} | ${s.scenario} | ${s.action} | path=${path}`;

/** The paths the field set runs: real detection and every capability forced false (the floor). */
export const paths = () =>
  supportsPaths().filter((p) => (FIELD_PATHS as readonly string[]).includes(p.id));

const FLOOR_NOTE = 'real floor lane runs per release (ADR-013); not part of the per-PR run';

/**
 * What the matrix MUST contain, derived from the contracts; never from results. Floor and device rows are
 * declared `not run` with the ADR-013 reason. The ten single-key forced-false paths are `not-applicable` WITH a
 * reason: the field set reads one capability (`userInvalid`, the SJInput `user-invalid` support row), so forcing
 * any single key false is either native (nine keys) or identical to `fallback:all` (`userInvalid`).
 */
export function fieldExpected() {
  const noBranch = (key: string) => ({
    match: { path: `fallback:${key}` },
    status: 'not-applicable' as const,
    reason:
      key === 'userInvalid'
        ? 'userInvalid is the only capability SJInput reads, so forcing it false equals fallback:all, which runs'
        : `SJField, SJInput and SJForm read no ${key} capability, so forcing it false equals native; fallback:all forces every key false at once and runs`,
  });
  return {
    version: 1,
    component: COMPONENT,
    browsers: [
      ...ENGINES.map((id) => ({ id })),
      { id: 'chromium-114', status: 'not-run', reason: FLOOR_NOTE },
      { id: 'firefox-125', status: 'not-run', reason: FLOOR_NOTE },
      {
        id: 'ios-17-safari',
        status: 'not-run',
        reason:
          'no physical iOS 17 device available (owner decision, ADR-013); not hands-on verified',
      },
      {
        id: 'android-floor',
        status: 'not-run',
        reason:
          'no Android floor device available (owner decision, ADR-013); not hands-on verified',
      },
    ],
    adapters: [...ADAPTERS],
    paths: supportsPaths().map((p) => ({ id: p.id, forced: [...p.forced] })),
    scenarios: fieldScenarios().map(({ scenario, action }) => ({ scenario, action })),
    exemptions: SUPPORT_KEYS.map(noBranch),
  };
}
