// SJDisclosure core (C06.a): reducer, controlled-field description and per-part prop getters.
// Native-first (Section 1.2 principle 1, ADR-008): root is a real `<details>`, trigger a real
// `<summary>`. The browser owns `open`, Enter/Space activation, focus, find-in-page and the
// expanded state exposed to AT, so the getters never emit `aria-expanded` or `aria-controls`
// (registry decision, ADR-015: `mustNot manual-aria-expanded-on-summary`) and add no keydown
// handler. `open` is emitted from `view()` so the adapter keeps the DOM in step; the native
// `toggle` event reports actual state back through `native('open', ...)`.
// Getters are pure functions of `view()` and `getProps()` (ADR-004); adapters own the store.
import { mergeProps, type Props } from '../merge/index';
import { baseId } from '../ids/index';
import type { DisclosureSnapshot } from './reducer';

export {
  disclosureFields,
  harness,
  initialSnapshot,
  reduce,
  reducerEvents,
  storeReducer,
} from './reducer';
export type {
  DisclosureAction,
  DisclosureEffect,
  DisclosureEvent,
  DisclosureSnapshot,
  DisclosureState,
} from './reducer';

/** Props the adapter exposes through `getProps()`. `open` present = controlled. */
// A type alias (not an interface) so it satisfies the controlled pipeline's `Bag` index signature.
export type DisclosureProps = {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly disabled?: boolean;
  /** Exclusive group name (`<details name>`); members with the same name keep one open. */
  readonly name?: string;
  /** Explicit root id; otherwise derived from the adapter's id source. */
  readonly id?: string;
  readonly onOpenChange?: (open: boolean) => void;
};

/** What the getters need from the adapter's store bridge (`useSJStore`, `useMachine`, vanilla). */
export interface DisclosureContext {
  /** Snapshot with the controlled `open` overlaid (`controlled.view()`). */
  readonly view: () => DisclosureSnapshot;
  /** `controlled.native`: records the native `<details>` state, notifies, dispatches when uncontrolled. */
  readonly native: (field: 'open', actual: boolean) => boolean;
  readonly getProps: () => DisclosureProps;
  /** Base id from `disclosureBaseId` (computed once per instance). */
  readonly id: string;
}

export interface DisclosureParts {
  readonly ids: { readonly root: string; readonly trigger: string; readonly content: string };
  getRootProps(consumer?: Props): Props;
  getTriggerProps(consumer?: Props): Props;
  getContentProps(consumer?: Props): Props;
}

/** Root id: explicit wins, otherwise `prefix + acquire()` (ADR-003 SSR-safe ids). */
export const disclosureBaseId = (
  explicit: string | undefined,
  acquire: () => string,
  prefix = '',
): string => baseId(explicit, acquire, prefix);

/** The shape of a `toggle` event the getter reads: only the `<details>` that fired it. */
interface ToggleLike {
  readonly currentTarget?: { readonly open?: boolean } | null;
  readonly target?: { readonly open?: boolean } | null;
}

/** One member of a `name` group as the adapter observes it (after mount). */
export interface DisclosureMember {
  readonly id: string;
  readonly name?: string | null;
  readonly open: boolean;
}

/**
 * Owned exclusive-group fallback (Chromium 114-119, Firefox 125-129, Safari 17.0-17.1): ids of the
 * other open members that share the opened member's non-empty `name`, in input (DOM) order. Pure;
 * the adapter collects `members` from the DOM when it runs a `closePeers` effect with
 * `supports.detailsName` false, then sets `open = false` on each returned element.
 */
export function peersToClose(selfId: string, members: readonly DisclosureMember[]): string[] {
  const self = members.find((m) => m.id === selfId);
  const name = self?.name;
  if (!name) return [];
  return members.filter((m) => m.id !== selfId && m.open && m.name === name).map((m) => m.id);
}

export function createDisclosureParts(ctx: DisclosureContext): DisclosureParts {
  const ids = { root: ctx.id, trigger: `${ctx.id}-trigger`, content: `${ctx.id}-panel` };
  const disabledOf = () => ctx.getProps().disabled === true;
  const stateAttrs = () => ({
    'data-state': ctx.view().open ? 'open' : 'closed',
    // `undefined` is a library-owned value: it also removes a consumer-set attribute.
    'data-disabled': disabledOf() ? 'true' : undefined,
  });
  const partProps = (part: string, consumer: Props, extra: Props = {}, protect: string[] = []) =>
    mergeProps(
      consumer,
      { class: `sj-disclosure__${part}`, 'data-part': part, ...stateAttrs(), ...extra },
      { part, protect: ['data-part', 'data-state', 'data-disabled', ...protect] },
    );

  return {
    ids,
    getRootProps: (consumer = {}) => {
      const props = ctx.getProps();
      return partProps(
        'root',
        consumer,
        {
          id: ids.root,
          // A property/attribute the adapter applies to `<details>`; the DOM follows the view.
          open: ctx.view().open,
          ...(props.name !== undefined && { name: props.name }),
          // The `toggle` event fires after the change and also for programmatic changes (including
          // the corrective `open` effect), so only a difference from the view is a user change.
          onToggle: (event?: ToggleLike) => {
            const el = event?.currentTarget ?? event?.target;
            if (!el || typeof el.open !== 'boolean') return;
            if (el.open !== ctx.view().open) ctx.native('open', el.open);
          },
        },
        ['id', 'open', 'name'],
      );
    },
    getTriggerProps: (consumer = {}) =>
      partProps(
        'trigger',
        consumer,
        {
          id: ids.trigger,
          // No `aria-expanded` / `aria-controls`: `<summary>` exposes the expanded state natively.
          'aria-disabled': disabledOf() ? 'true' : undefined,
          // Enter and Space on a `<summary>` synthesize `click`, so one handler blocks both.
          onClick: (event?: { preventDefault?: () => void }) => {
            if (disabledOf()) event?.preventDefault?.();
          },
        },
        ['id', 'aria-disabled'],
      ),
    getContentProps: (consumer = {}) => partProps('content', consumer, { id: ids.content }, ['id']),
  };
}
