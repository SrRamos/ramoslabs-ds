import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'runtime/index': resolve(__dirname, 'src/runtime/index.ts'),
        'button/index': resolve(__dirname, 'src/button/index.ts'),
        'field/index': resolve(__dirname, 'src/field/index.ts'),
        'input/index': resolve(__dirname, 'src/input/index.ts'),
        'switch/index': resolve(__dirname, 'src/switch/index.ts'),
        'checkbox/index': resolve(__dirname, 'src/checkbox/index.ts'),
        'radio-group/index': resolve(__dirname, 'src/radio-group/index.ts'),
        'tabs/index': resolve(__dirname, 'src/tabs/index.ts'),
        'disclosure/index': resolve(__dirname, 'src/disclosure/index.ts'),
        'dialog/index': resolve(__dirname, 'src/dialog/index.ts'),
        'popover/index': resolve(__dirname, 'src/popover/index.ts'),
        'tooltip/index': resolve(__dirname, 'src/tooltip/index.ts'),
        'select/index': resolve(__dirname, 'src/select/index.ts'),
        'state/index': resolve(__dirname, 'src/state/index.ts'),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      external: ['vue', '@ramoslabs/tokens', '@ramoslabs/tokens/css', /^@ramoslabs\/core(\/.*)?$/],
    },
  },
});
