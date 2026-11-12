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

/**
 * A preset's rules with every `warn` level raised to `error`, the options
 * of a `[level, options]` entry kept. A rule this workspace cannot satisfy
 * is switched off by name below, with its reason, never left at `warn`.
 */
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
      // Run this before a manual `fallow audit`. The PreToolUse fallow gate
      // runs it itself when the map is missing or stale.
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
          // Every preset rule at `error`: the presets ship many at `warn`, and
          // this workspace keeps no rule below error (each is at zero sites).
          ...atError(recommended.rules),
          ...atError(effect.configs.recommended.rules),
          // Both cast rules are at zero sites; keep them at `error`.
          'effect/casting-awareness': 'error',
          'typescript/no-unsafe-type-assertion': 'error',
          // The workspace uses the rule's canonical aliases (`Arr`, `P`, `R`,
          // `Str`, …), not full names.
          'effect/prefer-namespace-imports': 'error',
          // No "Shape" in symbol names: the document type is `DocumentEnvelope`.
          'effect/no-shape-in-symbol-names': 'error',

          // ---- Rules this workspace's conventions cut across --------------
          // As in effect-web: each stays visible as a warning, so a NEW site
          // is still read, while the published surface it fires on today
          // keeps its shape.
          //
          // Absence is an `Option`, never `T | null`; options-object members
          // are `readonly x?: T` (no `| undefined`) and optional parameters
          // `x?: T` (AGENTS.md § Conventions). Zero sites.
          'effect/prefer-option-over-null': 'error',
          // `NodeJSON` / `MarkJSON` attrs are `Schema.Json`-valued; guards are
          // `Predicate` / `Refinement` over `unknown`, and decode boundaries
          // take `Schema.Json`. Both at zero sites.
          'effect/no-unsafe-dictionary-type': 'error',
          'effect/no-unknown-parameters': 'error',
          // Every Schema class and tagged error carries its brand
          // (`{ readonly brand: unique symbol }`), and no error payload has a
          // `name` field to shadow `Error.prototype.name`: both at zero sites.
          'effecttsgo/schema-class-missing-brand': 'error',
          'effecttsgo/error-payload-shadows-name': 'error',
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
      // The one place a type assertion is unavoidable: a schema built at
      // runtime from configuration has no static type to decode into, so
      // its `Schema.Top` is asserted to the codec type it was built to be,
      // once, each beside a `SAFETY:` comment. These are the dynamic
      // `Schema.Struct`s the Registry derives per node and mark, the derived
      // and structural document schemas pinned to `DocumentJSON<Name>`, and
      // the test helper that decodes those erased schemas.
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
