import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    server: {
      deps: {
        inline: ['electron']
      }
    },
    exclude: ['e2e/**', 'node_modules/**', 'dist/**']
  },
  alias: {
    '@': path.resolve(__dirname, './renderer/src'),
  },
});
