import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent } from 'vue';

const Swatches = defineComponent({
  name: 'ColorSwatches',
  props: {
    heading: { type: String, required: true },
    names: { type: Array as () => string[], required: true },
  },
  methods: {
    resolve(name: string): string {
      if (typeof window === 'undefined') return '';
      return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
    },
  },
  template: `
    <section style="font-family: system-ui, sans-serif;">
      <h2 style="font-size: 1.25rem; margin: 0 0 1rem;">{{ heading }}</h2>
      <ul style="list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
        <li v-for="name in names" :key="name" style="border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden;">
          <div :style="{ background: 'var(--' + name + ')', height: '72px' }"></div>
          <div style="padding: 0.5rem 0.625rem;">
            <code style="font-size: 0.75rem; display: block;">--{{ name }}</code>
            <span style="font-size: 0.75rem; color: #64748b;">{{ resolve(name) }}</span>
          </div>
        </li>
      </ul>
    </section>
  `,
});

const meta: Meta = {
  title: 'Foundations/Colors',
};

export default meta;
type Story = StoryObj;

const semantic = [
  'color-primary',
  'color-primary-light',
  'color-primary-dark',
  'color-primary-surface',
  'color-secondary',
  'color-success',
  'color-warning',
  'color-error',
  'color-error-strong',
  'color-info',
  'color-text-heading',
  'color-text-body',
  'color-surface',
  'color-surface-secondary',
  'color-border',
  'color-focus',
];

const indigo = [
  'color-indigo-50',
  'color-indigo-100',
  'color-indigo-200',
  'color-indigo-300',
  'color-indigo-400',
  'color-indigo-500',
  'color-indigo-600',
  'color-indigo-700',
  'color-indigo-800',
  'color-indigo-900',
  'color-indigo-950',
];

export const Semantic: Story = {
  render: () => ({
    components: { Swatches },
    setup: () => ({ names: semantic }),
    template: '<Swatches heading="Semantic (mono-indigo brand, no coral)" :names="names" />',
  }),
};

export const IndigoScale: Story = {
  render: () => ({
    components: { Swatches },
    setup: () => ({ names: indigo }),
    template: '<Swatches heading="Indigo primitive scale" :names="names" />',
  }),
};
