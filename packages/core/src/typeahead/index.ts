// Prefix typeahead and IME guard (ADR-006, ADR-012). Never reuses a fuzzy ranker.
import type { CollectionItem } from '../collection/index';
import type { Scheduler } from '../runtime/index';

/** Unicode normalize + trim/collapse whitespace + locale case folding. Diacritics are kept. */
export const normalize = (s: string, locale?: string): string =>
  s.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(locale);

/**
 * Next enabled item whose normalized text starts with `query`. A buffer of one repeated character
 * cycles: the search starts after `from`. Otherwise it starts at `from` (so the current match
 * stays). Wraps; undefined when nothing matches.
 */
export function nextMatch(
  items: readonly CollectionItem[],
  from: number,
  query: string,
  locale?: string,
): number | undefined {
  const q = normalize(query, locale);
  if (!q) return undefined;
  const cycle = q.length > 1 && [...q].every((c) => c === q[0]);
  const needle = cycle ? q[0]! : q;
  const n = items.length;
  const s0 = cycle || q.length === 1 ? 1 : 0;
  for (let step = s0; step < s0 + n; step++) {
    const i = (((from + step) % n) + n) % n;
    const it = items[i]!;
    if (!it.disabled && normalize(it.text ?? it.key, locale).startsWith(needle)) return i;
  }
  return undefined;
}

/** Minimal event shapes so core needs no DOM types. */
export interface KeyLike {
  key: string;
  keyCode?: number;
  isComposing?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}
export interface InputLike {
  inputType?: string;
  data?: string | null;
  isComposing?: boolean;
}

export interface Typeahead {
  /** Non-editable composites (`keydown`). Returns the matched index, if any. */
  keydown(e: KeyLike, items: readonly CollectionItem[], current: number): number | undefined;
  /** Editable inputs (`beforeinput`; Android sends keyCode 229 on keydown). */
  beforeinput(e: InputLike, items: readonly CollectionItem[], current: number): number | undefined;
  compositionstart(): void;
  compositionend(): void;
  readonly composing: boolean;
  readonly buffer: string;
  reset(): void;
}

export function createTypeahead(o: {
  locale?: string;
  scheduler: Scheduler;
  timeout?: number;
}): Typeahead {
  let buffer = '';
  let composing = false; // session flag, in addition to the event's isComposing
  let cancel: (() => void) | undefined;
  const reset = () => {
    cancel?.();
    cancel = undefined;
    buffer = '';
  };
  const feed = (ch: string, items: readonly CollectionItem[], current: number) => {
    cancel?.();
    buffer += ch;
    cancel = o.scheduler.after(reset, o.timeout ?? 500);
    return nextMatch(items, current, buffer, o.locale);
  };
  return {
    keydown(e, items, current) {
      if (composing || e.isComposing || e.keyCode === 229) return undefined;
      if (e.ctrlKey || e.metaKey || e.altKey || [...e.key].length !== 1) return undefined;
      if (e.key === ' ' && !buffer) return undefined; // space activates, it does not type ahead
      return feed(e.key, items, current);
    },
    beforeinput(e, items, current) {
      if (composing || e.isComposing || e.inputType !== 'insertText' || !e.data) return undefined;
      return feed(e.data, items, current);
    },
    compositionstart() {
      composing = true;
      reset();
    },
    compositionend() {
      composing = false;
    },
    get composing() {
      return composing;
    },
    get buffer() {
      return buffer;
    },
    reset,
  };
}
