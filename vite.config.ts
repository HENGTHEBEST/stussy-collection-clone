import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  root: 'front-end',
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: {
    root: '.',
    exclude: [...configDefaults.exclude, '.worktrees/**'],
    environment: 'jsdom',
    setupFiles: './front-end/src/test/setup.ts',
    css: true,
    globals: true,
  },
});
