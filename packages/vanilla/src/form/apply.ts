// Internal helper shared by the SJForm, SJField and SJInput vanilla adapters (not a package entry).
// Writes a core getter's Props onto an element: attributes only, `on*` handlers are wired separately,
// `undefined`/`false`/`null` remove, `true` is an empty attribute. Text nodes only (ADR-002).
export type Applied = Set<string>;

export function applyProps(el: Element, props: Record<string, unknown>, prev: Applied): void {
  const next: Applied = new Set();
  for (const [key, value] of Object.entries(props)) {
    if (/^on[A-Z]/.test(key)) continue;
    if (value === undefined || value === false || value === null) continue;
    if (key === 'disabled') (el as HTMLInputElement).disabled = true;
    el.setAttribute(key, value === true ? '' : String(value));
    next.add(key);
  }
  for (const attr of prev) {
    if (next.has(attr)) continue;
    el.removeAttribute(attr);
    if (attr === 'disabled') (el as HTMLInputElement).disabled = false;
  }
  prev.clear();
  for (const a of next) prev.add(a);
}

/** Subscribers for a mounted form; `notify` also runs when the form's own props change. */
export interface Listeners {
  add(fn: () => void): () => void;
  notify(): void;
}
export function createListeners(): Listeners {
  const set = new Set<() => void>();
  return {
    add(fn) {
      const f = () => fn();
      set.add(f);
      return () => void set.delete(f);
    },
    notify: () => void [...set].forEach((f) => f()),
  };
}
