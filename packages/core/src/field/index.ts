// SJField core (W1-C02.a1, ADR-014). A field wraps a control with a visible label, an optional hint
// and an error, linked by deterministic ids `<id>-label`, `<id>-hint` and `<id>-error` (ADR-003).
// The control's `aria-describedby` and `aria-invalid` are DERIVED from the props, never set by hand;
// `aria-errormessage` is emitted only on an explicit opt-in (ADR-014: only where supported and
// tested). The error is visible text and is announced once through the live-region registry
// (ADR-006), never through a second live attribute on the element itself.
// The SJForm owner context supplies the Enter position and the 3.3.7 retained values (see ../form).
import { mergeProps, type Props } from '../merge/index';
import { partId } from '../ids/index';
import type { EnterHint, Kind } from '../kinds/index';
import type { LiveRegistry } from '../live/index';
import type { FormOwner } from '../form/index';

export type FieldProps = {
  /** Explicit control id; otherwise `ctx.id` (computed once per instance from the adapter). */
  readonly id?: string;
  /** Control name; also the key the form owner tracks and retains the value under. */
  readonly name?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  /** A hint is rendered, so the control references it. */
  readonly hasHint?: boolean;
  /** Visible error text; empty or absent means valid. */
  readonly error?: string;
  /** Opt in to `aria-errormessage` on an invalid control (additive to `aria-describedby`). */
  readonly errorMessage?: boolean;
};

export interface FieldContext {
  /** Base id (= the control id), from `baseId(props.id, acquire, prefix)`. */
  readonly id: string;
  /** SJForm owner from the adapter's context; absent outside a form. */
  readonly form?: FormOwner;
  /** The runtime's live registry; absent on the server (nothing is announced there). */
  readonly live?: LiveRegistry;
}

export interface FieldParts {
  readonly ids: {
    readonly control: string;
    readonly label: string;
    readonly hint: string;
    readonly error: string;
  };
  getRootProps(consumer?: Props): Props;
  getLabelProps(consumer?: Props): Props;
  getControlProps(consumer?: Props): Props;
  getHintProps(consumer?: Props): Props;
  getErrorProps(consumer?: Props): Props;
  getIconProps(consumer?: Props): Props;
  /**
   * Client only, after mount: registers with the form owner (kind unknown). `index` is the control's
   * index in `form.elements` (DOM order); give it so late-mounted or reordered fields keep the right
   * Enter position. Call again with the new index after a reorder or rename. Returns the cleanup.
   */
  connect(index?: number): () => void;
  /** SJInput reports the kind of its control; re-registers the field so the Enter order is right. */
  setKind(kind: Kind | undefined): void;
  /** Client only, after each commit: announces a new error text once. True when it was handed over. */
  announce(): boolean;
  /** Owner-computed `enterkeyhint` (resolveKind `enter`), undefined outside a form. */
  enterHint(): EnterHint | undefined;
  /** 3.3.7: record the entered value, read the retained one, or list values entered elsewhere. */
  retain(value: string): void;
  prior(): string | undefined;
  offers(): string[];
}

export function createField(getProps: () => FieldProps, ctx: FieldContext): FieldParts {
  const ids = {
    control: ctx.id,
    label: partId(ctx.id, 'label'),
    hint: partId(ctx.id, 'hint'),
    error: partId(ctx.id, 'error'),
  };
  const error = () => (getProps().error ?? '').trim();
  const key = () => getProps().name ?? ctx.id;
  // Announce transitions only: a standing error at creation stays silent.
  let last = error();
  let kind: Kind | undefined;
  let on = false;
  let index: number | undefined;
  const add = () => ctx.form?.register({ key: key(), kind, ...(index !== undefined && { index }) });
  const part = (name: keyof typeof ids | 'root' | 'icon', own: Props, consumer: Props) =>
    mergeProps(
      consumer,
      { class: `sj-field__${name}`, 'data-part': name, ...own },
      { part: name, protect: ['data-part', 'data-invalid', 'data-disabled'] },
    );

  return {
    ids,
    getRootProps: (consumer = {}) =>
      part(
        'root',
        {
          'data-invalid': error() ? 'true' : undefined,
          'data-disabled': getProps().disabled ? 'true' : undefined,
        },
        consumer,
      ),
    getLabelProps: (consumer = {}) => part('label', { id: ids.label, for: ids.control }, consumer),
    getHintProps: (consumer = {}) => part('hint', { id: ids.hint }, consumer),
    getErrorProps: (consumer = {}) => part('error', { id: ids.error }, consumer),
    getIconProps: (consumer = {}) => part('icon', { 'aria-hidden': 'true' }, consumer),
    getControlProps(consumer = {}) {
      const p = getProps();
      const e = error();
      const { 'aria-describedby': extra, ...rest } = consumer;
      const described = [p.hasHint && ids.hint, e && ids.error, typeof extra === 'string' && extra]
        .filter(Boolean)
        .join(' ');
      const own: Props = {
        id: ids.control,
        'aria-describedby': described || undefined,
        'aria-invalid': e ? 'true' : undefined,
        'aria-errormessage': e && p.errorMessage ? ids.error : undefined,
        ...(p.name !== undefined && { name: p.name }),
        ...(p.required && { required: true }),
        ...(p.disabled && { disabled: true }),
      };
      return mergeProps(rest, own, {
        part: 'control',
        protect: ['name', 'required', 'disabled'],
      });
    },
    connect(i) {
      on = true;
      index = i;
      const off = add();
      return () => {
        on = false;
        off?.();
      };
    },
    setKind(k) {
      kind = k;
      if (on) add();
    },
    announce() {
      const e = error();
      // Before a host is attached (adapters attach after children mount) nothing is recorded, so the
      // transition is announced on the first call after attach.
      if (!ctx.live?.attached() || e === last) return false;
      last = e;
      return !!e && ctx.live.announce(e);
    },
    enterHint: () => ctx.form?.hint(key()),
    retain: (value) => ctx.form?.retain(key(), value),
    prior: () => ctx.form?.prior(key()),
    offers: () => ctx.form?.offers(key()) ?? [],
  };
}
