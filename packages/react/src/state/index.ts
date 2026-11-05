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
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { createState, stateLive } from '@ramoslabs/core/state';
import type { Props } from '@ramoslabs/core/merge';
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
  const model = createState(() => ({
    ...(variant !== undefined && { variant }),
    // Only text can be announced; a node heading needs an explicit `announce`.
    ...(typeof copy === 'string' && { heading: copy }),
    ...(announce !== undefined && { announce }),
    ...(interrupt !== undefined && { interrupt }),
  }));

  // Stateless: the shared runtime supplies the live registry; the contract's `stateLive` decides whether
  // the region is created eagerly (before its first message).
  const { runtime, live, requireLive } = useRuntimeBag();
  useLayoutEffect(() => {
    if (stateLive === 'eager') requireLive?.();
  }, [requireLive]);

  const note = model.getAnnouncement();
  const text = note?.text;
  const urgent = note?.urgent === true;
  // After commit, client only. The call is deferred one scheduler tick and cancelled by the cleanup, so
  // StrictMode's simulated remount (which re-attaches the registry) yields exactly one announcement.
  const { scheduler } = runtime;
  useEffect(
    () => (text ? scheduler.after(() => void live.announce(text, { urgent }), 0) : undefined),
    [live, scheduler, text, urgent],
  );

  const body = has(children) ? children : description;
  return createElement(
    'div',
    { ...fromGetter(model.getRootProps(toGetter(own(rest, classes?.root)))), ref },
    has(icon) &&
      createElement('span', { ...fromGetter(model.getIconProps(), classes?.icon) }, icon),
    has(copy) && createElement('p', { ...fromGetter(model.getTitleProps(), classes?.title) }, copy),
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
