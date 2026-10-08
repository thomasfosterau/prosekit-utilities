/**
 * Vite config for `@thomasfosterau/prosekit-utilities`: the node unit suite,
 * the `vp pack` (tsdown) build that produces `dist/` with one bundle per
 * entry point, and the TS7 type check.
 *
 * The vitest environment is node. A test that needs a DOM — the HTML
 * renderer's browser branch, a mounted ProseMirror view — opts in per file
 * with `// @vitest-environment happy-dom`; the server branch of the renderer
 * asserts `globalThis.document` is absent, so the default must stay node.
 */

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
      // The published artifact: one ESM bundle + declaration file per entry
      // point. Consumers in this workspace resolve the package through its
      // `exports`, so their `check` / `test:unit` tasks depend on this.
      build: {
        command: 'vp pack',
        cache: {
          input: cacheInputs,
          output: ['dist/**'],
        },
      },
      // TypeScript 7's native `tsc` over `src/` and `tests/`.
      check: {
        command: 'tsc -p tsconfig.json',
        cache: {
          input: cacheInputs,
          output: [],
        },
      },
      'test:unit': {
        command: 'vp test run tests',
        cache: {
          env: ['VITEST_MAX_WORKERS'],
          input: cacheInputs,
          output: [],
        },
      },
      // The suite above under istanbul, failing below `test.coverage.thresholds`.
      // CI runs this one for the core instead of `test:unit`.
      'test:coverage': {
        command: 'vp test run tests --coverage',
        cache: {
          env: ['VITEST_MAX_WORKERS'],
          input: cacheInputs,
          output: ['coverage/**'],
        },
      },
    },
  },

  pack: {
    entry: {
      index: 'src/index.ts',
      derive: 'src/derive/index.ts',
      prosekit: 'src/prosekit/index.ts',
      drizzle: 'src/drizzle/index.ts',
    },
    format: 'esm',
    platform: 'neutral',
    dts: true,
    outDir: 'dist',
    clean: true,
  },

  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    ...(process.env.VITEST_MAX_WORKERS
      ? { maxWorkers: Number(process.env.VITEST_MAX_WORKERS) }
      : {}),
    coverage: {
      provider: 'istanbul',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts', 'src/**/index.ts'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
