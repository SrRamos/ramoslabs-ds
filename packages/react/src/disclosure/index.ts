// SJDisclosure for React (C06.d). Thin: the core getters (`createDisclosureParts`) produce every attribute
// and handler, the shared runtime (`useMachine`) owns the store and the post-commit corrective effect.
// Native-first (ADR-008): Root is a real `<details>`, Trigger a real `<summary>`, Content a `<div>`.
// The browser owns the open state, Enter/Space and find-in-page; the `toggle` event reports back through
// `native('open', ...)`. No `aria-expanded` is emitted (registry decision). Nothing here reads `document`
// in render; the DOM is touched only in effects and in the `closePeers` hook (after a toggle).
import {
  createContext,
  createElement,
  forwardRef,
  Fragment,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from 'react';
import {
  createDisclosureParts,
  disclosureBaseId,
  disclosureFields,
  initialSnapshot,
  peersToClose,
  storeReducer,
  type DisclosureAction,
  type DisclosureMember,
  type DisclosureParts,
  type DisclosureSnapshot,
} from '@ramoslabs/core/disclosure';
import type { Props } from '@ramoslabs/core/merge';
import type { SJDisclosureProps as GeneratedProps } from '../generated/disclosure/index';
import { useMachine } from '../runtime/index';

export type {
  SJDisclosureOpenChangePayload,
  SJDisclosureProps as SJDisclosureContractProps,
} from '../generated/disclosure/index';

/** Per-part class overrides (ADR-004); concatenated after the library class. */
export interface SJDisclosureClasses {
  root?: string;
  trigger?: string;
  content?: string;
}

type RootAttrs = Omit<ComponentPropsWithoutRef<'details'>, 'children' | 'id' | 'open' | 'name'>;

export interface SJDisclosureRootProps
  extends RootAttrs, Omit<GeneratedProps, 'children' | 'summary'> {
  classes?: SJDisclosureClasses;
  /** Prop-or-slot: when given, renders the trigger with this title and the content with `children`. */
  summary?: ReactNode;
  /** Slot: the content, or explicit `Trigger`/`Content` parts when `summary` is absent. */
  children?: ReactNode;
}
export type SJDisclosureTriggerProps = ComponentPropsWithoutRef<'summary'>;
export type SJDisclosureContentProps = ComponentPropsWithoutRef<'div'>;

interface Ctx {
  parts: DisclosureParts;
  classes: SJDisclosureClasses | undefined;
}
const DisclosureContext = createContext<Ctx | null>(null);

function useCtx(part: string): Ctx {
  const c = useContext(DisclosureContext);
  if (!c) throw new Error(`SJDisclosure.${part} must be rendered inside SJDisclosure.Root`);
  return c;
}

/** React props to the getters' vocabulary (`className` -> `class`) and back. */
const toGetter = (p: Record<string, unknown>): Props => {
  const { className, ...rest } = p;
  return className === undefined ? rest : { ...rest, class: className };
};
const fromGetter = (p: Props, extra?: string): Record<string, unknown> => {
  const { class: cls, ...rest } = p as { class?: string } & Record<string, unknown>;
  const className = [cls, extra].filter(Boolean).join(' ');
  return className ? { ...rest, className } : rest;
};

type RootEffect = { type: 'open'; target: 'root'; value: boolean };

export const SJDisclosureRoot: ForwardRefExoticComponent<
  SJDisclosureRootProps & RefAttributes<HTMLDetailsElement>
> = forwardRef<HTMLDetailsElement, SJDisclosureRootProps>(function SJDisclosureRoot(props, ref) {
  const {
    open,
    defaultOpen,
    disabled,
    name,
    id,
    onOpenChange,
    classes,
    summary,
    children,
    ...rest
  } = props;
  const reactId = useId();
  const root = useRef<HTMLDetailsElement | null>(null);
  const setRoot = useCallback(
    (el: HTMLDetailsElement | null) => {
      root.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const latest = useRef({ onOpenChange });
  latest.current = { onOpenChange };
  const notify = useCallback((next: boolean) => latest.current.onOpenChange?.({ open: next }), []);

  const bag = {
    ...(open !== undefined && { open }),
    ...(disabled !== undefined && { disabled }),
    ...(name !== undefined && { name }),
    ...(id !== undefined && { id }),
    // Always present: the pipeline only calls it; the consumer's callback is read at call time.
    onOpenChange: notify,
  };
  const m = useMachine<DisclosureSnapshot, DisclosureAction, RootEffect, typeof bag>({
    initial: () => initialSnapshot(defaultOpen ?? open ?? false),
    reduce: storeReducer,
    props: bag,
    fields: disclosureFields,
    exists: () => root.current !== null,
    run(effect) {
      // A controlled owner rejected the change: put the native element back (corrective effect).
      const el = root.current;
      if (el && el.open !== effect.value) el.open = effect.value;
    },
  });

  const { native, runtime } = m;
  const nativeRef = useRef(native);
  nativeRef.current = native;

  // `<details>` works before any script: report a state that differs from the view once, at mount
  // (pre-hydration toggle). After that the DOM follows the view only when the view itself changed, so a
  // native toggle whose event is still queued is never undone by an unrelated re-render.
  const viewOpen = m.state.open;
  const seen = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (seen.current === null) {
      if (el.open !== viewOpen) nativeRef.current('open', el.open);
    } else if (seen.current !== viewOpen && el.open !== viewOpen) {
      el.open = viewOpen;
    }
    seen.current = viewOpen;
  });

  // Owned exclusive-group fallback (engines without native `<details name>`): close the other open
  // members of the group; their own `toggle` then reports, as native does.
  const closePeers = (): void => {
    if (runtime.supports.detailsName) return;
    const el = root.current;
    if (!el) return;
    const scope = el.getRootNode() as ParentNode;
    const nodes = Array.from(scope.querySelectorAll<HTMLDetailsElement>('details[name]'));
    // Index ids: elements without an id (or with duplicates) must not collide.
    const self = nodes.indexOf(el);
    if (self < 0) return;
    const members: DisclosureMember[] = nodes.map((d, i) => ({
      id: String(i),
      name: d.getAttribute('name'),
      open: d.open,
    }));
    const close = new Set(peersToClose(String(self), members));
    nodes.forEach((d, i) => {
      if (i !== self && close.has(String(i))) d.open = false;
    });
  };

  const parts = createDisclosureParts({
    view: () => m.state,
    native,
    getProps: () => bag,
    closePeers,
    id: disclosureBaseId(id, () => reactId),
  });
  const ctx: Ctx = { parts, classes };

  const body =
    summary !== undefined
      ? createElement(
          Fragment,
          null,
          createElement(SJDisclosureTrigger, null, summary),
          createElement(SJDisclosureContent, null, children),
        )
      : children;
  return createElement(
    DisclosureContext.Provider,
    { value: ctx },
    createElement(
      'details',
      { ...fromGetter(parts.getRootProps(toGetter(rest)), classes?.root), ref: setRoot },
      body,
    ),
  );
});

export const SJDisclosureTrigger: ForwardRefExoticComponent<
  SJDisclosureTriggerProps & RefAttributes<HTMLElement>
> = forwardRef<HTMLElement, SJDisclosureTriggerProps>(function SJDisclosureTrigger(props, ref) {
  const { parts, classes } = useCtx('Trigger');
  return createElement('summary', {
    ...fromGetter(parts.getTriggerProps(toGetter(props)), classes?.trigger),
    ref,
  });
});

export const SJDisclosureContent: ForwardRefExoticComponent<
  SJDisclosureContentProps & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, SJDisclosureContentProps>(function SJDisclosureContent(props, ref) {
  const { parts, classes } = useCtx('Content');
  return createElement('div', {
    ...fromGetter(parts.getContentProps(toGetter(props)), classes?.content),
    ref,
  });
});

/** Namespace form (`SJDisclosure.Root`) plus the flat exports above (ADR-002). */
export const SJDisclosure = {
  Root: SJDisclosureRoot,
  Trigger: SJDisclosureTrigger,
  Content: SJDisclosureContent,
} as const;
