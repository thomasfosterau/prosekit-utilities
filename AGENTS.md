# AGENTS.md

`CLAUDE.md` is a symlink to this file. A publishable library workspace, not an application: `packages/*/dist` is the product, and it must stay wire-compatible with documents the owner's apps have already persisted. The toolchain is copied from `thomasfosterau/components`. This repo has no fallow gate and no docgen.

| Package | Directory | Purpose / boundary |
| --- | --- | --- |
| `@thomasfosterau/prosekit-utilities` | [`packages/prosekit-utilities`](packages/prosekit-utilities) | The non-UI core, four entry points: `.` (ProseKit-free document shapes, allow-lists, text, Markdown), `./derive` (an Effect Schema derived from a compiled ProseMirror schema), `./prosekit` (nodes, marks, presets, the derived document schema, the HTML renderer), `./drizzle` (jsonb document columns). Node Vitest. |
| `@thomasfosterau/prosekit-svelte` | [`packages/prosekit-svelte`](packages/prosekit-svelte) | The Svelte 5 editor components on bits-ui. Vitest browser mode; hosts the workspace's one Storybook. |
| `@thomasfosterau/prosekit-flowchart` | [`packages/prosekit-flowchart`](packages/prosekit-flowchart) | The flowchart block: `./node` without Svelte or xyflow, the canvas at the root. `@xyflow/svelte` is its required peer. |

Each package's `CLAUDE.md` holds its boundary and invariants (the derivation contract, the ProseKit-free root entry, the `./node` boundary); read it before editing that package.

## Common pitfalls

- **Never edit a version in a `package.json`.** Every external version lives in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) under `catalog:`; package.json files carry only `catalog:` or `workspace:*` (the literal peer ranges are the one deliberate exception — there is no `catalog:peers` here), and `catalogMode: strict` rejects anything else at install. After editing the catalog, run `pnpm install` and commit the regenerated `pnpm-lock.yaml` — a stale lockfile fails every CI job at once with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- **`dist/` is the product; `src/routes` does not exist.** The Svelte packages are `svelte-package` libraries, not SvelteKit apps: nothing under `src/lib/` may import `$app/*` or `$env/*`. The core package is a `vp pack` (tsdown) library with one bundle per entry point. Every package consumes its siblings the way a consumer does — through their published `exports`, i.e. their built `dist/` — never a relative path into another package's `src/`, which is why downstream `check` / `test:unit` / `build` tasks take a `{ task: 'build', from: 'dependencies' }` edge.
- **`"sideEffects": false` is a claim about `dist/`, and it is load-bearing.** Every emitted `.js` must be pure declarations: no top-level statements, no top-level `await`. The only bare imports allowed in the built output are `prosekit/basic/style.css` + `prosekit/basic/typography.css` inside `Editor.svelte` and `@xyflow/svelte/dist/style.css` inside `Flowchart.svelte` — modules in _other_ packages, whose own packaging governs their inclusion. Nothing else. That is what lets a consumer keep ProseKit off every page without a document field.
- **Accessibility regresses silently.** Type errors don't catch a lost accessible name, a broken focus order or a dropped `aria-pressed`. That is the whole reason the Svelte suites drive a real browser.

## Conventions

- **Optional props and fields are declared `T | undefined`, never bare `x?: T`.** The workspace compiles with `exactOptionalPropertyTypes`; parenthesise function types: `onSelect?: (() => void) | undefined`.
- **Relative imports carry their `.ts` extension** (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions` in `tsconfig.base.json`).
- **Tests import from `vite-plus/test`**, never `vitest`. A `.ts` test file under `tests/` mirrors the module it covers.
- **Every export is documented** with a doc comment whose first sentence says what it is for, in words that stand alone in a consumer's hover — no app names there. Provenance (which app behaviour it carries) goes below the summary or in a `//` comment. A comment that cites a Website issue (`#NNN`) or an invariant id (`SEC-XSS-001`, `PERF-CPU-001`) is pointing at the app repos' evidence, not at anything here.
- **Svelte authoring rules** (runes, `class` merging, strings as props, bits-ui, daisyUI lookup tables, stories and browser tests) are in [`.claude/rules/svelte.md`](.claude/rules/svelte.md), loaded when you touch either Svelte package.
- **New rules:** formatter/lint config goes in `vite.config.ts` first; a rule scoped to some files goes in `.claude/rules/` with `paths:`; a package-local rule goes in that package's `CLAUDE.md`; otherwise here.

## Commands

The toolchain is **Vite+** (the `vp` CLI) on **Node + pnpm**. Invoke everything through `vp` — `vp run <script>`, `vp exec <bin>` (instead of `npx`). The sanctioned non-`vp` calls: `pnpm install` (and `pnpm install --frozen-lockfile --ignore-scripts` in CI), `pnpm changeset`, `pnpm pack` / `npm publish` on the release path, and `pnpm exec playwright install` in CI.

- `pnpm install` — dependencies, plus the Vite+ git hooks (pre-commit runs `vp staged`: format + lint on staged files). There is **no pre-push hook** — run the gates yourself before pushing.
- `vp check` — format + lint (Oxfmt + Oxlint). `vp run check` — the type gate: the root aggregate over every package's `check` (`tsc` for the core, `svelte-kit sync` + `svelte-check` for the Svelte packages). They are different commands.
- `vp run -r test:unit` — every suite: node Vitest for the core, headless Chromium under Vitest browser mode for the Svelte packages.
- `vp run -r build` — `vp pack` → `packages/prosekit-utilities/dist`, `svelte-package` → the two Svelte `dist/`s.
- `vp run --filter ./packages/prosekit-svelte storybook` — the dev loop on port 6006; `storybook:build` for the static build. One Storybook for the workspace: its `stories` glob reaches across into `packages/prosekit-flowchart/src/stories`.
- `cd packages/<name> && vp test run tests` — one package's suite while iterating; `vp run -r` from the root is the gate.

## Verification

Before you report work as done, run the gates below in order and quote each command with its final pass/fail. If a gate can't run here, say which and why in the PR body; never imply it ran.

1. `vp check`
2. `vp run check`
3. `vp run -r test:unit`
4. `vp run -r build`
5. `vp run --filter ./packages/prosekit-svelte storybook:build`

This is CI's order (`.github/workflows/ci.yml`). None needs a credential. The browser suites need a Chromium matching the pinned `playwright` — see that entry's comment in the catalog. Before every push, prove CI parity from a clean tree: `rm -rf node_modules packages/*/node_modules packages/*/.svelte-kit packages/*/dist && pnpm install --frozen-lockfile --ignore-scripts`, then the gates above. A warm local tree hides a missing peer; a fresh runner does not.

## Branches and pull requests

- **Branch off `main`; PR against `main`; squash-merge.** Name branches `issue-<n>-<slug>` for issue-linked work, or a plain descriptive slug otherwise.
- **Rebase onto `origin/main` before opening or updating a PR** (`git fetch origin main && git rebase origin/main`); never merge `main` into your branch — merging silently auto-resolves convergent edits between parallel worktrees. GitHub's Update-branch button and auto-merge both merge; don't use them.
- **Worktrees.** Agent work uses git worktrees under `.claude/worktrees/`, one per branch. The shell's cwd silently resets to the primary checkout between tool calls, so start every command that targets a worktree with an explicit `cd` into it, and run `git log -1` to confirm the branch before committing. The linked `vp` at `~/.local/bin/vp` re-execs the nearest project-local `node_modules/vite-plus/bin/vp`, so a worktree needs its own `pnpm install` — without it, `describe()` throws `Cannot read properties of undefined (reading 'config')`.
- **Every change to a published package's behaviour carries a changeset** (`pnpm changeset`), one per affected package; docs-, CI- and tooling-only changes need none. A change to the derivation, a node/mark spec or the attribute overlay is a **major** — see [`packages/prosekit-utilities/CLAUDE.md`](packages/prosekit-utilities/CLAUDE.md).
- **Never publish or version by hand.** Merging to `main` makes `.github/workflows/release.yml` open the "Version Packages" PR (`chore: version packages`); the owner merges it, and the workflow publishes through [`scripts/release.sh`](scripts/release.sh). Publishing is npm trusted publishing (OIDC) from the protected `release` environment; there is no `NPM_TOKEN`. Never add `--provenance` or `NPM_CONFIG_PROVENANCE=true` — from a private repository it fails the publish. The reason for each release step is in the comments of `scripts/release.sh` and `release.yml`; the one-time owner setup is in [README.md § Releasing](README.md#releasing).
- **Standing approvals** (they override any default "don't open a PR unless asked"): open a PR against `main` once a branch has pushed a commit; watch it to merge or close, investigating CI failures and review comments as they arrive and rebasing promptly when it goes conflicting; keep the PR body current as the implementation diverges from it.
- **GitHub writes go to `thomasfosterau/prosekit-utilities` only**; pass `-R thomasfosterau/prosekit-utilities` whenever the cwd might be another checkout (`gh` infers the repo from the cwd's remote). Never write to any other repository — upstream projects and the owner's app repos included — without the owner's explicit approval for that action in the current session; nothing enforces this mechanically. Use the `gh` CLI for GitHub operations, even when GitHub MCP tools are available.

## Work tracker

- The issue tracker for `thomasfosterau/prosekit-utilities` is the backlog: file an issue rather than leaving a TODO in code.
- The issue is the spec: read all of it, comments included (`gh issue view <n> -R thomasfosterau/prosekit-utilities --comments`), and re-verify its claims against current `main` before editing.
- Record decisions and findings as comments on the issue; later comments override the body.
- Stop-and-report is a valid outcome: on a blocker outside the issue's scope, comment the evidence on the issue and stop.
- No silent deferrals: scope cut mid-PR becomes a linked issue before merge.

## Effect

Effect is used by the core package and by `prosekit-flowchart`'s `./node` entry only; its house style is in [`packages/prosekit-utilities/CLAUDE.md`](packages/prosekit-utilities/CLAUDE.md). The pinned version is the `effect` entry of the catalog; the published peer floor is the literal `>=4.0.0-rc.118` in the core's and the flowchart's package.json. `effect-solutions` is not provisioned here (#27): for an API question read `node_modules/effect/dist/*.d.ts` (after `pnpm install`). Never guess at an Effect pattern.

## Agent sessions

- The SessionStart hook ([`.claude/hooks/session-start.sh`](.claude/hooks/session-start.sh)) syncs dependencies against the lockfile, writes a `vp` shim on `~/.local/bin` that resolves the nearest project's `vite-plus`, repairs a broken bare `node`, and runs `svelte-kit sync` on a first checkout. It hydrates no secrets, and there are none to hydrate.
- A PostToolUse hook runs `vp fmt --write` on each `.ts`/`.tsx`/`.js`/`.css`/`.json`/`.md`/`.yaml` file an Edit or Write touches. It skips `.svelte`: Oxfmt can't format it, so keep `.svelte` files in the same style by hand (two-space indent, single quotes); the pre-commit hook lints them (`vp lint --fix`).
- Won't run in an agent session: publishing (only the release workflow can mint the OIDC token). Everything in § Verification runs here, given a Chromium for the browser suites.

## Documentation surfaces

Each fact has one home: a decision, findings report or invariant discovered while working an issue → a comment on that issue; a rule scoped to some files → `.claude/rules/`; a package's boundary, invariants and terms → that package's `CLAUDE.md`; the API reference → each package's `README.md` (what npm shows); the release mechanics → the comments in `scripts/release.sh` and `release.yml`; the one-time owner setup → [README.md § Releasing](README.md#releasing). There is no `docs/` tree, `CONTRIBUTING.md` or `PUBLISHING.md`.
