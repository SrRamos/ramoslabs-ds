import { KINDS, type Kind, type Row } from './table';

export { KINDS, type Kind, type Row };

export type EnterHint = 'enter' | 'next' | 'done' | 'go' | 'send' | 'search';

export interface KindContext {
  /** Use the `text` variant of quantity/country. */
  variant?: 'text';
  /** Consumer token or variant (e.g. `given-name`, `tel-national`); ignored unless the kind allows it. */
  autocomplete?: string;
  /** Autofill section name; prefixed as `section-<name>`. */
  section?: string;
  /** Conditional tokens (url, bday, transaction-amount) are emitted only when true. */
  meaningful?: boolean;
  /** Postal/reference/account default true, tax-id default false: numeric keypad only if digits-only. */
  digits?: boolean;
  /** Canonical form is uppercase (otp-alnum): enables autocapitalize=characters. */
  uppercase?: boolean;
  /** OTP submits on Enter (`go`) instead of `done`. */
  autoSubmit?: boolean;
  /** Owner-computed hint for `position` kinds; see {@link enterKeyHints}. */
  enter?: EnterHint;
}

/** Attributes only; `maxlength` is never part of the output (ADR-007). Absent attributes are omitted. */
export interface ResolvedKind {
  type: string;
  inputmode?: string;
  autocomplete?: string;
  enterkeyhint?: EnterHint;
  autocapitalize?: string;
  autocorrect?: 'on' | 'off';
  spellcheck?: boolean;
}

export function resolveKind(kind: Kind, ctx: KindContext = {}): ResolvedKind {
  const [t, im, ac, en, cap, corr, spell, gate] = KINDS[kind] as Row;
  const types = [t].flat();
  const v = ctx.variant === 'text' && types[1] ? 1 : 0;
  const type = types[v] as string;
  let autocomplete: string | undefined;
  if (typeof ac === 'string')
    autocomplete = ac === 'ctx' ? ctx.autocomplete : (ctx.autocomplete ?? ac);
  else if (ac && (ac[0] !== '?' || ctx.meaningful)) {
    const toks = ac.filter((x) => x !== '?');
    const p = ctx.autocomplete;
    const tok =
      p && toks.some((x) => x === p || (x.endsWith('*') && p.startsWith(x.slice(0, -1))))
        ? p
        : toks[types[1] ? v : 0];
    autocomplete = (ctx.section ? `section-${ctx.section} ` : '') + tok;
  }
  const d = ctx.digits;
  const out: ResolvedKind = {
    type,
    inputmode:
      type === 'number' || (gate === 1 && d === false) || (gate === 2 && d !== true)
        ? undefined
        : (im ?? undefined),
    autocomplete,
    enterkeyhint: (en === 'position'
      ? ctx.enter
      : en === 'done/go'
        ? ctx.autoSubmit
          ? 'go'
          : 'done'
        : en) as EnterHint | undefined,
    autocapitalize:
      cap === 'characters?' ? (ctx.uppercase ? 'characters' : undefined) : (cap ?? undefined),
    autocorrect: corr ?? undefined,
    spellcheck: spell ?? undefined,
  };
  for (const k in out)
    if (out[k as keyof ResolvedKind] === undefined) delete out[k as keyof ResolvedKind];
  return out;
}

/**
 * Form-owner `enterkeyhint` for an ordered list of fields. Textarea kinds are fixed to `enter` and excluded
 * from position; kind overrides (url go, search search, otp done/go, cc-csc done) win; otherwise `next`
 * while another non-textarea field follows, else `action` (go/send/search) or `go` when `submits`, else `done`.
 */
export function enterKeyHints(
  kinds: readonly Kind[],
  o: { action?: 'go' | 'send' | 'search'; submits?: boolean; autoSubmit?: boolean } = {},
): EnterHint[] {
  const text = kinds.map((k) => (KINDS[k] as Row)[3] !== 'enter');
  const last = text.lastIndexOf(true);
  return kinds.map((k, i) => {
    const e = (KINDS[k] as Row)[3];
    return (
      resolveKind(k, {
        autoSubmit: o.autoSubmit,
        enter: !text[i] ? 'enter' : i < last ? 'next' : (o.action ?? (o.submits ? 'go' : 'done')),
      }).enterkeyhint ?? (e as EnterHint)
    );
  });
}
