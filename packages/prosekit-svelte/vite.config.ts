/**
 * Vite config for `@thomasfosterau/prosekit-svelte`: the component unit suite
 * (the Svelte compiler + a real Chromium under Vitest browser mode), the
 * `svelte-package` build that produces `dist/`, and the Storybook tasks.
 */

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
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
  '!storybook-static/**',
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
      build: {
        command: 'svelte-package --tsconfig ./tsconfig.dist.json',
        dependsOn: ['sync', { task: 'build', from: 'dependencies' }],
        cache: {
          input: cacheInputs,
          output: ['dist/**'],
        },
      },
      // Covers `src/` (stories included), `tests/` and `.storybook/`.
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
      // The workspace's one Storybook; its `stories` glob also reaches into
      // packages/prosekit-flowchart.
      storybook: {
        command: 'storybook dev -p 6006 --no-open',
        dependsOn: ['sync', 'build'],
        cache: false,
      },
      'storybook:build': {
        command: 'storybook build',
        dependsOn: ['sync', 'build'],
        cache: {
          input: cacheInputs,
          output: ['storybook-static/**'],
        },
      },
    },
  },

  // `tailwindcss()` serves Storybook's preview only.
  plugins: [svelte(), tailwindcss()],

  // Pre-bundle every dependency the suite reaches: one discovered mid-run
  // reloads the page and fails every test in flight ("Failed to fetch
  // dynamically imported module").
  optimizeDeps: {
    include: [
      '@testing-library/jest-dom/vitest',
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
      'prosekit/core',
      'prosekit/svelte',
      'prosekit/extensions/doc',
      'prosekit/extensions/text',
      'prosekit/extensions/paragraph',
      'prosekit/extensions/heading',
      'prosekit/extensions/list',
      'prosekit/extensions/blockquote',
      'prosekit/extensions/image',
      'prosekit/extensions/horizontal-rule',
      'prosekit/extensions/hard-break',
      'prosekit/extensions/table',
      'prosekit/extensions/code-block',
      'prosekit/extensions/bold',
      'prosekit/extensions/italic',
      'prosekit/extensions/underline',
      'prosekit/extensions/strike',
      'prosekit/extensions/code',
      'prosekit/extensions/link',
      'prosekit/extensions/gap-cursor',
      'prosekit/extensions/virtual-selection',
      'prosekit/extensions/mod-click-prevention',
      'svelte',
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
    // A real browser: ProseMirror needs layout and selection, and focus and
    // the accessibility tree are the contract.
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
