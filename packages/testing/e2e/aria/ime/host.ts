// Test-only editable host for the IME composition fixture (W1-309c). The runner's probe has no text
// input, so this is the smallest editable that exercises core's typeahead/IME module (W1-107): a
// text input over a listbox, `beforeinput` feeding `createTypeahead`, composition events wired to
// its session flag, and the active option exposed by `aria-activedescendant`.
//
// `?guard=off` seeds the regression the test must catch: composition events are not wired and every
// beforeinput is presented to typeahead as plain `insertText`, i.e. the IME guard is bypassed.
import { createTypeahead } from '@ramoslabs/core/typeahead';
import { platformScheduler } from '@ramoslabs/core/runtime';
import type { CollectionItem } from '@ramoslabs/core/collection';

const ITEMS: CollectionItem[] = [
  { key: 'apple', text: 'Apple' },
  { key: 'apricot', text: 'Apricot' },
  { key: 'banana', text: 'Banana' },
  { key: 'aoi', text: 'あおい' },
  { key: 'sora', text: '空' },
];

export interface ImeState {
  /** Active option key, or null. */
  active: string | null;
  /** Typeahead buffer. */
  buffer: string;
  /** Typeahead's own composing flag. */
  composing: boolean;
  /** Event log: `<type>|<inputType>|isComposing=<bool>|<data>`. */
  log: string[];
  value: string;
}

declare global {
  interface Window {
    __ime: { state(): ImeState; ready: true };
  }
}

const guardOff = new URLSearchParams(location.search).get('guard') === 'off';
const input = document.getElementById('field') as HTMLInputElement;
const list = document.getElementById('list') as HTMLElement;
const typeahead = createTypeahead({ scheduler: platformScheduler, timeout: 5000 });
const log: string[] = [];
let active = -1;

for (const [i, it] of ITEMS.entries()) {
  const li = list.appendChild(document.createElement('li'));
  li.id = `opt-${i}`;
  li.setAttribute('role', 'option');
  li.textContent = it.text ?? it.key;
}

function setActive(i: number): void {
  active = i;
  list.querySelectorAll('[role="option"]').forEach((o, n) => {
    o.toggleAttribute('data-active', n === i);
    o.setAttribute('aria-selected', String(n === i));
  });
  input.setAttribute('aria-activedescendant', `opt-${i}`);
}

const note = (e: Event, data?: string | null): void => {
  const ie = e as InputEvent;
  log.push(`${e.type}|${ie.inputType ?? ''}|isComposing=${ie.isComposing ?? false}|${data ?? ''}`);
};

input.addEventListener('compositionstart', (e) => {
  note(e);
  if (!guardOff) typeahead.compositionstart();
});
input.addEventListener('compositionupdate', (e) => note(e, (e as CompositionEvent).data));
input.addEventListener('compositionend', (e) => {
  note(e, (e as CompositionEvent).data);
  if (!guardOff) typeahead.compositionend();
});
input.addEventListener('keydown', (e) => {
  log.push(`keydown|${e.key}|keyCode=${e.keyCode}|isComposing=${e.isComposing}`);
});
input.addEventListener('beforeinput', (e) => {
  note(e, e.data);
  const ev = guardOff
    ? { inputType: 'insertText', data: e.data, isComposing: false }
    : { inputType: e.inputType, data: e.data, isComposing: e.isComposing };
  const hit = typeahead.beforeinput(ev, ITEMS, active);
  if (hit !== undefined) setActive(hit);
});
input.addEventListener('input', (e) => note(e, (e as InputEvent).data));

window.__ime = {
  ready: true,
  state: () => ({
    active: active < 0 ? null : ITEMS[active]!.key,
    buffer: typeahead.buffer,
    composing: typeahead.composing,
    log: log.slice(),
    value: input.value,
  }),
};
