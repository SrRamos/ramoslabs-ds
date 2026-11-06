import type { Preview } from '@storybook/vue3-vite';

// Load the generated token variables so every story renders with the
// RamosLabs design tokens available as CSS custom properties.
import '@ramoslabs/tokens/css';
// Real component CSS (layered, ADR-009), so stories render styled, not raw.
import '@ramoslabs/css';

// Wraps every docs page with the global RamosLabs footer.
import { DocsContainer } from './DocsContainer';

const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        order: [
          'Introduction',
          'Foundations',
          [
            'Colors',
            'Typography',
            'Spacing',
            'Border Radius',
            'Shadows',
            'Motion',
            'Responsive',
            'Helpers',
            'Token Reference',
            'Color Picker',
          ],
          'Patterns',
          ['Interactive', 'Accessibility', 'Persuasion', 'Form Elements', 'Data Tables', 'Modals', 'Mobile First', 'AI Content', 'Voice & Tone'],
          'Components',
          ['Review Guide'],
        ],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
    docs: {
      toc: true,
      container: DocsContainer,
    },
  },
  // Theme toolbar: components switch to their dark rules under any
  // [data-theme='dark'] ancestor, so the decorator sets it on <html>.
  globalTypes: {
    theme: {
      description: 'Colour theme for component stories',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  decorators: [
    (story, context) => {
      const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
      const background = theme === 'dark' ? 'var(--color-background-dark)' : 'var(--color-background)';
      document.documentElement.setAttribute('data-theme', theme);
      document.body.style.backgroundColor = background;

      return {
        components: { story },
        template: `
          <div class="sb-main-wrapper" style="background-color: ${background}; font-family: var(--font-family-sans); min-height: 100vh; padding: 1rem;">
            <story />
          </div>
        `,
      };
    },
  ],
};

export default preview;
