// SJDisclosure for Vue (C06.c): a flat component over core `createDisclosureParts`. The root is a
// real `<details>` and the trigger a real `<summary>`: the browser owns `open`, Enter/Space, focus
// and the expanded state exposed to AT (no `aria-expanded`, registry decision). Store, controlled
// pipeline and effect drain come from the shared runtime (`useSJStore`), never a local bridge
// (ADR-003). The exclusive-group fallback (`closePeers`) runs only when `supports.detailsName` is false.
import { defineComponent, h, onMounted, useId, type PropType, type VNodeChild } from 'vue';
import {
  createDisclosureParts,
  disclosureBaseId,
  disclosureFields,
  initialSnapshot,
  peersToClose,
  storeReducer,
  type DisclosureAction,
  type DisclosureMember,
  type DisclosureProps,
} from '@ramoslabs/core/disclosure';
import type { DrainHost, EffectInput } from '@ramoslabs/core/effects';
import { useSJRuntime, useSJStore } from '../runtime/index';
import type { SJDisclosureOpenChangePayload } from '../generated/disclosure/index';

type CorrectiveX = EffectInput & { readonly value?: unknown };

/** Per-part class overrides, appended after the library class (ADR-004). */
export interface SJDisclosureClasses {
  root?: string;
  trigger?: string;
  content?: string;
}

export const SJDisclosure = defineComponent({
  name: 'SJDisclosure',
  inheritAttrs: false,
  props: {
    /** Present = controlled (use `v-model:open`). Absent = uncontrolled. */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    /** Exclusive group name (`<details name>`). */
    name: { type: String, default: undefined },
    id: { type: String, default: undefined },
    /** Visible title of the trigger; the `summary` slot wins when both are given. */
    summary: { type: String, default: undefined },
    classes: { type: Object as PropType<SJDisclosureClasses>, default: undefined },
  },
  emits: {
    'update:open': (open: boolean) => typeof open === 'boolean',
    openChange: (payload: SJDisclosureOpenChangePayload) => typeof payload.open === 'boolean',
  },
  setup(props, { attrs, emit, slots }) {
    const runtime = useSJRuntime();
    let root: HTMLDetailsElement | null = null;
    // The only effect is the corrective `open` write onto `<details>` (controlled rejection).
    const host: DrainHost<CorrectiveX> = {
      run(effect) {
        if (root && effect.type === 'open') root.open = effect.value === true;
      },
    };
    const getProps = (): DisclosureProps => ({
      open: props.open,
      defaultOpen: props.defaultOpen,
      disabled: props.disabled,
      name: props.name,
      id: props.id,
      onOpenChange: (open: boolean) => {
        emit('update:open', open);
        emit('openChange', { open });
      },
    });
    const sj = useSJStore<
      ReturnType<typeof initialSnapshot>,
      DisclosureAction,
      CorrectiveX,
      DisclosureProps
    >({
      initial: initialSnapshot(props.open ?? props.defaultOpen),
      reduce: storeReducer,
      host,
      props: getProps,
      fields: disclosureFields,
    });

    // Owned exclusive-group fallback: engines with native `<details name>` need nothing. Elsewhere,
    // close the other open members that share the name (their own `toggle` then reports).
    const closePeers = (rootId: string) => {
      if (runtime.supports.detailsName || !root) return;
      const name = root.getAttribute('name');
      if (!name) return;
      const scope = root.getRootNode() as ParentNode;
      const byId = new Map<string, HTMLDetailsElement>();
      const members: DisclosureMember[] = [];
      scope.querySelectorAll<HTMLDetailsElement>('details[name]').forEach((el, i) => {
        const id = el === root ? rootId : `peer:${i}`;
        byId.set(id, el);
        members.push({ id, name: el.getAttribute('name'), open: el.open });
      });
      for (const id of peersToClose(rootId, members)) byId.get(id)!.open = false;
    };

    const parts = createDisclosureParts({
      view: sj.view,
      native: sj.native,
      getProps,
      closePeers,
      id: disclosureBaseId(props.id, () => useId() ?? '', 'sj-disclosure-'),
    });

    // The vnode carries only the INITIAL `open` (also what SSR emits); the live state is written to
    // the property, so Vue's patching never fights the browser's own toggling.
    const initialOpen = sj.view().open;
    const syncOpen = () => {
      if (root && root.open !== sj.view().open) root.open = sj.view().open;
    };
    // `<details>` works before any script: report a state that differs from the view at mount.
    onMounted(() => {
      if (root && root.open !== sj.view().open) sj.native('open', root.open);
    });

    return () => {
      const { class: attrClass, style: attrStyle, ...rest } = attrs as Record<string, unknown>;
      const classes = props.classes ?? {};
      const cls = (...c: unknown[]) => c.filter(Boolean).join(' ') || undefined;
      const { open: _open, ...rootProps } = parts.getRootProps({
        ...rest,
        class: cls(classes.root, attrClass),
        style: attrStyle,
      }) as Record<string, unknown>;
      void _open;
      const title = (slots.summary?.() ?? props.summary) as VNodeChild;
      return h(
        'details',
        {
          ...rootProps,
          open: initialOpen,
          ref: (el: unknown) => void (root = el as HTMLDetailsElement | null),
          onVnodeUpdated: syncOpen,
        },
        [
          h('summary', parts.getTriggerProps({ class: classes.trigger }), title as string),
          h('div', parts.getContentProps({ class: classes.content }), slots.default?.()),
        ],
      );
    };
  },
});
