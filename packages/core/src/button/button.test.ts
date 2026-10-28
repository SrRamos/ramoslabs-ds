import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import contract from '../../../contracts/contracts/button.contract.json';
import { buttonKeyboard, buttonMachine } from '../generated/button/index';
import {
  buttonSizes,
  buttonTones,
  buttonVariants,
  createButton,
  reduce,
  reducerEvents,
} from './index';
import type { ButtonProps } from './index';

declare const console: { warn(m: string): void };

const mk = (props: ButtonProps = {}) => createButton(() => props);
const click = (bag: Record<string, unknown>, event = { defaultPrevented: false } as object) => {
  (bag.onClick as (e: object) => void)(event);
  return event;
};

const propsArb = fc.record(
  {
    variant: fc.oneof(fc.constantFrom(...buttonVariants), fc.string()),
    tone: fc.oneof(fc.constantFrom(...buttonTones), fc.string()),
    size: fc.oneof(fc.constantFrom(...buttonSizes), fc.string()),
    disabled: fc.boolean(),
    type: fc.constantFrom('button', 'submit', 'reset', 'nonsense'),
    href: fc.oneof(fc.constant(''), fc.webUrl()),
    target: fc.constantFrom('_blank', '_self'),
    rel: fc.constantFrom('nofollow', 'noopener'),
    iconOnly: fc.boolean(),
    label: fc.string(),
    id: fc.string(),
  },
  { requiredKeys: [] },
) as fc.Arbitrary<ButtonProps>;

describe('reducer (state table)', () => {
  it('exports reducerEvents equal to the contract actions', () => {
    expect([...reducerEvents]).toEqual([...new Set(contract.actions.map((a) => a.id))]);
  });
  it('every contract row holds and an unknown event is a no-op', () => {
    for (const a of contract.actions) expect(reduce(a.from as 'idle', { type: a.id })).toBe(a.to);
    expect(reduce('idle', { type: '__unknown__' })).toBe('idle');
  });
  it('invariant: total, idempotent, never leaves the declared states', () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.constant('press'), fc.string())), (types) => {
        let s = buttonMachine.initial as 'idle';
        for (const type of types) {
          const next = reduce(s, { type });
          expect(buttonMachine.states).toContain(next);
          expect(reduce(next, { type })).toBe(next);
          s = next;
        }
      }),
    );
  });
  it('is stateless by contract: nothing controllable, so nothing to read', () => {
    expect(contract.state.controllable).toEqual([]);
  });
});

describe('contract drift', () => {
  it('axes in core equal the contract prop types', () => {
    const union = (name: string) =>
      (contract.props.find((p) => p.name === name)!.type.match(/'([^']+)'/g) ?? []).map((s) =>
        s.slice(1, -1),
      );
    expect(union('variant')).toEqual([...buttonVariants]);
    expect(union('tone')).toEqual([...buttonTones]);
    expect(union('size')).toEqual([...buttonSizes]);
  });
  it('keyboard map: Enter and Space on root, Enter only on the link', () => {
    expect(buttonKeyboard.root).toEqual({ Enter: 'press', Space: 'press' });
    expect(buttonKeyboard.link).toEqual({ Enter: 'press' });
  });
  it('the contract declares an accessible-name prop for icon-only', () => {
    const names = contract.props.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['iconOnly', 'label']));
  });
});

describe('element selection', () => {
  it('button by default, link only for a non-empty href', () => {
    expect(mk().element()).toBe('button');
    expect(mk({ href: '' }).element()).toBe('button');
    expect(mk({ href: '/x' }).element()).toBe('a');
  });
});

describe('getRootProps (button)', () => {
  it('defaults', () => {
    expect(mk().getRootProps()).toEqual({
      class: 'sj-button__root',
      type: 'button',
      'data-part': 'root',
      'data-variant': 'solid',
      'data-tone': 'primary',
      'data-size': 'md',
      onClick: expect.any(Function),
    });
  });
  it('disabled uses the native attribute plus the styling hook', () => {
    const bag = mk({ disabled: true }).getRootProps();
    expect(bag.disabled).toBe(true);
    expect(bag['data-disabled']).toBe('true');
    expect('aria-disabled' in bag).toBe(false);
  });
  it('type is never an implicit submit', () => {
    expect(mk({ type: 'submit' }).getRootProps().type).toBe('submit');
    expect(mk({ type: 'bogus' as never }).getRootProps().type).toBe('button');
  });
  it('icon-only with label gets aria-label and the hook', () => {
    const bag = mk({ iconOnly: true, label: 'Close' }).getRootProps();
    expect(bag['aria-label']).toBe('Close');
    expect(bag['data-icon-only']).toBe('true');
  });
  it('a consumer cannot override library-owned hooks or disabled', () => {
    const warn = vi.fn();
    const bag = mk({ disabled: true }).getRootProps({
      disabled: false,
      'data-variant': 'x',
      'data-part': 'y',
      class: 'mine',
      'data-test': 'kept',
    });
    expect(bag.disabled).toBe(true);
    expect(bag['data-variant']).toBe('solid');
    expect(bag['data-part']).toBe('root');
    expect(bag.class).toBe('sj-button__root mine');
    expect(bag['data-test']).toBe('kept');
    expect(warn).not.toHaveBeenCalled();
  });
  it('keeps a consumer id and aria-label when the library sets none (owned keys are not blanked)', () => {
    const bag = mk().getRootProps({ id: 'mine', 'aria-label': 'Save' });
    expect(bag.id).toBe('mine');
    expect(bag['aria-label']).toBe('Save');
    expect(mk({ id: 'lib' }).getRootProps({ id: 'mine' }).id).toBe('lib');
  });
  it('unknown axis values fall back to the defaults', () => {
    const bag = mk({
      variant: 'neon' as never,
      tone: 'x' as never,
      size: 'xl' as never,
    }).getRootProps();
    expect([bag['data-variant'], bag['data-tone'], bag['data-size']]).toEqual([
      'solid',
      'primary',
      'md',
    ]);
  });
});

describe('getLinkProps (a)', () => {
  it('enabled: href, native role (none set), no disabled state', () => {
    const bag = mk({ href: '/x' }).getLinkProps();
    expect(bag.href).toBe('/x');
    expect(bag['data-part']).toBe('link');
    expect(bag.class).toBe('sj-button__link');
    for (const k of ['role', 'aria-disabled', 'type', 'disabled', 'data-disabled'])
      expect(k in bag).toBe(false);
  });
  it('disabled: no href, explicit role, aria-disabled (an anchor has no disabled attribute)', () => {
    const bag = mk({ href: '/x', disabled: true, target: '_blank' }).getLinkProps({
      href: '/leak',
    });
    expect('href' in bag).toBe(false);
    expect('target' in bag).toBe(false);
    expect(bag.role).toBe('link');
    expect(bag['aria-disabled']).toBe('true');
    expect(bag['data-disabled']).toBe('true');
    expect('disabled' in bag).toBe(false);
  });
  it('target=_blank adds rel noopener noreferrer unless rel is set', () => {
    expect(mk({ href: '/x', target: '_blank' }).getLinkProps().rel).toBe('noopener noreferrer');
    expect(mk({ href: '/x', target: '_blank', rel: 'nofollow' }).getLinkProps().rel).toBe(
      'nofollow',
    );
    expect('rel' in mk({ href: '/x' }).getLinkProps()).toBe(false);
  });
});

describe('getIconProps', () => {
  it('is decorative', () => {
    expect(mk().getIconProps()).toEqual({
      class: 'sj-button__icon',
      'aria-hidden': 'true',
      'data-part': 'icon',
    });
    expect(mk().getIconProps({ 'aria-hidden': 'false' })['aria-hidden']).toBe('true');
  });
});

describe('press handler', () => {
  it('calls onPress with the original event', () => {
    const onPress = vi.fn();
    const event = {};
    click(mk({ onPress }).getRootProps(), event);
    expect(onPress).toHaveBeenCalledWith({ originalEvent: event });
  });
  it('disabled: prevents default and never presses (button and link)', () => {
    const onPress = vi.fn();
    const p = { disabled: true, href: '/x', onPress };
    for (const bag of [mk(p).getRootProps(), mk(p).getLinkProps()]) {
      const preventDefault = vi.fn();
      click(bag, { preventDefault });
      expect(preventDefault).toHaveBeenCalled();
    }
    expect(onPress).not.toHaveBeenCalled();
  });
  it('consumer handler runs first and preventDefault cancels the press', () => {
    const order: string[] = [];
    const bag = mk({ onPress: () => order.push('press') }).getRootProps({
      onClick: (e: { defaultPrevented: boolean }) => {
        order.push('consumer');
        e.defaultPrevented = true;
      },
    });
    click(bag);
    expect(order).toEqual(['consumer']);
    const plain = mk({ onPress: () => order.push('press') }).getRootProps({
      onClick: () => order.push('consumer2'),
    });
    click(plain);
    expect(order).toEqual(['consumer', 'consumer2', 'press']);
  });
  it('reads the latest props when the event fires', () => {
    let props: ButtonProps = {};
    const b = createButton(() => props);
    const bag = b.getRootProps();
    const onPress = vi.fn();
    props = { onPress };
    click(bag);
    expect(onPress).toHaveBeenCalledTimes(1);
    props = { onPress, disabled: true };
    click(bag);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('accessible name (dev warning, mirrors lint contract/icon-only-name)', () => {
  const spy = () =>
    vi.spyOn(console as { warn: (m: string) => void }, 'warn').mockImplementation(() => {});
  it('warns for icon-only without any name', () => {
    const w = spy();
    mk({ iconOnly: true }).getRootProps();
    expect(w).toHaveBeenCalledTimes(1);
    w.mockRestore();
  });
  it.each([
    ['label', { iconOnly: true, label: 'Close' }, {}],
    ['consumer aria-label', { iconOnly: true }, { 'aria-label': 'Close' }],
    ['consumer aria-labelledby', { iconOnly: true }, { 'aria-labelledby': 'x' }],
    ['text button', {}, {}],
  ])('does not warn with %s', (_n, props, consumer) => {
    const w = spy();
    mk(props).getRootProps(consumer);
    expect(w).not.toHaveBeenCalled();
    w.mockRestore();
  });
});

describe('invariants (fast-check)', () => {
  it('getters are pure: same props, same output; inputs are not mutated', () => {
    fc.assert(
      fc.property(propsArb, fc.dictionary(fc.string(), fc.string()), (props, consumer) => {
        const frozen = Object.freeze({ ...consumer });
        const strip = (o: Record<string, unknown>) =>
          JSON.stringify(o, (_k, v) => (typeof v === 'function' ? 'fn' : v));
        const w = vi
          .spyOn(console as { warn: (m: string) => void }, 'warn')
          .mockImplementation(() => {});
        const b = mk(props);
        for (const g of ['getRootProps', 'getLinkProps', 'getIconProps'] as const) {
          expect(strip(b[g](frozen))).toBe(strip(b[g](frozen)));
          expect(strip(b[g](frozen))).toBe(strip(createButton(() => props)[g](frozen)));
        }
        w.mockRestore();
        expect(frozen).toEqual(consumer);
      }),
    );
  });
  it('axes are always valid; a disabled button always carries native disabled; links never do', () => {
    fc.assert(
      fc.property(propsArb, (props) => {
        const w = vi
          .spyOn(console as { warn: (m: string) => void }, 'warn')
          .mockImplementation(() => {});
        const b = mk(props);
        const bag = b.element() === 'a' ? b.getLinkProps() : b.getRootProps();
        w.mockRestore();
        expect(buttonVariants).toContain(bag['data-variant']);
        expect(buttonTones).toContain(bag['data-tone']);
        expect(buttonSizes).toContain(bag['data-size']);
        if (b.element() === 'button') expect(bag.disabled === true).toBe(props.disabled === true);
        else {
          expect('disabled' in bag).toBe(false);
          expect('href' in bag).toBe(props.disabled !== true);
        }
        expect(bag['data-disabled'] === 'true').toBe(props.disabled === true);
      }),
    );
  });
});
