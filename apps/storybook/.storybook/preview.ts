import type { Preview } from '@storybook/vue3-vite';

// Load the generated token variables so every story renders with the
// RamosLabs design tokens available as CSS custom properties.
import '@ramoslabs/tokens/css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
