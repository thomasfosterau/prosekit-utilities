/**
 * Vite config for `@thomasfosterau/prosekit-flowchart`: the browser unit
 * suite (the Svelte compiler + a real Chromium under Vitest browser mode) and
 * the `svelte-package` build that produces `dist/`.
 *
 * Modelled on packages/prosekit-svelte/vite.config.ts — same task names, same
 * cache fingerprint — with two differences that follow from this being a
 * downstream package:
 *
 * - `check`, `build` and `test:unit` take `{ task: 'build', from:
 *   'dependencies' }`. This package imports both siblings through their
 *   `exports`, which point at their BUILT `dist/`, so nothing here resolves
 *   until those builds have run.
 * - There are no Storybook tasks. This package's stories are rendered by the
 *   ONE Storybook in packages/prosekit-svelte, whose `stories` glob reaches
 *   across into `../../prosekit-flowchart/src/stories`.
 */

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite-plus';

/**
 * Input fingerprint for this package's cached tasks: everything the task can
 * read, minus `node_modules`, plus the lockfile — so a dependency bump busts
 * the cache and a `touch` does not.
 */
const cacheInputs = [
  { auto: true },
  '!node_modules/**',
  { pattern: '!node_modules/**', base: 'workspace' as const },
  { pattern: 'pnpm-lock.yaml', base: 'workspace' as const },
];

export default defineConfig({
  run: {
    tasks: {
      // `svelte-kit sync` generates this package's ambient types. Both
      // `svelte-package` and `svelte-check` need it to have run.
      sync: { command: 'svelte-kit sync', cache: false },
      // The published artifact.
      build: {
        command: 'svelte-package',
        dependsOn: ['sync', { task: 'build', from: 'dependencies' }],
        output: ['dist/**'],
      },
      // Type-checks `src/` (stories included) and `tests/`.
      check: {
        command: 'svelte-check --tsconfig ./tsconfig.json',
        dependsOn: [
          { task: 'check', from: 'dependencies' },
          { task: 'build', from: 'dependencies' },
          'sync',
        ],
        input: cacheInputs,
        output: [],
      },
      // Browser mode, so `test:unit` never needs `PLAYWRIGHT_BROWSERS_PATH`
      // spelled out here: Playwright reads it from the environment.
      'test:unit': {
        command: 'vp test run tests',
        dependsOn: ['sync', { task: 'build', from: 'dependencies' }],
        env: ['VITEST_MAX_WORKERS', 'NODE_OPTIONS', 'PLAYWRIGHT_BROWSERS_PATH'],
        input: cacheInputs,
        output: [],
      },
    },
  },

  plugins: [svelte()],

  // Every runtime dependency the browser suite reaches, pre-bundled BEFORE the
  // first test file loads — left to discovery, Vite optimises them on first
  // import and reloads the page, failing every test in flight at that moment.
  // `@xyflow/svelte` is on the list because the canvas is the heaviest module
  // here and exactly the late discovery that triggers the reload.
  optimizeDeps: {
    include: [
      '@testing-library/jest-dom/vitest',
      '@xyflow/svelte',
      'bits-ui',
      'effect',
      'prosekit/core',
      'prosekit/svelte',
      'svelte',
      'vitest-browser-svelte',
    ],
  },

  test: {
    include: ['tests/**/*.test.ts'],
    // Registers the jest-dom matchers.
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    // A REAL browser, not a DOM shim — the same reason as the editor
    // package's suite: xyflow needs real layout, and focus order, keyboard
    // handling and the accessibility tree are the contract.
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
  },
});
