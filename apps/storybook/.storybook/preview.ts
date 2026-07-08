import type { Preview } from '@storybook/vue3-vite';

// Load the generated token variables so every story renders with the
// RamosLabs design tokens available as CSS custom properties.
import '@ramoslabs/tokens/css';

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
          ['Interactive', 'Accessibility', 'Persuasion', 'Form Elements', 'Data Tables', 'AI Content', 'Voice & Tone'],
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
    },
  },
  decorators: [
    (story) => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.style.backgroundColor = '#f8fafc';

      return {
        components: { story },
        template: `
          <div class="sb-main-wrapper" style="background-color: #f8fafc; min-height: 100vh; padding: 1rem;">
            <story />
          </div>
        `,
      };
    },
  ],
};

export default preview;
