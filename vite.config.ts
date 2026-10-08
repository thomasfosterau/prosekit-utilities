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

import { defineConfig } from 'vite-plus';

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
