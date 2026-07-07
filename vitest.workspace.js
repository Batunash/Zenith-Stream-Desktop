import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'main',
      environment: 'node',
      include: ['main/**/*.test.js', 'main/**/*.test.jsx', 'backend/**/*.test.js'],
      globals: true,
      setupFiles: ['./main/setupMainTests.js'],
    },
  },
  {
    test: {
      name: 'renderer',
      environment: 'jsdom',
      include: ['renderer/**/*.test.js', 'renderer/**/*.test.jsx'],
      globals: true,
      setupFiles: ['./renderer/setupTests.js'],
    },
  },
]);
