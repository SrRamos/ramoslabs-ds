import type { Meta, StoryObj } from '@storybook/vue3-vite';
import TokenPicker from './TokenPicker.vue';

const meta: Meta<typeof TokenPicker> = {
  title: 'Foundations/Color Picker',
  component: TokenPicker,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
An interactive color picker that displays design tokens with WCAG contrast ratio checking.

## Features
- **Click to select** any color swatch
- **Automatic contrast calculation** against white and black text
- **WCAG compliance badges** (AAA, AA, AA Large, Fail)
- **One-click copy** of CSS variable syntax

## Usage
\`\`\`vue
<TokenPicker
  title="Brand Colors"
  :colors="[
    { name: 'Primary', token: '--color-primary', value: '#4f46e5' },
    { name: 'Secondary', token: '--color-secondary', value: '#8B5CF6' },
  ]"
/>
\`\`\`
        `,
      },
    },
  },
  // Disable autodocs to prevent duplication
  tags: [],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Primary story shown in docs
export const Default: Story = {
  name: 'All Colors',
  args: {
    title: 'Complete Palette',
    colors: [
      // Brand
      { name: 'Primary', token: '--color-primary', value: '#4f46e5' },
      { name: 'Primary Light', token: '--color-primary-light', value: '#6366f1' },
      { name: 'Primary Dark', token: '--color-primary-dark', value: '#4338ca' },
      { name: 'Secondary', token: '--color-secondary', value: '#8B5CF6' },
      // Text
      { name: 'Heading', token: '--color-text-heading', value: '#0f172a' },
      { name: 'Body', token: '--color-text-body', value: '#64748b' },
      { name: 'Muted', token: '--color-text-muted', value: '#64748b' },
      // Surface
      { name: 'Surface', token: '--color-surface', value: '#ffffff' },
      { name: 'Background', token: '--color-background', value: '#f8fafc' },
      { name: 'Border', token: '--color-border', value: '#e6e8eb' },
      // Semantic
      { name: 'Success', token: '--color-success', value: '#10b981' },
      { name: 'Warning', token: '--color-warning', value: '#f59e0b' },
      { name: 'Error', token: '--color-error', value: '#ef4444' },
      { name: 'Info', token: '--color-info', value: '#3b82f6' },
    ],
  },
};

export const BrandColors: Story = {
  args: {
    title: 'Brand Colors',
    colors: [
      { name: 'Primary', token: '--color-primary', value: '#4f46e5', description: 'Main brand color' },
      { name: 'Primary Light', token: '--color-primary-light', value: '#6366f1', description: 'Hover states' },
      { name: 'Primary Dark', token: '--color-primary-dark', value: '#4338ca', description: 'Pressed states' },
      { name: 'Secondary', token: '--color-secondary', value: '#8B5CF6', description: 'Gradients, accents' },
    ],
  },
};

export const TextColors: Story = {
  args: {
    title: 'Text Colors',
    colors: [
      { name: 'Heading', token: '--color-text-heading', value: '#0f172a', description: 'Headlines' },
      { name: 'Body', token: '--color-text-body', value: '#64748b', description: 'Paragraphs' },
      { name: 'Muted', token: '--color-text-muted', value: '#64748b', description: 'Labels, hints' },
      { name: 'Disabled', token: '--color-text-disabled', value: '#cbd5e1', description: 'Disabled text' },
    ],
  },
};

export const SemanticColors: Story = {
  args: {
    title: 'Semantic Colors',
    colors: [
      { name: 'Success', token: '--color-success', value: '#10b981', description: 'Confirmations' },
      { name: 'Success Surface', token: '--color-success-surface', value: '#f0fdf4', description: 'Success bg' },
      { name: 'Warning', token: '--color-warning', value: '#f59e0b', description: 'Cautions' },
      { name: 'Warning Surface', token: '--color-warning-surface', value: '#fffbeb', description: 'Warning bg' },
      { name: 'Error', token: '--color-error', value: '#ef4444', description: 'Errors' },
      { name: 'Error Surface', token: '--color-error-surface', value: '#fef2f2', description: 'Error bg' },
      { name: 'Info', token: '--color-info', value: '#3b82f6', description: 'Information' },
      { name: 'Info Surface', token: '--color-info-surface', value: '#eff6ff', description: 'Info bg' },
    ],
  },
};

export const SurfaceColors: Story = {
  args: {
    title: 'Surface Colors',
    colors: [
      { name: 'Surface', token: '--color-surface', value: '#ffffff', description: 'Cards, modals' },
      { name: 'Background', token: '--color-background', value: '#f8fafc', description: 'Page background' },
      { name: 'Border', token: '--color-border', value: '#e6e8eb', description: 'Dividers, borders' },
    ],
  },
};
