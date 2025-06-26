import { type UserConfig, defineConfig } from 'vite';

export default defineConfig ({
  build: {
    rollupOptions: {
      input: {
        vivocha_widget_tester: './app/index.ts'
      },
      output: {
        entryFileNames: '[name].js',
        dir: './app/'
      }
    },
    emptyOutDir: false
  }
}) satisfies UserConfig;
