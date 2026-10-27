/** `[group, decimal]` separators of a locale. */
export type Seps = readonly [group: string, decimal: string];

export function separators(locale: string): Seps {
  const p = new Intl.NumberFormat(locale).formatToParts(11111.1);
  const f = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return [f('group'), f('decimal')];
}

const GROUP = /^[1-9]\d{0,2}$/;
const TRIPLE = /^\d{3}$/;
const grouped = (p: string[]) =>
  p.length > 1 && GROUP.test(p[0] as string) && p.slice(1).every((x) => TRIPLE.test(x));

/**
 * Deterministic locale number reader (ADR-007). Returns the canonical decimal string (`-?\d+(\.\d+)?`,
 * leading zeroes kept, never a JS number) or `null`. Accepts both separators: with two kinds the last one is
 * decimal and the rest must be a valid grouping; a repeated separator is grouping; a single one is decimal when
 * it is the locale decimal, grouping when it is the locale group and the structure is 1-3 digits then triples,
 * decimal otherwise. Digits may be ASCII, Arabic-Indic or Extended Arabic-Indic. A leading `-` or U+2212 is
 * accepted only when `signed`.
 */
export function parseNumber(text: string, locale: string | Seps, signed = false): string | null {
  const [g, d] = typeof locale === 'string' ? separators(locale) : locale;
  const m = /^([-−]?)(.*)$/s.exec(text.trim()) as RegExpExecArray;
  if (m[1] && !signed) return null;
  const b = (m[2] as string)
    .replace(/[٠-٩۰-۹]/g, (c) => String(c.charCodeAt(0) & 15))
    .replace(/[\s\u00a0\u202f'\u2019\u066c]/g, ' ')
    .replace(/٫/g, ',');
  const G = g === '.' || g === ',' ? g : ' ';
  const D = d === '.' || d === ',' ? d : ',';
  if (!/^[\d .,]+$/.test(b)) return null;
  const parts = b.split(/[ .,]/);
  const ch = b.replace(/\d/g, '').split('');
  const n = ch.length;
  const last = ch[n - 1];
  let dec = false;
  if (n && last !== ' ')
    dec = ch.some((c) => c !== last) || (n < 2 && (last === D || !(last === G && grouped(parts))));
  const ints = dec ? parts.slice(0, -1) : parts;
  const frac = dec ? (parts[n] as string) : '';
  if (dec && (!frac || ch.slice(0, -1).some((c) => c !== ch[0] || c === last))) return null;
  if (ints.length > 1 ? !grouped(ints) : ints[0] === '' && !dec) return null;
  if (!ints.length || (ints.length > 1 && ints.some((x) => !x))) return null;
  return `${m[1] ? '-' : ''}${ints.join('') || '0'}${frac && `.${frac}`}`;
}
