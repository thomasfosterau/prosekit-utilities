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
import effect from '@enfect/oxlint';
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
  // oxfmt-supported types get a format pass with fixes, then a lint pass
  // WITHOUT them. Lint is type-aware, and `--fix` would apply type-aware
  // autofixes (even of rules at `warn`) to staged files at commit time, so
  // the commit would differ from the tree that was verified.
  // `--no-error-on-unmatched-pattern` keeps a commit of only `.md` / `.json`
  // / `.css` files from failing the lint step, which has no file to lint.
  staged: {
    '*.{js,ts,css,json,md}': [
      'vp check --fix --no-lint',
      'vp check --no-fmt --no-error-on-unmatched-pattern',
    ],
    '*.svelte': 'vp lint --no-error-on-unmatched-pattern',
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
      // Every package's suite — the core's node suite and both Svelte
      // packages' browser suites — under ONE istanbul map at
      // `coverage/coverage-final.json`, which `fallow audit` reads for exact
      // per-function CRAP scores (`health.coverage` in .fallowrc.json).
      // Without it fallow estimates every function as uncovered, and any
      // function with cyclomatic complexity ≥ 5 fails the gate on its own.
      // Run this before `fallow audit`: the PreToolUse fallow gate audits the
      // map on disk and never refreshes it.
      //
      // Not the core's threshold gate: that stays the core's own
      // `test:coverage`, which CI runs. One vitest process runs every
      // project here, so no `from: 'dependencies'` edge builds the siblings a
      // suite imports through `exports` (→ `dist/`), nor runs the Svelte
      // packages' `svelte-kit sync`: each is named explicitly (cached, so a
      // warm tree pays nothing).
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

  // Oxlint, type-aware through vite-plus's bundled oxlint-tsgolint (patched by
  // `effect-tsgo patch --oxlint`, so the `effecttsgo/*` rules of the preset
  // below run too). See `options` at the end of this block.
  lint: {
    ignorePatterns: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.svelte-kit/**',
      '**/storybook-static/**',
      '**/coverage/**',
    ],
    // Oxlint's built-in plugins beyond the default set: `import`, `promise`,
    // `vitest` and `jsdoc` add their correctness / suspicious / perf rules.
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
      // Stylesheets are imported for their side effect on purpose (AGENTS.md
      // § Common pitfalls lists the only ones `dist/` may carry), and the
      // test setup files register jest-dom's matchers the same way.
      'import/no-unassigned-import': [
        'error',
        { allow: ['**/*.css', '@testing-library/jest-dom/vitest'] },
      ],

      // ---- Adoption allowances (#127) ----------------------------
      // Sites that predate the `suspicious` category and type-aware lint. A
      // new site is a defect; when a count reaches zero, delete the line so
      // the rule is back at `error`.
      //
      // 53 sites, all in tests: `toThrow()` with no expected error. Most are
      // Schema decode failures, whose message is Effect's formatted issue
      // tree; pinning each needs a matcher per case, not a mechanical edit.
      'vitest/require-to-throw-message': 'warn',
      // 34 sites, all in tests: `vi.fn()` without the mocked signature.
      'vitest/require-mock-type-parameters': 'warn',
      // 12 sites outside the Effect code (the Svelte packages' tests, one
      // story and the flowchart's `toolbar.ts`): narrowings of ProseMirror's `Node`
      // / `NodeViewSpec` and of `any`-typed browser test handles. The Effect
      // code is governed by `effect/casting-awareness` and
      // `effect/require-safety-comment-for-type-assertion` instead (below).
      'typescript/no-unsafe-type-assertion': 'warn',
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
        plugins: recommended.plugins ?? [],
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

          // ---- Rules this workspace's conventions cut across --------------
          // As in effect-web: each stays visible as a warning, so a NEW site
          // is still read, while the published surface it fires on today
          // keeps its shape.
          //
          // Fires on `?: T | undefined`, the ONLY spelling of an optional
          // member `exactOptionalPropertyTypes` lets a caller forward an
          // optional of its own into (AGENTS.md § Conventions), and on the
          // one deliberately nullable public parameter (`extractDocumentText`
          // takes a nullable database column). Every site today is one of
          // the two; switching to `Option` would break the published API.
          'effect/prefer-option-over-null': 'warn',
          // `NodeJSON` / `MarkJSON` and the derive options mirror
          // ProseMirror's JSON model, whose `attrs` is an open record of
          // `unknown`. That is deliberate: a caller must narrow a value
          // before using it, which is what keeps an `href` from skipping
          // `isSafeHref`.
          'effect/no-unsafe-dictionary-type': 'warn',
          // `unknown` is the honest type at a decode boundary: the public
          // `DocumentGrammarGuard` and `DocumentSchema.decode` exist to take
          // unparsed input, and `schemaFromDefault` reads ProseMirror's
          // `any`-typed `AttributeSpec.default`.
          'effect/no-unknown-parameters': 'warn',
          // The Effect code's assertions are already gated twice, by
          // `effect/casting-awareness` (a warning on each `as`) and by
          // `effect/require-safety-comment-for-type-assertion` (a `SAFETY:`
          // invariant above it). What is left narrows ProseMirror's untyped
          // `attrs` or re-types a mapped record no generic can prove.
          'typescript/no-unsafe-type-assertion': 'off',
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
      // Every package's tests.
      {
        files: ['packages/*/tests/**/*.ts'],
        rules: {
          // The browser suites drive the editor one keystroke or click at a
          // time, and each must land before the next: run in parallel they
          // would race the same focused element.
          'eslint/no-await-in-loop': 'off',
          // A fixture builder sits inside the `describe` that uses it, next
          // to the cases it serves; hoisting each to module scope only moves
          // it away from them.
          'unicorn/consistent-function-scoping': 'off',
        },
      },
    ],
    // `typeAware` runs the type-aware rules through oxlint-tsgolint.
    // `typeCheck` stays OFF, measured: tsgolint has no Svelte language
    // service, so every `.svelte` import types as untyped, and with it on
    // the Svelte suites report 10 false "unused @ts-expect-error" (TS2578)
    // and a false implicit-any (TS7031) at props svelte-check rejects
    // correctly. Type checking stays the job of `vp run check` (TS7 `tsc`
    // and svelte-check), the gate that understands `.svelte`.
    options: {
      typeAware: true,
      typeCheck: false,
    },
  },

  // The root `test:coverage` run above: each package's vite.config.ts is a
  // vitest project, so one run and one coverage map cover them all.
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
