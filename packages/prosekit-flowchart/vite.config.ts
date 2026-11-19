/**
 * The flowchart's browser suite and `svelte-package` build. Its stories are
 * rendered by packages/prosekit-svelte's Storybook, so there are no Storybook
 * tasks here.
 */

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from 'vite-plus/test/browser-playwright';
import { defineConfig } from 'vite-plus';

const chromium = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'];

/**
 * Cache inputs: everything a task reads except `node_modules`, plus the
 * lockfile. `'!.'` drops the package root's directory listing, so a generated
 * directory (`coverage/`, `storybook-static/`) appearing there doesn't bust
 * the cache; the sibling `node_modules/` holds only workspace symlinks and
 * generated scratch.
 */
const cacheInputs = [
  { auto: true },
  '!.',
  '!node_modules/**',
  { pattern: '!node_modules/**', base: 'workspace' as const },
  { pattern: '!packages/*/node_modules/**', base: 'workspace' as const },
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
        command: 'svelte-package --tsconfig ./tsconfig.dist.json',
        dependsOn: ['sync', { task: 'build', from: 'dependencies' }],
        cache: {
          input: cacheInputs,
          output: ['dist/**'],
        },
      },
      // Type-checks `src/` (stories included) and `tests/`.
      check: {
        command: 'svelte-check --tsconfig ./tsconfig.dist.json',
        dependsOn: [
          { task: 'check', from: 'dependencies' },
          { task: 'build', from: 'dependencies' },
          'sync',
        ],
        cache: {
          input: cacheInputs,
          output: [],
        },
      },
      'test:unit': {
        command: 'vp test run tests',
        dependsOn: ['sync', { task: 'build', from: 'dependencies' }],
        cache: {
          env: [
            'VITEST_MAX_WORKERS',
            'NODE_OPTIONS',
            'PLAYWRIGHT_BROWSERS_PATH',
            'PLAYWRIGHT_CHROMIUM_EXECUTABLE',
          ],
          input: cacheInputs,
          output: [],
        },
      },
    },
  },

  plugins: [svelte()],

  // Pre-bundle every dependency the suite reaches: one discovered mid-run
  // reloads the page and fails every test in flight.
  optimizeDeps: {
    include: [
      '@testing-library/jest-dom/vitest',
      '@xyflow/svelte',
      'bits-ui',
      'effect/Array',
      'effect/Effect',
      'effect/HashSet',
      'effect/Option',
      'effect/Predicate',
      'effect/Record',
      'effect/Result',
      'effect/Schema',
      'effect/String',
      'effect',
      'prosekit/core',
      'prosekit/extensions/doc',
      'prosekit/extensions/paragraph',
      'prosekit/extensions/text',
      'prosekit/svelte',
      'svelte',
      'vite-plus/test/browser',
      'vitest-browser-svelte',
    ],
    // Only the server branch of the HTML renderer imports it.
    exclude: ['linkedom'],
  },

  test: {
    include: ['tests/**/*.test.ts'],
    // Registers the jest-dom matchers.
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    // A real browser: xyflow needs layout, and focus and the accessibility
    // tree are the contract.
    browser: {
      enabled: true,
      headless: true,
      // `PLAYWRIGHT_CHROMIUM_EXECUTABLE` points at a preinstalled Chromium
      // (an agent session's /opt/pw-browsers/chromium); unset, Playwright
      // uses its own download.
      provider: playwright({
        launchOptions: chromium === undefined ? {} : { executablePath: chromium },
      }),
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
  },
});
