import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

/**
 * `npm test` — unit and component tests in jsdom.
 *
 * Reuses vite.config.js so the `@/` alias and the React plugin are the same ones
 * the app is built with. Tests sit beside the file they test as `*.test.js(x)`.
 */
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['src/test/setup.js'],
    css: false,
    restoreMocks: true,
  },
}));
