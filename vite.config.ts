/**
 * Root workspace config. Owns the repo-wide format/lint/staged passes (read
 * statically by `vp fmt` / `vp lint` / `vp staged`) and the two aggregate
 * tasks — `check`, the type-check gate over every package and the root
 * project, and `check:dist`, the entry-point boundary and `"sideEffects":
 * false` check over every built `dist/`.
 *
 * The Svelte plugin, the browser test suites, the `svelte-package` and
 * `vp pack` builds and the Storybook tasks all live in each package's own
 * vite.config.ts: this file deliberately compiles nothing, so adding a
 * package never means editing it.
 */

import { recommended } from '@effect/tsgo/oxlint-presets';
import effect from '@mpsuesser/oxlint-plugin-effect';
import { defineConfig } from 'vite-plus';

/**
 * The Effect-using code, and the only files the Effect lint rules apply to:
 * the core package (all four entries and its node suite) and the flowchart's
 * canvas-free `./node` entry with its tests. The Svelte components are not
 * Effect code — their state is runes, their props plain values — so the
 * preset has no idiomatic fix to offer there.
 */
const EFFECT_FILES = [
  'packages/prosekit-utilities/src/**/*.ts',
  'packages/prosekit-utilities/tests/**/*.ts',
  'packages/prosekit-flowchart/src/lib/node/**/*.ts',
  'packages/prosekit-flowchart/tests/node/**/*.ts',
];

export default defineConfig({
  // Staged-file checks run by `vp staged` (pre-commit). Routed by type: oxfmt
  // cannot format `.svelte`, so Svelte goes through lint alone while the
  // oxfmt-supported types get the full format+lint+fix pass.
  staged: {
    '*.{js,ts,css,json,md}': 'vp check --fix',
    '*.svelte': 'vp lint --fix',
  },

  run: {
    tasks: {
      // The type-check gate, as one task: every package's `check` pipeline
      // (the root takes the three packages as dependencies so this edge
      // reaches them), then the root project itself — `tsconfig.json`'s
      // `vite.config.ts` and `scripts/**/*.ts`, which no package covers.
      // `tsc` is TypeScript 7's native compiler, as in the core's `check`.
      // Uncached: the root project is two files, and the package checks
      // underneath keep their own caches.
      check: {
        command: 'tsc -p tsconfig.json',
        dependsOn: [{ from: 'dependencies', task: 'check' }],
        cache: false,
      },
      // The entry-point import boundaries, checked against the BUILT dist/:
      // the core's `.`, `./derive` and `./drizzle` reach no ProseKit, and the
      // flowchart's `./node` reaches no Svelte or xyflow; and every emitted
      // module is side-effect-free, as `"sideEffects": false` claims. It
      // reads every package's dist/, so it depends on every package's
      // `build`. Uncached: it is a fast read of files another task wrote.
      'check:dist': {
        command: 'node scripts/check-dist-boundaries.ts',
        dependsOn: [{ from: 'dependencies', task: 'build' }],
        cache: false,
      },
    },
  },

  // Oxlint. Type-aware linting is intentionally OFF: the Svelte packages'
  // types come from the `svelte-kit sync` output and their `.svelte` files
  // are outside oxlint's remit either way, so type checking stays the job of
  // `vp run check` (svelte-check / tsc).
  lint: {
    ignorePatterns: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.svelte-kit/**',
      '**/storybook-static/**',
      '**/coverage/**',
    ],
    categories: {
      correctness: 'error',
    },
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    // Registered workspace-wide (loading a plugin enables none of its rules);
    // the Effect rules themselves are switched on only for EFFECT_FILES below.
    jsPlugins: [
      { name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' },
      ...effect.configs.recommended.jsPlugins,
    ],
    overrides: [
      {
        files: EFFECT_FILES,
        plugins: recommended.plugins,
        rules: {
          ...recommended.rules,
          ...effect.configs.recommended.rules,
          // `casting-awareness` is an awareness prompt, not a defect rule —
          // it fires on every `as`, including the narrowings ProseMirror's
          // loosely typed `attrs` / `toDOM` structurally require. Stays
          // visible as a warning.
          'effect/casting-awareness': 'warn',
          // Hard-codes abbreviations (`Arr`, `P`, `R`, …) with no options, so
          // it is unsatisfiable under the full-name convention (`import * as
          // Option from 'effect/Option'`) this family shares with its
          // consumers.
          'effect/prefer-namespace-imports': 'off',
          // "Shape" IS this package's domain term, not a description of
          // structure: a `DocumentShape` is the browser-cheap structural half
          // of a document schema (packages/prosekit-utilities/CLAUDE.md §
          // Terms), and `DocumentShape` / `defineDocumentShape` /
          // `DocumentShape.narrow` are published API that consumers' apps
          // name. Renaming them is a major break for no behavioural gain.
          'effect/no-shape-in-symbol-names': 'off',
        },
      },
      // The test suites are the boundary where an Effect is run to a value
      // and asserted on — the place the rule's own guidance sends
      // `runSync` / `runPromise` ("the test harness"). The workspace does not
      // use `@effect/vitest`, so there is no `it.effect` to hand the run to.
      {
        files: [
          'packages/prosekit-utilities/tests/**/*.ts',
          'packages/prosekit-flowchart/tests/node/**/*.ts',
        ],
        rules: {
          'effect/effect-run-in-body': 'off',
        },
      },
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },

  // Oxfmt — formatter of record for the workspace. `.svelte` files are outside
  // its remit and are kept in the same style by hand. `sortTailwindcss` is on
  // because the Svelte packages emit Tailwind classes: class order is a
  // diff-noise source otherwise, and a literal lookup table is exactly the
  // shape it can sort.
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
