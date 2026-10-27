// Controlled/uncontrolled pipeline (ADR-003 "Controlled/uncontrolled"). One request/commit path:
// - `getProps()` is read at derive time (`view`) and at transition time (`request`/`native`);
// - controlled props are overlaid on the derived view and never copied into reducer state;
// - native events report actual native state, kept apart from the desired (controlled) state;
// - a controlled value that disagrees with the native state after commit yields a corrective
//   native effect (`reconcile`), never a re-dispatch;
// - switching ownership after `mount()` throws in development.
// No module state: every call owns its closure.
declare const process: { env: { NODE_ENV?: string } } | undefined;

export type Bag = Readonly<Record<string, unknown>>;

export interface Field<E> {
  /** Prop holding the controlled value; `undefined` means uncontrolled. */
  readonly prop: string;
  /** Change callback prop, called with the requested/actual value. */
  readonly onChange?: string;
  /** Maps a requested value to the reducer event used when the field is uncontrolled. */
  readonly toEvent: (next: never) => E;
  /** Effect type for the corrective native effect (set only on natively-reported fields). */
  readonly native?: string;
  /** Effect target (element/anchor key) for the corrective effect. */
  readonly target?: string;
}

export interface CorrectiveEffect {
  readonly type: string;
  readonly target?: string;
  readonly value: unknown;
}

export interface ControlledConfig<S extends object, E, P extends Bag> {
  readonly store: { getSnapshot(): S; dispatch(event: E): unknown };
  /** Stable accessor over the latest props; called on every read, never cached. */
  readonly getProps: () => P;
  /** Field name (a key of the state) -> controlled-prop description. */
  readonly fields: { readonly [K in keyof S & string]?: Field<E> };
}

export interface Controlled<S extends object> {
  /** State with controlled props overlaid; same reference while inputs are unchanged. */
  view(): S;
  /** Locks ownership: after this, a controlled<->uncontrolled switch throws in development. */
  mount(): void;
  /**
   * A transition request. Controlled: only notifies `onChange`, state is untouched (the owner decides).
   * Uncontrolled: dispatches the field's event, then notifies. Returns true when it dispatched.
   */
  request<K extends keyof S & string>(field: K, next: S[K]): boolean;
  /** A native event (`toggle`, `close`, `cancel`...) reports actual native state. Otherwise as `request`. */
  native<K extends keyof S & string>(field: K, actual: S[K]): boolean;
  /** Post-commit: corrective effects where the desired controlled value differs from native state. */
  reconcile(): readonly CorrectiveEffect[];
}

export function createControlled<S extends object, E, P extends Bag>(
  config: ControlledConfig<S, E, P>,
): Controlled<S> {
  const { store, getProps, fields } = config;
  const names = Object.keys(fields) as (keyof S & string)[];
  const actual = new Map<string, unknown>();
  let mounted: Record<string, boolean> | undefined;
  let lastState: S | undefined;
  let lastKey: unknown[] = [];
  let lastView: S | undefined;

  const isControlled = (props: P, f: Field<E>) => props[f.prop] !== undefined;
  const modes = (props: P) => {
    const m: Record<string, boolean> = {};
    for (const n of names) m[n] = isControlled(props, fields[n]!);
    return m;
  };
  const guard = (props: P) => {
    if (!mounted) return;
    if (typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production')
      for (const n of names)
        if (mounted[n] !== isControlled(props, fields[n]!))
          throw new Error(
            `[sj] "${fields[n]!.prop}" switched between controlled and uncontrolled after mount`,
          );
  };
  const notify = (props: P, f: Field<E>, value: unknown) => {
    const cb = f.onChange && props[f.onChange];
    if (typeof cb === 'function') cb(value);
  };

  const submit = (field: keyof S & string, next: unknown, isNative: boolean): boolean => {
    const props = getProps();
    guard(props);
    const f = fields[field]!;
    if (isNative) actual.set(field, next);
    const controlled = isControlled(props, f);
    let dispatched = false;
    if (!controlled) {
      store.dispatch(f.toEvent(next as never));
      dispatched = true;
    }
    notify(props, f, next);
    return dispatched;
  };

  return {
    view() {
      const props = getProps();
      guard(props);
      const state = store.getSnapshot();
      const key = names.map((n) =>
        isControlled(props, fields[n]!) ? props[fields[n]!.prop] : undefined,
      );
      if (
        lastView &&
        lastState === state &&
        key.length === lastKey.length &&
        key.every((v, i) => Object.is(v, lastKey[i]))
      )
        return lastView;
      let out = state;
      names.forEach((n, i) => {
        if (isControlled(props, fields[n]!) && !Object.is(state[n], key[i]))
          out = { ...out, [n]: key[i] };
      });
      lastState = state;
      lastKey = key;
      return (lastView = out);
    },
    mount() {
      mounted = modes(getProps());
    },
    request: (field, next) => submit(field, next, false),
    native: (field, value) => submit(field, value, true),
    reconcile() {
      const props = getProps();
      guard(props);
      const view = this.view();
      const out: CorrectiveEffect[] = [];
      for (const n of names) {
        const f = fields[n]!;
        if (!f.native || !actual.has(n)) continue;
        const desired = view[n];
        if (Object.is(actual.get(n), desired)) continue;
        out.push({
          type: f.native,
          ...(f.target !== undefined && { target: f.target }),
          value: desired,
        });
        actual.set(n, desired);
      }
      return out;
    },
  };
}
