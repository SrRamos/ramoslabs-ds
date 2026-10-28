// SJSwitch core (C03s.a): reducer, controlled-field description and per-part prop getters.
// Native-first (ADR-008 rule 1, ADR-014): the `control` part is a real `<input type="checkbox"
// role="switch">`; form state is the input's own (`name`, `value`, `checked`, `disabled`), with no
// FACE and no hidden mirror input. Space activation, focus and forced-colors painting are native.
// Getters are pure functions of `view()` and `getProps()` (ADR-004); adapters own the store.
import { mergeProps, type Props } from '../merge/index';
import { baseId } from '../ids/index';
import type { SwitchSnapshot } from './reducer';

export {
  harness,
  initialSnapshot,
  reduce,
  reducerEvents,
  storeReducer,
  switchFields,
} from './reducer';
export type { SwitchAction, SwitchEvent, SwitchSnapshot, SwitchState } from './reducer';

/** Props the adapter exposes through `getProps()`. `checked` present = controlled. */
// A type alias (not an interface) so it satisfies the controlled pipeline's `Bag` index signature.
export type SwitchProps = {
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly disabled?: boolean;
  readonly name?: string;
  /** Submitted value when checked (native default `on` when absent). */
  readonly value?: string;
  /** Explicit control id; otherwise derived from the adapter's id source. */
  readonly id?: string;
  readonly onCheckedChange?: (checked: boolean) => void;
};

/** What the getters need from the adapter's store bridge (`useSJStore`, `useMachine`, vanilla). */
export interface SwitchContext {
  /** Snapshot with the controlled `checked` overlaid (`controlled.view()`). */
  readonly view: () => SwitchSnapshot;
  /** `controlled.native`: records the native input's state, notifies, dispatches when uncontrolled. */
  readonly native: (field: 'checked', actual: boolean) => boolean;
  readonly getProps: () => SwitchProps;
  /** Base id from `switchBaseId` (computed once per instance). */
  readonly id: string;
}

export interface SwitchParts {
  readonly ids: { readonly control: string };
  getRootProps(consumer?: Props): Props;
  getControlProps(consumer?: Props): Props;
  getThumbProps(consumer?: Props): Props;
  getLabelProps(consumer?: Props): Props;
}

/** Control id: explicit wins, otherwise `prefix + acquire()` (ADR-003 SSR-safe ids). */
export const switchBaseId = (
  explicit: string | undefined,
  acquire: () => string,
  prefix = '',
): string => baseId(explicit, acquire, prefix);

const dataState = (checked: boolean): 'on' | 'off' => (checked ? 'on' : 'off');

export function createSwitchParts(ctx: SwitchContext): SwitchParts {
  const ids = { control: ctx.id };
  const disabledOf = () => ctx.getProps().disabled === true;
  const stateAttrs = () => {
    const checked = ctx.view().checked;
    return {
      'data-state': dataState(checked),
      // `undefined` is a library-owned value: it also removes a consumer-set attribute.
      'data-disabled': disabledOf() ? 'true' : undefined,
    };
  };

  return {
    ids,
    getRootProps: (consumer = {}) =>
      mergeProps(
        consumer,
        { class: 'sj-switch__root', 'data-part': 'root', ...stateAttrs() },
        { part: 'root', protect: ['data-part', 'data-state', 'data-disabled'] },
      ),
    getControlProps: (consumer = {}) => {
      const props = ctx.getProps();
      return mergeProps(
        consumer,
        {
          id: ids.control,
          class: 'sj-switch__control',
          type: 'checkbox',
          role: 'switch',
          checked: ctx.view().checked,
          ...(props.name !== undefined && { name: props.name }),
          ...(props.value !== undefined && { value: props.value }),
          disabled: disabledOf() ? true : undefined,
          'data-part': 'control',
          ...stateAttrs(),
          // The native input has already flipped. The next value is derived from view() (a reducer
          // never reads the controlled field); a controlled owner that rejects it is corrected by
          // `reconcile()` (effect `checked`, target `control`).
          onChange: () => void ctx.native('checked', !ctx.view().checked),
        },
        {
          part: 'control',
          protect: ['type', 'checked', 'disabled', 'data-part', 'data-state', 'data-disabled'],
        },
      );
    },
    getThumbProps: (consumer = {}) =>
      mergeProps(
        consumer,
        { class: 'sj-switch__thumb', 'data-part': 'thumb', ...stateAttrs() },
        { part: 'thumb', protect: ['data-part', 'data-state', 'data-disabled'] },
      ),
    // The visible label text (G3A SHOULD-6): a span inside the wrapping root <label>, so the root's
    // implicit label association names the input. Same state attributes as the other parts.
    getLabelProps: (consumer = {}) =>
      mergeProps(
        consumer,
        { class: 'sj-switch__label', 'data-part': 'label', ...stateAttrs() },
        { part: 'label', protect: ['data-part', 'data-state', 'data-disabled'] },
      ),
  };
}
