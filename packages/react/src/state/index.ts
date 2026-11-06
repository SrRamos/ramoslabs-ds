// SJState for React (W1-C11.d). Thin: the core getters (`createState`) produce every attribute, the shared
// runtime (`useMachine`) owns the live registry and hands it the announcement AFTER mount. Nothing here
// renders live markup: the root never carries role/aria-live, so the server output has none (ADR-006).
// `heading` is the copy prop (`title` is a global HTML attribute); `title` is accepted as the slot form.
// Prop-or-slot: icon, heading/title, description/children and actions. A slot wins over its prop.
import {
  createElement,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { createState } from '@ramoslabs/core/state';
import type { Props } from '@ramoslabs/core/merge';
import { stateLive } from '../generated/state/index';
import type { SJStateProps as GeneratedProps } from '../generated/state/index';
import { useRuntimeBag } from '../runtime/index';

export type { SJStateProps as SJStateContractProps } from '../generated/state/index';

/** Per-part class overrides (ADR-004); concatenated after the library class. */
export interface SJStateClasses {
  root?: string;
  icon?: string;
  title?: string;
  description?: string;
  actions?: string;
}

export interface SJStateRootProps
  extends
    Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'title'>,
    Omit<GeneratedProps, 'icon' | 'title' | 'children' | 'actions'> {
  classes?: SJStateClasses;
  /** Slot: decorative glyph (an SJIcon); always `aria-hidden`. */
  icon?: ReactNode;
  /** Slot form of `heading`. */
  title?: ReactNode;
  /** Slot: description copy. */
  children?: ReactNode;
  /** Slot: next-step controls (SJButton). */
  actions?: ReactNode;
}
export type SJStateProps = SJStateRootProps;

const toGetter = (p: Record<string, unknown>): Props => {
  const { className, ...rest } = p;
  return className === undefined ? rest : { ...rest, class: className };
};
const fromGetter = (p: Props, extra?: string): Record<string, unknown> => {
  const { class: cls, ...rest } = p as { class?: string } & Record<string, unknown>;
  const className = [cls, extra].filter(Boolean).join(' ');
  return className ? { ...rest, className } : rest;
};
/** `classes.root` goes before the consumer's `className`, both after the library class. */
const own = (rest: Record<string, unknown>, root?: string): Record<string, unknown> => {
  const className = [root, rest.className].filter(Boolean).join(' ');
  return className ? { ...rest, className } : rest;
};
const has = (n: ReactNode): boolean => n !== undefined && n !== null && n !== false && n !== '';

export const SJStateRoot: ForwardRefExoticComponent<
  SJStateRootProps & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, SJStateRootProps>(function SJStateRoot(props, ref) {
  const {
    variant,
    heading,
    description,
    announce,
    interrupt,
    classes,
    icon,
    title,
    children,
    actions,
    ...rest
  } = props;

  const copy = has(title) ? title : heading;
  // Only a string (or number) heading is known at render time; any other node is read back from the DOM after commit.
  const text = typeof copy === 'string' || typeof copy === 'number' ? String(copy) : undefined;
  const nodeCopy = has(copy) && text === undefined;
  const modelProps = {
    ...(variant !== undefined && { variant }),
    ...(announce !== undefined && { announce }),
    ...(interrupt !== undefined && { interrupt }),
  };
  const model = createState(() => ({
    ...modelProps,
    ...(text !== undefined && { heading: text }),
  }));

  // Stateless: the shared runtime supplies the live registry; the contract's `stateLive` decides whether
  // the region is created eagerly (before its first message).
  const { runtime, live, requireLive } = useRuntimeBag();
  useLayoutEffect(() => {
    if (stateLive === 'eager') requireLive?.();
  }, [requireLive]);

  // One announcement per change (ADR-006), after commit and client only. A heading that is an element is announced
  // as the text the user sees (read from the DOM), as the Vue and vanilla adapters do. The call is deferred one
  // scheduler tick. The pending call and the memory of the last message live in refs and are dropped by the
  // lifecycle cleanup only, so StrictMode's simulated remount (which re-attaches the registry) re-announces
  // exactly once, and a re-render with the same text never cancels or repeats it.
  const { scheduler } = runtime;
  const titleEl = useRef<HTMLElement | null>(null);
  const last = useRef({ key: '', live });
  const pending = useRef<(() => void) | undefined>(undefined);
  useEffect(
    () => () => {
      pending.current?.();
      pending.current = undefined;
      last.current.key = '';
    },
    [],
  );
  useEffect(() => {
    const note = nodeCopy
      ? createState(() => ({
          ...modelProps,
          heading: titleEl.current?.textContent ?? '',
        })).getAnnouncement()
      : model.getAnnouncement();
    if (last.current.live !== live) last.current = { key: '', live };
    const key = note ? `${note.urgent ? '!' : ''}${note.text}` : '';
    if (key === last.current.key) return;
    last.current.key = key;
    pending.current?.();
    pending.current = undefined;
    if (note)
      pending.current = scheduler.after(
        () => void live.announce(note.text, { urgent: note.urgent }),
        0,
      );
  });

  const body = has(children) ? children : description;
  return createElement(
    'div',
    { ...fromGetter(model.getRootProps(toGetter(own(rest, classes?.root)))), ref },
    has(icon) &&
      createElement('span', { ...fromGetter(model.getIconProps(), classes?.icon) }, icon),
    has(copy) &&
      createElement(
        'p',
        { ...fromGetter(model.getTitleProps(), classes?.title), ref: titleEl },
        copy,
      ),
    has(body) &&
      createElement(
        'p',
        { ...fromGetter(model.getDescriptionProps(), classes?.description) },
        body,
      ),
    has(actions) &&
      createElement('div', { ...fromGetter(model.getActionsProps(), classes?.actions) }, actions),
  );
});

/** `SJState` is the preset; `SJState.Root` is the primitive (ADR-002). */
export const SJState: ForwardRefExoticComponent<SJStateProps & RefAttributes<HTMLDivElement>> & {
  Root: typeof SJStateRoot;
} = Object.assign(
  forwardRef<HTMLDivElement, SJStateProps>(function SJState(props, ref): ReactElement {
    return createElement(SJStateRoot, { ...props, ref });
  }),
  { Root: SJStateRoot },
);
