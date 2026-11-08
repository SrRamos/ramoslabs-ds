// Shared pieces of the pattern demos (cards, multi-step flow, bottom navigation, overflow button).
// Spanish UI copy. Layout is tokens only (demos.css) and uses logical properties, so dir="rtl" mirrors it.
import './demos.css';
import { defineComponent, h } from 'vue';
import type { PropType } from 'vue';

export { SJIcon, tryIt, about } from '../../components/_shared';

/** Inline 24-grid glyph. `filled` fills the shape (the active-tab state); the stroke always stays. */
export const PatIcon = defineComponent({
  name: 'PatIcon',
  props: {
    name: { type: String as PropType<keyof typeof PATHS>, required: true },
    filled: { type: Boolean, default: false },
    class: { type: String, default: '' },
  },
  setup(props) {
    return () =>
      h(
        'svg',
        {
          class: props.class,
          viewBox: '0 0 24 24',
          fill: props.filled || props.name === 'dots' ? 'currentColor' : 'none',
          stroke: 'currentColor',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        PATHS[props.name].map((d) => h('path', { d })),
      );
  },
});

const PATHS = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  bolt: ['M13 2 3 14h9l-1 8 10-12h-9z'],
  pin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z', 'M12 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
  user: ['M12 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M4 21a8 8 0 0 1 16 0z'],
  plus: ['M5 12h14', 'M12 5v14'],
  dots: [
    'M12 12m-1.75 0a1.75 1.75 0 1 0 3.5 0a1.75 1.75 0 1 0-3.5 0',
    'M5 12m-1.75 0a1.75 1.75 0 1 0 3.5 0a1.75 1.75 0 1 0-3.5 0',
    'M19 12m-1.75 0a1.75 1.75 0 1 0 3.5 0a1.75 1.75 0 1 0-3.5 0',
  ],
} as const;

/** The "qué probar" note shown on the canvas of every demo. */
export const TryNote = defineComponent({
  name: 'TryNote',
  setup(_p, { slots }) {
    return () =>
      h('p', { class: 'pat-try' }, [h('strong', 'Qué probar. '), slots['default']?.()]);
  },
});

/** A labelled column of a side-by-side comparison: the verdict (text plus a mark, never colour alone), then the demo. */
export const Verdict = defineComponent({
  name: 'Verdict',
  props: { ok: { type: Boolean, default: true }, why: { type: String, default: '' } },
  setup(p, { slots }) {
    return () =>
      h('div', { class: 'pat-verdict' }, [
        h(
          'p',
          { class: ['pat-verdict__tag', p.ok ? 'pat-verdict__tag--ok' : 'pat-verdict__tag--no'] },
          p.ok ? '✓ Recomendado' : '✕ Evitar',
        ),
        slots['default']?.(),
        h('p', { class: 'pat-verdict__why' }, p.why),
      ]);
  },
});

/** Digits only. */
export const digitsOf = (s: string): string => s.replace(/\D+/g, '');

/** Display grouping `0123 4567 8901`: groups of four, display only (the submitted value stays raw digits). */
export const groupDigits = (digits: string, size = 4): string =>
  digits.replace(new RegExp(`(\\d{${size}})(?=\\d)`, 'g'), '$1 ');

/** Thousands grouping for COP, `1.250.000` (es-CO), display only. */
export const groupAmount = (digits: string): string =>
  digits ? new Intl.NumberFormat('es-CO').format(Number(digits)) : '';
