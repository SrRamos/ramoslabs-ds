// Probe wrapper for @ramoslabs/react (W1-316). Uses the shared bridge (useMachine) only.
import { createElement, type ReactElement, type ReactNode } from 'react';
import { useMachine } from '@ramoslabs/react/runtime';
import { probeFields, rootAttrs, storeReducer } from '../reducer';

export interface SJProbeProps {
  pressed?: boolean;
  defaultPressed?: boolean;
  disabled?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  children?: ReactNode;
}

export function SJProbe(props: SJProbeProps): ReactElement {
  const m = useMachine({
    initial: () => ({ pressed: props.defaultPressed ?? false }),
    reduce: storeReducer,
    props: props as Record<string, unknown>,
    fields: probeFields,
  });
  const { class: className, disabled, ...attrs } = rootAttrs(m.state, props.disabled ?? false);
  return createElement(
    'button',
    {
      ...attrs,
      className,
      disabled,
      onClick: () => void m.request('pressed', !m.state.pressed),
    },
    createElement('span', { className: 'sj-probe__indicator', 'data-part': 'indicator' }),
    props.children,
  );
}
