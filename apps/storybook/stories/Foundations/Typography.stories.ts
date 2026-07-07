import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent } from 'vue';

const Families = defineComponent({
  name: 'TypographyFamilies',
  template: `
    <section style="font-family: system-ui, sans-serif;">
      <h2 style="font-size: 1.25rem; margin: 0 0 1rem;">Font families</h2>
      <p style="font-family: var(--font-family-display); font-size: 2rem; margin: 0 0 0.25rem;">Red Hat Display, headings</p>
      <p style="font-family: var(--font-family-sans); font-size: 1.125rem; margin: 0 0 0.25rem;">Rubik, body and UI text</p>
      <p style="font-family: var(--font-family-alt); font-size: 1.125rem; margin: 0;">Roboto, fallback family</p>
    </section>
  `,
});

const Scale = defineComponent({
  name: 'TypographyScale',
  data() {
    return {
      sizes: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'],
    };
  },
  methods: {
    resolve(size: string): string {
      if (typeof window === 'undefined') return '';
      return getComputedStyle(document.documentElement).getPropertyValue(`--font-size-${size}`).trim();
    },
  },
  template: `
    <section style="font-family: var(--font-family-sans), system-ui, sans-serif;">
      <h2 style="font-size: 1.25rem; margin: 0 0 1rem;">Size scale</h2>
      <ul style="list-style: none; margin: 0; padding: 0;">
        <li v-for="size in sizes" :key="size" style="display: flex; align-items: baseline; gap: 1rem; padding: 0.375rem 0; border-bottom: 1px solid #f1f5f9;">
          <code style="width: 9rem; flex: none; font-size: 0.75rem; color: #64748b;">--font-size-{{ size }} · {{ resolve(size) }}</code>
          <span :style="{ fontSize: 'var(--font-size-' + size + ')' }">Konvoka events</span>
        </li>
      </ul>
    </section>
  `,
});

const meta: Meta = {
  title: 'Foundations/Typography',
};

export default meta;
type Story = StoryObj;

export const Families_: Story = {
  name: 'Families',
  render: () => ({
    components: { Families },
    template: '<Families />',
  }),
};

export const Scale_: Story = {
  name: 'Scale',
  render: () => ({
    components: { Scale },
    template: '<Scale />',
  }),
};
