/**
 * Root config: repo-wide format, lint and staged passes, and the aggregate
 * `ci`, `check`, `check:dist` and `test:coverage` tasks. Builds and test
 * suites live in each package's own vite.config.ts.
 */

import { recommended } from '@effect/tsgo/oxlint-presets';
import effect from '@enfect/oxlint';
import { defineConfig } from 'vite-plus';

/** The Effect code: the only files the Effect lint rules apply to. */
const EFFECT_FILES = [
  'packages/prosekit-utilities/src/**/*.ts',
  'packages/prosekit-utilities/tests/**/*.ts',
  'packages/prosekit-flowchart/src/lib/node/**/*.ts',
  'packages/prosekit-flowchart/tests/node/**/*.ts',
];

/** A preset's rules with every `warn` raised to `error`. */
const atError = (rules: Readonly<Record<string, unknown>> | undefined): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(rules ?? {}).map(([name, level]) => [
      name,
      level === 'warn'
        ? 'error'
        : Array.isArray(level) && level[0] === 'warn'
          ? ['error', ...level.slice(1)]
          : level,
    ]),
  );

export default defineConfig({
  // oxfmt can't format `.svelte`, so it is only linted. Lint runs without
  // `--fix`, so no type-aware autofix lands unverified.
  staged: {
    '*.{js,ts,css,json,md}': [
      'vp check --fix --no-lint',
      'vp check --no-fmt --no-error-on-unmatched-pattern',
    ],
    '*.svelte': 'vp lint --no-error-on-unmatched-pattern',
  },

  run: {
    tasks: {
      // Everything CI runs, fail-fast; `pnpm audit` needs the network.
      ci: {
        command: [
          'vp check',
          'vp run check',
          'vp run --filter ./packages/prosekit-utilities test:coverage',
          "vp run --filter '!./packages/prosekit-utilities' test:unit",
          'vp run -r build',
          'vp run check:dist',
          'vp run --filter ./packages/prosekit-svelte storybook:build',
          'pnpm audit --audit-level high',
        ],
        cache: false,
      },
      // Every package's `check`, then the root project (this file and
      // `scripts/`).
      check: {
        command: 'tsc -p tsconfig.json',
        dependsOn: [{ from: 'dependencies', task: 'check' }],
        cache: false,
      },
      // Entry-point import boundaries and `"sideEffects": false`, on the
      // built `dist/`.
      'check:dist': {
        command: 'node scripts/check-dist-boundaries.ts',
        dependsOn: [{ from: 'dependencies', task: 'build' }],
        cache: false,
      },
      // Every suite under one istanbul map, which `fallow audit` reads. One
      // vitest process, so the builds and `svelte-kit sync` the suites need
      // are named explicitly.
      'test:coverage': {
        command: 'vp test run --coverage',
        dependsOn: [
          '@thomasfosterau/prosekit-utilities#build',
          '@thomasfosterau/prosekit-svelte#build',
          '@thomasfosterau/prosekit-flowchart#sync',
        ],
        cache: false,
      },
    },
  },

  lint: {
    ignorePatterns: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.svelte-kit/**',
      '**/storybook-static/**',
      '**/coverage/**',
    ],
    plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'promise', 'vitest', 'jsdoc'],
    categories: {
      correctness: 'error',
      suspicious: 'error',
      perf: 'error',
    },
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      // `_tag` is Effect's discriminant, read on every tagged value and error.
      'eslint/no-underscore-dangle': ['error', { allow: ['_tag'] }],
      // Vitest's `expect(value, message)` takes a failure message second.
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
      // `it.effect` bodies are test blocks; `expect` inside them is not
      // standalone.
      'vitest/no-standalone-expect': ['error', { additionalTestBlockFunctions: ['it.effect'] }],
      // Stylesheets, and jest-dom's matcher registration in test setup.
      'import/no-unassigned-import': [
        'error',
        { allow: ['**/*.css', '@testing-library/jest-dom/vitest'] },
      ],
    },
    jsPlugins: [
      { name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' },
      ...effect.configs.recommended.jsPlugins,
    ],
    overrides: [
      {
        files: EFFECT_FILES,
        plugins: recommended.plugins ?? [],
        rules: {
          ...atError(recommended.rules),
          ...atError(effect.configs.recommended.rules),
          'typescript/no-unsafe-type-assertion': 'error',
        },
      },
      // Schemas built at runtime from configuration have no static type to
      // decode into; each assertion carries a `SAFETY:` comment.
      {
        files: [
          'packages/prosekit-utilities/src/derive/Registry.ts',
          'packages/prosekit-utilities/src/prosekit/document-schema.ts',
          'packages/prosekit-utilities/src/document-envelope.ts',
          'packages/prosekit-utilities/tests/derive/Attribute.test.ts',
        ],
        rules: {
          'effect/casting-awareness': 'off',
          'typescript/no-unsafe-type-assertion': 'off',
        },
      },
    ],
    // `typeCheck` stays off: tsgolint can't type `.svelte` imports, so it
    // reports false errors in the Svelte suites. `vp run check` type-checks.
    options: {
      typeAware: true,
      typeCheck: false,
    },
  },

  test: {
    projects: ['packages/*/vite.config.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text-summary', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/lib/**/*.{ts,svelte}', 'packages/prosekit-utilities/src/**/*.ts'],
      exclude: ['**/*.d.ts'],
    },
  },

  fmt: {
    ignorePatterns: ['**/dist/**', '**/.svelte-kit/**', '**/storybook-static/**'],
    singleQuote: true,
    semi: true,
    sortTailwindcss: {},
    overrides: [
      {
        files: ['**/*.md'],
        options: {
          proseWrap: 'never',
        },
      },
    ],
  },
});
