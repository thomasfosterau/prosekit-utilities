/**
 * Vite config for `@thomasfosterau/prosekit-svelte`: the component unit suite
 * (the Svelte compiler + a real Chromium under Vitest browser mode), the
 * `svelte-package` build that produces `dist/`, and the Storybook tasks.
 */

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from 'vite-plus/test/browser-playwright';
import { defineConfig } from 'vite-plus';

/**
 * Input fingerprint for this package's cached tasks: everything the task can
 * read, minus `node_modules`, plus the lockfile — so a dependency bump busts
 * the cache and a `touch` does not.
 *
 * `'!.'` drops the package root's directory listing. These tasks list the root,
 * and the cache fingerprints a listing by entry name, so `storybook-static/`
 * appearing (written by `storybook:build`) or disappearing would otherwise miss
 * `svelte-package`, `svelte-check` and the browser suite. A negative glob
 * filters tracked paths, not the entries inside a listing, so
 * `'!storybook-static/**'` alone cannot do this. It is here as well because
 * `svelte-check` walks the package for `.svelte` files and so lists every
 * directory under `storybook-static/`, whose chunk names change with each
 * Storybook build; nothing there is a `.svelte` file or in `tsconfig.json`'s
 * `include`. Every file a task does read (`package.json`, `tsconfig.json`,
 * `svelte.config.js`, this config, `src/`, `tests/`, `.storybook/`) is still
 * fingerprinted, and so are those directories' listings.
 *
 * The second workspace-relative exclusion drops each sibling package's
 * `node_modules/`. Resolving a bare import from a sibling's built `dist/`
 * probes that sibling's `node_modules/` first. Under `nodeLinker: hoisted` that
 * directory holds only pnpm's workspace symlinks (`@thomasfosterau/*`, whose
 * reads are fingerprinted at their real paths) and generated scratch (Vite's
 * `.vite` / `.vite-temp`, `svelte-kit sync`'s `$app` types), so its first
 * appearance would otherwise miss `svelte-package` and `storybook build` once.
 * The lockfile still stands in for every dependency.
 *
 * `build` and `storybook:build` take this list too: a task without `input`
 * tracks everything it touches, these exclusions included.
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
      // The published artifact. `exports` points at `dist`, so every consumer's
      // type-check needs this to have run — they declare it topologically via
      // `{ task: "build", from: "dependencies" }`.
      build: {
        command: 'svelte-package',
        dependsOn: ['sync', { task: 'build', from: 'dependencies' }],
        cache: {
          input: cacheInputs,
          output: ['dist/**'],
        },
      },
      // Type-checks `src/` (stories included — they live under `src/stories/`,
      // outside the `src/lib/` tree `svelte-package` ships), `tests/` and the
      // Storybook config (`.storybook/**/*.ts` in the tsconfig `include`; the
      // flowchart's stories are its own `check`'s). The core package is
      // imported through its published `exports`, i.e. its built `dist/`, so
      // this cannot run until that build has.
      check: {
        command: 'svelte-check --tsconfig ./tsconfig.json',
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
      // Browser mode, so `test:unit` never needs `PLAYWRIGHT_BROWSERS_PATH`
      // spelled out here: Playwright reads it from the environment (the agent
      // image and the devcontainer both set it; CI installs the browser in a
      // step of its own).
      'test:unit': {
        command: 'vp test run tests',
        dependsOn: ['sync', { task: 'build', from: 'dependencies' }],
        cache: {
          env: ['VITEST_MAX_WORKERS', 'NODE_OPTIONS', 'PLAYWRIGHT_BROWSERS_PATH'],
          input: cacheInputs,
          output: [],
        },
      },
      // Storybook — a human-facing dev loop and a static build, deliberately
      // OUTSIDE the `check` graph: the stories are type-checked by `check`
      // above (they are `src/` files); CI runs `storybook:build` as its last
      // step. `--no-open` because agent sessions have no browser to hand the
      // URL to. One Storybook for the workspace: the
      // `stories` glob reaches into the sibling packages/prosekit-flowchart,
      // whose components import this package's built `dist/` — hence the
      // `build` dependency.
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

  // `tailwindcss()` is here for Storybook only (`.storybook/preview.css`
  // imports the Tailwind + daisyUI stack a consumer runs); the unit suite and
  // `svelte-package` never emit CSS through it.
  plugins: [svelte(), tailwindcss()],

  // Every runtime dependency the browser suite reaches, pre-bundled BEFORE the
  // first test file loads. Left to discovery, Vite optimises `bits-ui` (and
  // the rest) the first time a test imports it, then reloads the page — and
  // every test file in flight at that moment fails with "Failed to fetch
  // dynamically imported module". A warm local cache hides it; a fresh CI
  // runner does not.
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
    // Reached only through the core's dynamic `import('linkedom')`, which a
    // browser never takes (there is a global `document`); left out of the
    // pre-bundle rather than bundling a server DOM into the suite.
    exclude: ['linkedom'],
  },

  test: {
    include: ['tests/**/*.test.ts'],
    // Registers the jest-dom matchers.
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    // A REAL browser, not a DOM shim. ProseMirror needs real layout and
    // selection, and this library's contract is focus order, keyboard
    // handling and the accessibility tree — none of which a shim models
    // faithfully — so the suite drives Chromium through Playwright. Headless
    // everywhere: CI has no display, and neither does an agent session.
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
  },
});
