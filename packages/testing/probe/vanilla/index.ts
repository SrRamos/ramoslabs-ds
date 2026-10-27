// Probe wrapper for @ramoslabs/vanilla (W1-316). Uses the shared host (createHost) only; text nodes
// only. `mountProbe` mounts on an existing element and rewrites it as the probe's root.
import type { ComponentSpec, Instance, VanillaHost } from '@ramoslabs/vanilla/runtime';
import {
  probeFields,
  rootAttrs,
  storeReducer,
  type ProbeEvent,
  type ProbeSnapshot,
} from '../reducer';

export interface ProbeProps {
  pressed?: boolean;
  defaultPressed?: boolean;
  disabled?: boolean;
  label?: string;
  onPressedChange?: (pressed: boolean) => void;
  [key: string]: unknown;
}

export const probeSpec: ComponentSpec<ProbeSnapshot, ProbeEvent, ProbeProps, never> = {
  initial: (props) => ({ pressed: props.defaultPressed ?? false }),
  reduce: storeReducer,
  fields: probeFields,
  patch(view, ctx) {
    const props = ctx.props();
    const { el } = ctx;
    const attrs = rootAttrs(view, props.disabled ?? false);
    for (const name of ['disabled', 'data-disabled']) el.removeAttribute(name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v === true ? '' : String(v));
    let indicator = el.querySelector('[data-part="indicator"]');
    if (!indicator) {
      indicator = el.ownerDocument.createElement('span');
      indicator.className = 'sj-probe__indicator';
      indicator.setAttribute('data-part', 'indicator');
      el.replaceChildren(indicator, el.ownerDocument.createTextNode(''));
    }
    (indicator.nextSibling as Text).data = props.label ?? '';
  },
  attach(ctx) {
    ctx.listen(ctx.el, 'click', () => void ctx.request('pressed', !ctx.view().pressed));
  },
};

export function mountProbe(
  host: VanillaHost,
  el: Element,
  props: ProbeProps,
): Instance<ProbeProps> {
  return host.mount(el, probeSpec, props);
}
