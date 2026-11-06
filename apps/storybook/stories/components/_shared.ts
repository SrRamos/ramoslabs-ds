// Shared helpers for the component stories. Layout CSS is tokens only (see layout.css).
import './layout.css';
import { computed, defineComponent, h, onMounted, onBeforeUnmount, ref } from 'vue';
import type { IconData } from '@ramoslabs/core/icon';

export { SJProvider } from '@ramoslabs/vue/runtime';
export { SJIcon } from '@ramoslabs/vue/icon';

/** A short docs description for one story: what to try by hand. */
export const tryIt = (text: string) => ({ docs: { description: { story: text.trim() } } });

/** Component-level docs description. */
export const about = (text: string) => ({ docs: { description: { component: text.trim() } } });

// Small inline Lucide-style glyph data (ISC), so the stories need no icon package.
export const iconPlus: IconData = {
  name: 'plus',
  nodes: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'M12 5v14' }],
  ],
};
export const iconSearch: IconData = {
  name: 'search',
  nodes: [
    ['path', { d: 'm21 21-4.34-4.34' }],
    ['circle', { cx: '11', cy: '11', r: '8' }],
  ],
};
export const iconFolder: IconData = {
  name: 'folder',
  nodes: [
    [
      'path',
      {
        d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
      },
    ],
  ],
};
export const iconAlert: IconData = {
  name: 'circle-alert',
  nodes: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['line', { x1: '12', x2: '12', y1: '8', y2: '12' }],
    ['line', { x1: '12', x2: '12.01', y1: '16', y2: '16' }],
  ],
};

/**
 * Prints the live ADR-007 attributes of every control inside the nearest `[data-readout-scope]`,
 * refreshed on focus and input, so a reviewer can see enterkeyhint / inputmode / autocomplete.
 */
export const ControlReadout = defineComponent({
  name: 'ControlReadout',
  setup() {
    const text = ref('');
    const root = ref<HTMLElement | null>(null);
    let scope: HTMLElement | null = null;
    const read = () => {
      if (!scope) return;
      text.value = [...scope.querySelectorAll<HTMLElement>('input, textarea')]
        .map((c) => {
          const a = (n: string) => c.getAttribute(n) ?? '-';
          const kind = c.tagName === 'TEXTAREA' ? 'textarea' : `type=${a('type')}`;
          return `${(c as HTMLInputElement).name || c.id}: ${kind} inputmode=${a('inputmode')} enterkeyhint=${a('enterkeyhint')} autocomplete=${a('autocomplete')}`;
        })
        .join('\n');
    };
    onMounted(() => {
      scope = root.value?.closest<HTMLElement>('[data-readout-scope]') ?? null;
      read();
      scope?.addEventListener('focusin', read);
      scope?.addEventListener('input', read);
    });
    onBeforeUnmount(() => {
      scope?.removeEventListener('focusin', read);
      scope?.removeEventListener('input', read);
    });
    return () => h('pre', { ref: root, class: 'sbx-readout', 'aria-hidden': 'true' }, text.value);
  },
});

/** Playground render: every arg but `text` goes to the component as props; `text` is the default slot. Stays reactive to controls. */
export const textRender = (component: unknown) => (args: Record<string, unknown>) => ({
  components: { Cmp: component as never },
  setup: () => ({
    rest: computed(() => {
      const { text: _t, ...rest } = args;
      return rest;
    }),
    args,
  }),
  template: `<Cmp v-bind="rest">{{ args.text }}</Cmp>`,
});
