/**
 * Root workspace config. Owns the repo-wide format/lint/staged passes (read
 * statically by `vp fmt` / `vp lint` / `vp staged`) and the one aggregate
 * task — `check`, the type-check gate over every package.
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
      // The type-check gate, as one task: every package's `check` pipeline.
      // A pure graph node — the root takes the three packages as
      // dependencies purely so this edge reaches them.
      check: {
        command: "echo 'check: all type gates green'",
        dependsOn: [{ from: 'dependencies', task: 'check' }],
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
