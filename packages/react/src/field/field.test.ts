import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, StrictMode, act, useContext, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { createFakeScheduler, type FakeScheduler } from '@ramoslabs/core/runtime';
import type { FormOwner } from '@ramoslabs/core/form';
import { SJProvider } from '../runtime/index';
import { SJForm, SJFormContext } from '../form/index';
import { SJInput } from '../input/index';
import { SJField, SJFieldHint, SJFieldLabel, SJFieldRoot } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let renderers: ReactTestRenderer[] = [];
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const r of renderers) act(() => r.unmount());
  renderers = [];
});

interface Harness {
  scheduler: FakeScheduler;
  spoken: string[];
  created: string[];
  ensured: { n: number };
}
function harness(): Harness {
  return { scheduler: createFakeScheduler(), spoken: [], created: [], ensured: { n: 0 } };
}
function provide(hs: Harness, node: ReactNode) {
  return h(
    SJProvider,
    {
      scheduler: hs.scheduler,
      target: 'client',
      liveHost: () => ({
        create(role) {
          hs.created.push(role);
          return { setText: (t: string) => void (t && hs.spoken.push(t)) };
        },
        ensure: () => void hs.ensured.n++,
      }),
    },
    node,
  );
}
function mount(hs: Harness, node: ReactNode): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(provide(hs, node), { createNodeMock: () => ({ form: new EventTarget() }) });
  });
  renderers.push(r);
  return r;
}
const flush = (hs: Harness) => act(() => void hs.scheduler.flush());
const field = (p: Record<string, unknown> = {}, ...kids: ReactNode[]) =>
  h(
    SJField.Root,
    { id: 'f', label: 'Email', ...p },
    ...(kids.length ? kids : [h(SJInput, { kind: 'email' })]),
  );
const control = (r: ReactTestRenderer) => r.root.findByType('input');

describe('naming (ADR-002)', () => {
  it('namespace and flat exports are the same components', () => {
    expect(SJField.Root).toBe(SJFieldRoot);
    expect(SJField.Label).toBe(SJFieldLabel);
    expect(SJField.Hint).toBe(SJFieldHint);
  });
  it('a part outside Root throws a clear error', () => {
    expect(() => renderToString(h(SJField.Label))).toThrow(/inside SJField.Root/);
  });
});

describe('structure and ids (ADR-003)', () => {
  it('ids are <id>, <id>-label, <id>-hint, <id>-error and the label points at the control', () => {
    const hs = harness();
    const r = mount(hs, field({ hint: 'We never share it.', error: 'Enter a valid email' }));
    const label = r.root.findByType('label');
    expect(label.props).toMatchObject({
      id: 'f-label',
      htmlFor: 'f',
      className: 'sj-field__label',
    });
    expect(control(r).props.id).toBe('f');
    expect(r.root.findByProps({ 'data-part': 'hint' }).props.id).toBe('f-hint');
    expect(r.root.findByProps({ 'data-part': 'error' }).props.id).toBe('f-error');
  });
  it('without an id the ids derive from useId and agree across parts', () => {
    const hs = harness();
    const r = mount(hs, h(SJField.Root, { label: 'Name', hint: 'h', error: 'e' }, h(SJInput)));
    const id = control(r).props.id as string;
    expect(id).toBeTruthy();
    expect(r.root.findByType('label').props.htmlFor).toBe(id);
    expect(control(r).props['aria-describedby']).toBe(`${id}-hint ${id}-error`);
  });
  it('order is label, hint, control, error; root carries data-invalid and data-disabled', () => {
    const hs = harness();
    const r = mount(hs, field({ hint: 'h', error: 'bad', disabled: true }));
    const tree = r.toJSON() as {
      props: Record<string, unknown>;
      children: { type: string; props: Record<string, unknown> }[];
    };
    expect(tree.props).toMatchObject({
      className: 'sj-field__root',
      'data-invalid': 'true',
      'data-disabled': 'true',
    });
    expect(tree.children.map((c) => c.props['data-part'] ?? c.type)).toEqual([
      'label',
      'hint',
      'root',
      'error',
    ]);
  });
});

describe('derived ARIA (ADR-014)', () => {
  it('valid: no aria-invalid, no describedby without a hint', () => {
    const r = mount(harness(), field());
    expect(control(r).props['aria-invalid']).toBeUndefined();
    expect(control(r).props['aria-describedby']).toBeUndefined();
    expect(r.root.findAllByProps({ 'data-part': 'error' })).toHaveLength(0);
  });
  it('invalid: aria-invalid=true, describedby hint then error, no aria-errormessage by default', () => {
    const r = mount(harness(), field({ hint: 'h', error: 'Enter a valid email' }));
    expect(control(r).props['aria-invalid']).toBe('true');
    expect(control(r).props['aria-describedby']).toBe('f-hint f-error');
    expect(control(r).props['aria-errormessage']).toBeUndefined();
  });
  it('errorMessage opts in to aria-errormessage; a blank error is valid', () => {
    const r = mount(harness(), field({ error: 'bad', errorMessage: true }));
    expect(control(r).props['aria-errormessage']).toBe('f-error');
    const blank = mount(harness(), field({ error: '   ' }));
    expect(control(blank).props['aria-invalid']).toBeUndefined();
  });
  it('name, required and disabled are native attributes from the field; aria-required is not emitted', () => {
    const r = mount(harness(), field({ name: 'email', required: true, disabled: true }));
    expect(control(r).props).toMatchObject({ name: 'email', required: true, disabled: true });
    expect(control(r).props['aria-required']).toBeUndefined();
  });
  it('the error carries an aria-hidden SJIcon alert-circle (sm) and the visible text, no role or live attribute', () => {
    const r = mount(harness(), field({ error: 'Enter a valid email' }));
    const err = r.root.findByProps({ 'data-part': 'error' });
    expect(err.props.role).toBeUndefined();
    expect(err.props['aria-live']).toBeUndefined();
    const icon = r.root.findByProps({ 'data-part': 'icon' });
    expect(icon.props).toMatchObject({ className: 'sj-field__icon', 'aria-hidden': 'true' });
    expect(r.root.findByType('svg').props['aria-hidden']).toBe('true');
    expect(err.children).toContain('Enter a valid email');
  });
  it('the consumer aria-describedby is appended after the derived ids', () => {
    const r = mount(
      harness(),
      field({ hint: 'h' }, h(SJInput, { 'aria-describedby': 'extra' } as never)),
    );
    expect(control(r).props['aria-describedby']).toBe('f-hint extra');
  });
});

describe('prop-or-slot', () => {
  it('slot form: Label and Hint parts, the control references the hint', () => {
    const r = mount(
      harness(),
      h(
        SJField.Root,
        { id: 'f' },
        h(SJField.Label, null, 'Slot label'),
        h(SJField.Hint, null, 'Slot hint'),
        h(SJInput),
      ),
    );
    expect(r.root.findByType('label').props.htmlFor).toBe('f');
    expect(r.root.findByProps({ id: 'f-hint' }).props['data-part']).toBe('hint');
    expect(control(r).props['aria-describedby']).toBe('f-hint');
  });
  it('the Hint part references itself and unregisters on unmount', () => {
    const tree = (on: boolean) =>
      provide(
        harness(),
        h(SJField.Root, { id: 'f' }, on ? h(SJField.Hint, null, 'x') : null, h(SJInput)),
      );
    let r!: ReactTestRenderer;
    act(() => {
      r = create(tree(true), { createNodeMock: () => ({ form: new EventTarget() }) });
    });
    renderers.push(r);
    expect(control(r).props['aria-describedby']).toBe('f-hint');
    act(() => r.update(tree(false)));
    expect(control(r).props['aria-describedby']).toBeUndefined();
  });
  it('classes per part concatenate after the library class', () => {
    const r = mount(
      harness(),
      field({
        hint: 'h',
        error: 'e',
        classes: { root: 'r', label: 'l', hint: 'i', error: 'x', icon: 'c' },
      }),
    );
    expect(r.root.findByProps({ 'data-part': 'root' }).props.className).toBe('sj-field__root r');
    expect(r.root.findByType('label').props.className).toBe('sj-field__label l');
    expect(r.root.findByProps({ 'data-part': 'hint' }).props.className).toBe('sj-field__hint i');
    expect(r.root.findByProps({ 'data-part': 'error' }).props.className).toBe('sj-field__error x');
    expect(r.root.findByProps({ 'data-part': 'icon' }).props.className).toBe('sj-field__icon c');
  });
});

describe('announcement (ADR-006, ADR-014)', () => {
  it('a standing error at mount is silent', () => {
    const hs = harness();
    mount(hs, field({ error: 'Enter a valid email' }));
    flush(hs);
    expect(hs.spoken).toEqual([]);
  });
  it('a new error is announced once; rerenders with the same text are silent', () => {
    const hs = harness();
    const r = mount(hs, field());
    act(() => r.update(provide(hs, field({ error: 'Enter a valid email' }))));
    flush(hs);
    expect(hs.spoken).toEqual(['Enter a valid email']);
    act(() => r.update(provide(hs, field({ error: 'Enter a valid email', hint: 'h' }))));
    flush(hs);
    expect(hs.spoken).toEqual(['Enter a valid email']);
  });
  it('a changed text announces; clearing then repeating announces again', () => {
    const hs = harness();
    const r = mount(hs, field());
    const set = (error?: string) => {
      act(() => r.update(provide(hs, field(error === undefined ? {} : { error }))));
      flush(hs);
      act(() => void hs.scheduler.advance(2000));
    };
    set('One');
    set('Two');
    set();
    set('Two');
    expect(hs.spoken).toEqual(['One', 'Two', 'Two']);
  });
  it('StrictMode: still once, still silent at mount', () => {
    const hs = harness();
    const r = mount(hs, h(StrictMode, null, field({ error: 'Standing' })));
    flush(hs);
    expect(hs.spoken).toEqual([]);
    act(() => r.update(provide(hs, h(StrictMode, null, field({ error: 'New one' })))));
    flush(hs);
    expect(hs.spoken).toEqual(['New one']);
  });
  it('the live region is requested at mount (eager, from the contract)', () => {
    const hs = harness();
    mount(hs, field());
    expect(hs.ensured.n).toBeGreaterThan(0);
  });
  it('outside a provider an error renders and nothing throws or speaks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let r!: ReactTestRenderer;
    act(() => {
      r = create(field({ error: 'bad' }));
    });
    renderers.push(r);
    expect(control(r).props['aria-invalid']).toBe('true');
    warn.mockRestore();
  });
});

describe('SSR', () => {
  it('renders ids, aria and the visible error; emits no live-region markup', () => {
    const html = renderToString(
      h(
        SJProvider,
        null,
        field({ hint: 'Never shared', error: 'Enter a valid email', name: 'email' }),
      ),
    );
    expect(html).toContain('for="f"');
    expect(html).toContain('aria-describedby="f-hint f-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Enter a valid email');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('data-sj-live');
    expect(html).not.toContain('maxlength');
  });
  it('is deterministic for the same tree', () => {
    const a = renderToStaticMarkup(h(SJProvider, null, field({ error: 'x' })));
    const b = renderToStaticMarkup(h(SJProvider, null, field({ error: 'x' })));
    expect(a).toBe(b);
  });
});

describe('lifecycle (1,000 mount/destroy retain nothing)', () => {
  function Probe({ out }: { out: { owner?: FormOwner } }) {
    out.owner = useContext(SJFormContext)!.owner;
    return null;
  }
  for (const strict of [false, true]) {
    it(`leaves no registration or subscription behind${strict ? ' (StrictMode)' : ''}`, () => {
      const hs = harness();
      const out: { owner?: FormOwner } = {};
      const wrap = (kids: ReactNode) => (strict ? h(StrictMode, null, kids) : kids);
      const tree = (n: number) =>
        wrap(
          h(
            SJForm,
            null,
            h(Probe, { out }),
            n >= 0
              ? h(
                  SJField.Root,
                  { key: n, name: `n${n}`, label: 'L', error: n % 2 ? 'e' : '' },
                  h(SJInput, { kind: 'email' }),
                )
              : null,
          ),
        );
      const r = mount(hs, tree(0));
      const owner = out.owner!;
      let live = 0;
      const subscribe = owner.store.subscribe;
      owner.store.subscribe = (l) => {
        live++;
        const off = subscribe(l);
        return () => {
          live--;
          off();
        };
      };
      for (let i = 1; i <= 1000; i++) act(() => r.update(provide(hs, tree(i))));
      act(() => r.update(provide(hs, wrap(h(SJForm, null, h(Probe, { out }))))));
      expect(owner.store.getSnapshot().fields).toEqual([]);
      expect(live).toBe(0);
      expect(hs.created.length).toBeLessThanOrEqual(2);
    }, 60_000);
  }
});
