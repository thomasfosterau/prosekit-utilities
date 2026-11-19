# Contributing

## Workflow

The main branch is `trunk`. Branch off `trunk`, open a pull request into `trunk`, and squash-merge with a conventional prefix (`feat:`, `fix:`, `docs:`, `chore:`).

- **Open a draft PR early**, so others can see the work is taken.
- **One PR per change**, even a large one spanning many commits.
- **Rebase, don't merge.** Rebase onto `origin/trunk`; never merge `trunk` into your branch (GitHub's Update-branch button merges).
- **You own your PR**: CI green, reviews addressed, no conflicts, marked ready for review.
- **File issues** for bugs or improvements outside your change rather than fixing them in passing or leaving a TODO. Keep issue bodies evergreen: context, problem and chosen solution, edited in place.
- **Dependabot** keeps dependencies current; update one by hand only when your work needs it or Dependabot can't (see [Dependencies](#dependencies)).

## Toolchain

[Vite+](https://viteplus.dev) (`vp`) manages Node and pnpm; use `vp exec <bin>`, not `npx`. Its pre-commit hook runs `vp staged` (format with fixes, then lint without). Oxfmt can't format `.svelte`: keep those in the same style by hand (two-space indent, single quotes).

| Command | What it does |
| --- | --- |
| `vp install` | Dependencies, git hooks, and the Effect-patched `tsc` / oxlint (`prepare`) |
| `vp check` | Format and type-aware lint |
| `vp run check` | The type gate: `tsc` for the core, `svelte-kit sync` + `svelte-check` for the Svelte packages |
| `vp run -r test:unit` | Every suite: Node for the core, headless Chromium for the Svelte packages |
| `vp run -r build` | `vp pack` / `svelte-package` into each package's `dist/` |
| `vp run check:dist` | The entry-point import boundaries and `"sideEffects": false`, checked on the built `dist/` |
| `vp run --filter ./packages/prosekit-svelte storybook` | Storybook on port 6006 (`storybook:build` for the static build) |
| `vp run test:coverage` | Every suite under one coverage map, for `fallow audit` |
| `vp run ci` | Everything CI runs, in order |
| `vp test run tests/<file>` | One test file, from inside its package |

**Browsers.** The Svelte suites need the Chromium revision the pinned `playwright` expects: `vp exec playwright install chromium`. Where a Chromium is already installed (an agent session's `/opt/pw-browsers/chromium`), set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to it instead.

[Fallow](https://docs.fallow.tools) checks module boundaries, complexity and duplication: run `vp run test:coverage`, then `vp exec fallow audit --base origin/trunk`. Its findings are guidance, not dogma; CI doesn't run it.

## Coding guidelines

- **Effect.** Use Effect (v4) idioms throughout, and prefer Effect's own modules (`Option`, `Array`, `Match`, `Schema`, `Result`) over hand-rolled equivalents; convert existing code where practical. Exceptions: Svelte component code, non-Effect APIs at the boundary (adapt them at the edge), and hot paths where measured performance needs plain code. Read the installed `node_modules/effect/` (typings, source, `ai-docs/`) rather than guessing an API. Errors are `Schema.TaggedError` classes; absence is `Option`, never `T | null`; options-object members are `readonly x?: T`.
- **Svelte** 5 runes and snippets only; the authoring rules are in [`.claude/rules/svelte.md`](../.claude/rules/svelte.md). The Svelte packages never import `effect`.
- **Packages** consume each other through their published `exports` (built `dist/`), never a relative path into another package. Each package's `AGENTS.md` states its boundary.
- **`dist/` is side-effect free.** Every package declares `"sideEffects": false`, so a module-load call must be `/* @__PURE__ */`-annotated, and the only bare imports allowed are the stylesheets in `Editor.svelte` and `Flowchart.svelte`. `vp run check:dist` enforces this.
- **Lint.** Fix findings in code. A rule is relaxed only in `vite.config.ts`, with its reason; a necessary type assertion carries a `// SAFETY:` comment.
- **Comments.** A file-level comment only for real context, under 50 words. TSDoc where it helps a consumer's IntelliSense, adding to the signature rather than restating it. Inline comments only for what the code can't say. Don't reference issues, PRs or CI runs.
- **Tests** check logic: edge cases, regressions, complex behaviour. Don't test what the type system or a lint enforces. Import from `vite-plus/test` (or `@effect/vitest` for `it.effect`), never `vitest`. Svelte components are tested in a real browser through accessible queries and real events.

## Before pushing

Run `vp run ci`, or the gates one at a time:

1. `vp check`
2. `vp run check`
3. `vp run --filter ./packages/prosekit-utilities test:coverage`
4. `vp run --filter '!./packages/prosekit-utilities' test:unit`
5. `vp run -r build`
6. `vp run check:dist`
7. `vp run --filter ./packages/prosekit-svelte storybook:build`
8. `pnpm audit --audit-level high` (network)

Then the fallow audit. Say in the PR body which gates couldn't run.

CI ([ci.yml](../.github/workflows/ci.yml)) runs `vp run ci` on Node LTS and latest. Workflows pin actions by exact tag, locked to commits by `.github/workflows/actions.lock`: run `gh actions-lock` after changing a `uses:`. `uvx zizmor --offline .github` audits the workflows.

## Changesets

Every change to a published package's behaviour carries a changeset (`vp exec changeset`), one per affected package; a TSDoc change that reaches the emitted `.d.ts` is a `patch`. Docs-, CI- and tooling-only changes need none. A change to the derivation, a node or mark spec, or the attribute overlay changes what stored documents decode as: it is a **major**. Never version or publish by hand; see [PUBLISHING.md](PUBLISHING.md).

## Dependencies

Every external version is in the `pnpm-workspace.yaml` catalog; package.json files use `catalog:` or `workspace:*` (literal peer ranges are the exception). After editing the catalog, run `vp install` and commit `pnpm-lock.yaml`.

Dependabot groups the sets that must move together. By hand:

- **Toolchain** (`vite-plus`): run `vp dlx --package=vite-plus@<v> vp migrate --no-interactive` to re-pin `vite` and `vitest`, drop any `minimumReleaseAgeExclude` entries it adds, and move the devcontainer image tag to match. `typescript` / `@typescript/native` move only with an `@effect/tsgo` that supports them (see the catalog comment).
- **`prosekit`**: raise the packages' literal `prosekit` / `@prosekit/pm` peer ranges with its minor.
- **`prosemirror-model` / `prosemirror-view`** are pinned under `overrides` and move only by the owner's decision.
