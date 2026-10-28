// SJCheckbox core (C03c.a): reducer, controlled-field description and per-part prop getters.
// Native-first (ADR-008 rule 1, ADR-014): the `control` part is a real `<input type="checkbox">`;
// form state is the input's own (`name`, `value`, `checked`, `disabled`), with no FACE and no hidden
// mirror input. Space activation, focus and forced-colors painting are native. `indeterminate` is a
// DOM property with no attribute: the getter emits it as a property for the adapter to apply, the
// browser exposes it to AT as `mixed` (no `aria-checked`), and user activation clears it natively.
// Getters are pure functions of `view()` and `getProps()` (ADR-004); adapters own the store.
import { mergeProps, type Props } from '../merge/index';
import { baseId } from '../ids/index';
import type { CheckboxSnapshot } from './reducer';

export {
  checkboxFields,
  harness,
  initialSnapshot,
  reduce,
  reducerEvents,
  storeReducer,
} from './reducer';
export type { CheckboxAction, CheckboxEvent, CheckboxSnapshot, CheckboxState } from './reducer';

/** Props the adapter exposes through `getProps()`. `checked` / `indeterminate` present = controlled. */
// A type alias (not an interface) so it satisfies the controlled pipeline's `Bag` index signature.
export type CheckboxProps = {
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly indeterminate?: boolean;
  readonly defaultIndeterminate?: boolean;
  readonly disabled?: boolean;
  readonly name?: string;
  /** Submitted value when checked (native default `on` when absent). */
  readonly value?: string;
  /** Explicit control id; otherwise derived from the adapter's id source. */
  readonly id?: string;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly onIndeterminateChange?: (indeterminate: boolean) => void;
};

/** What the getters need from the adapter's store bridge (`useSJStore`, `useMachine`, vanilla). */
export interface CheckboxContext {
  /** Snapshot with the controlled `checked` and `indeterminate` overlaid (`controlled.view()`). */
  readonly view: () => CheckboxSnapshot;
  /** `controlled.native`: records the native input's state, notifies, dispatches when uncontrolled. */
  readonly native: (field: 'checked' | 'indeterminate', actual: boolean) => boolean;
  readonly getProps: () => CheckboxProps;
  /** Base id from `checkboxBaseId` (computed once per instance). */
  readonly id: string;
}

export interface CheckboxParts {
  readonly ids: { readonly control: string };
  getRootProps(consumer?: Props): Props;
  getControlProps(consumer?: Props): Props;
  getIndicatorProps(consumer?: Props): Props;
  getLabelProps(consumer?: Props): Props;
}

/** Control id: explicit wins, otherwise `prefix + acquire()` (ADR-003 SSR-safe ids). */
export const checkboxBaseId = (
  explicit: string | undefined,
  acquire: () => string,
  prefix = '',
): string => baseId(explicit, acquire, prefix);

export function createCheckboxParts(ctx: CheckboxContext): CheckboxParts {
  const ids = { control: ctx.id };
  const disabledOf = () => ctx.getProps().disabled === true;
  const stateAttrs = () => {
    const v = ctx.view();
    return {
      // Indeterminate wins over checked, as the native control paints it.
      'data-state': v.indeterminate ? 'indeterminate' : v.checked ? 'checked' : 'unchecked',
      // `undefined` is a library-owned value: it also removes a consumer-set attribute.
      'data-disabled': disabledOf() ? 'true' : undefined,
    };
  };
  const partProps = (part: string, consumer: Props) =>
    mergeProps(
      consumer,
      { class: `sj-checkbox__${part}`, 'data-part': part, ...stateAttrs() },
      { part, protect: ['data-part', 'data-state', 'data-disabled'] },
    );

  return {
    ids,
    getRootProps: (consumer = {}) => partProps('root', consumer),
    getControlProps: (consumer = {}) => {
      const props = ctx.getProps();
      return mergeProps(
        consumer,
        {
          id: ids.control,
          class: 'sj-checkbox__control',
          type: 'checkbox',
          checked: ctx.view().checked,
          // A property, never an attribute: React applies it on the node after commit (ref), Vue and
          // vanilla set the DOM property directly. The adapter must not render it as an attribute.
          indeterminate: ctx.view().indeterminate,
          ...(props.name !== undefined && { name: props.name }),
          ...(props.value !== undefined && { value: props.value }),
          disabled: disabledOf() ? true : undefined,
          'data-part': 'control',
          ...stateAttrs(),
          // The native input has already flipped `checked` and cleared `indeterminate`. Both next
          // values come from view() (a reducer never reads a controlled field); a controlled owner
          // that rejects either is corrected by `reconcile()` (effects `checked` / `indeterminate`).
          onChange: () => {
            const v = ctx.view();
            ctx.native('checked', !v.checked);
            if (v.indeterminate) ctx.native('indeterminate', false);
          },
        },
        {
          part: 'control',
          protect: [
            'type',
            'checked',
            'indeterminate',
            'disabled',
            'data-part',
            'data-state',
            'data-disabled',
          ],
        },
      );
    },
    getIndicatorProps: (consumer = {}) => partProps('indicator', consumer),
    // The visible label text (G3A SHOULD-6): a span inside the wrapping root <label>, so the root's
    // implicit label association names the input.
    getLabelProps: (consumer = {}) => partProps('label', consumer),
  };
}
