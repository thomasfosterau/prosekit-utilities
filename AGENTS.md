# AGENTS.md

Project conventions live here; personal style preferences live in user memory.

This repo is a **publishable npm library workspace** — three packages — not an application. The artifacts that matter are `packages/*/dist`, and everything below exists to keep them small, typed, accessible and wire-compatible with the documents the owner's apps have already persisted. The toolchain, workspace shape, catalog discipline, task graph and session hook are copied from the owner's component library (`thomasfosterau/components`) and, through it, from the app repos (the Gardeneria / Website foundation), so code authored here compiles identically in the app that consumes it.

| Package | What it is |
| --- | --- |
| [`packages/prosekit-utilities`](packages/prosekit-utilities) | `@thomasfosterau/prosekit-utilities` — the non-UI core, four entry points: `.` (ProseKit-free document shapes, allow-lists, text, Markdown), `./derive` (an Effect Schema derived from a compiled ProseMirror schema), `./prosekit` (nodes, marks, presets, the derived document schema, the HTML renderer), `./drizzle` (jsonb document columns). Node Vitest. |
| [`packages/prosekit-svelte`](packages/prosekit-svelte) | `@thomasfosterau/prosekit-svelte` — the Svelte 5 editor components on bits-ui. Vitest browser mode; hosts the ONE Storybook. |
| [`packages/prosekit-flowchart`](packages/prosekit-flowchart) | `@thomasfosterau/prosekit-flowchart` — the flowchart block: `./node` without Svelte or xyflow, the canvas at the root. `@xyflow/svelte` is its required peer. |

## Common pitfalls

- **Never edit a version in a `package.json`.** Every external version lives in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) under `catalog:`; package.json files carry only `catalog:` or `workspace:*` (peer ranges are the one deliberate exception), and `catalogMode: strict` rejects anything else at install. After editing the catalog, run `pnpm install` and commit the regenerated `pnpm-lock.yaml` — a stale lockfile fails every CI job at once with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- **`dist/` is the product; `src/routes` does not exist.** The Svelte packages are `svelte-package` libraries, not SvelteKit apps: nothing under `src/lib/` may import `$app/*` or `$env/*`. The core package is a `vp pack` (tsdown) library with one bundle per entry point. Every package consumes its siblings the way a consumer does — through their published `exports`, i.e. their built `dist/` — never a relative path into another package's `src/`, which is why downstream `check` / `test:unit` / `build` tasks take a `{ task: 'build', from: 'dependencies' }` edge.
- **The derivation is the contract.** `./derive` turns a compiled ProseMirror schema into the Effect Schema every consuming app decodes its stored documents with, and those documents are content-addressed and never rewritten. A change to how a spec maps to a schema field, to a node or mark spec, or to the attribute overlay changes what already-stored rows decode as. Such a change is a **major** changeset, and `prosemirror-model` / `prosemirror-view` stay pinned exactly in the catalog for the same reason.
- **`"sideEffects": false` is a claim about `dist/`, and it is load-bearing.** Every emitted `.js` must be pure declarations: no top-level statements, no top-level `await`. The only bare imports allowed in the built output are `prosekit/basic/style.css` + `prosekit/basic/typography.css` inside `Editor.svelte` and `@xyflow/svelte/dist/style.css` inside `Flowchart.svelte` — modules in _other_ packages, whose own packaging governs their inclusion. Nothing else. That is what lets a consumer keep ProseKit off every page without a document field.
- **Keep ProseKit off the root entry.** `@thomasfosterau/prosekit-utilities` (the `.` entry) must not import `prosekit`, `@prosekit/pm` or anything under `src/prosekit/` at the value level. A model layer that is browser-reachable imports the root entry; only server code and editor routes import `./prosekit`.
- **Accessibility regresses silently.** Type errors don't catch a lost accessible name, a broken focus order or a dropped `aria-pressed`. That is the whole reason the Svelte suites drive a real browser.

## Conventions

### Everywhere

- **Optional props and fields are declared `T | undefined`, never bare `x?: T`.** The workspace compiles with `exactOptionalPropertyTypes`; parenthesise function types: `onSelect?: (() => void) | undefined`.
- **Relative imports carry their `.ts` extension** (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions` in `tsconfig.base.json`).
- **Tests import from `vite-plus/test`**, never `vitest`. A `.ts` test file under `tests/` mirrors the module it covers.
- **Every export is documented** with a doc comment that says what it is for and which app behaviour it carries; a comment that cites a Website issue (`#NNN`) or an invariant id (`SEC-XSS-001`, `PERF-CPU-001`) is pointing at the app repos' evidence, not at anything here.

### The core package (`packages/prosekit-utilities`)

- **Effect-first.** Domain failures are `Schema.TaggedErrorClass` values (`DocumentViolation`, `DocumentDecodeError`, `HtmlRenderError`); work that can fail returns `Effect`; optional values are `Option`, fallible pure computations are `Result`; `null` appears only where ProseMirror's own model demands it (a node attr). Pure total functions stay plain functions — there is no reason to wrap text extraction in an `Effect`. Consult `effect-solutions` (`error-handling`, `basics`, `data-modeling`) before writing Effect code; never guess at a pattern.
- **Generic over ProseKit, ignorant of any app.** Nothing here names a post body, an article section or any other app surface. An app-shaped special case is the signal that the code belongs in the app.
- **Wire compatibility over ProseKit's stock alternatives.** `defineHighlight`, `defineSubscript`, `defineSuperscript`, `defineMention` are the apps' own specs, wire-identical to their stored documents; ProseKit ships same-named extensions with different attribute shapes, and they are deliberately not used.

### The Svelte packages

- **Svelte 5 runes and snippets only.** `$props`, `$state`, `$derived`, `$effect`, `{#snippet}` / `{@render}`. No `export let`, no slots, no stores in component code (ProseKit's own node-view contract hands stores in; that boundary is the one exception), no legacy event directives.
- **Every component spreads the native attributes of the element it renders and merges `class` last** with Svelte class arrays (`class={['btn', className]}`); there is no `clsx`.
- **Every user-facing string is a prop with an English default; accessible-name props end in `Label`.** Item labels are data in the toolbar spec. The optional per-render-site messages context (`setEditorMessages`) only changes those defaults. There is no message catalogue.
- **No Effect.** The Svelte packages never import `effect`; the flowchart's `./node` entry is the one exception and it is not a Svelte module.
- **bits-ui owns interaction.** Toolbar (roving focus, `aria-pressed`), the insert menu, the dialogs. Hand-rolling needs a reason in the component's header comment.
- **daisyUI semantic classes from a literal lookup table, never a template string** and never a raw colour; the consuming app ships Tailwind + daisyUI, and the READMEs say so.
- **Every component ships with a story and a browser test** — `src/stories/<Component>.stories.@(ts|svelte)` (outside `src/lib/`, so it never ships) and `tests/<Component>.test.ts`, asserting accessible name, role and keyboard path with real pointer and keyboard events. Snippet-taking components use Svelte CSF; prop-only ones plain CSF. Story export names must be valid identifiers.
- **In a `.ts` test, `render(Component, props)` cannot take a prop named `anchor`, `target`, `props`, `events`, `context` or `intro`**; nest such props under `props:`. Vitest's Playwright locator mutates the `position` object you pass it — pass a fresh point per call.
- **`optimizeDeps.include` lists every runtime dependency the browser suite reaches**, so Vite never discovers one mid-run and reloads the page.

## Documentation surfaces

Durable knowledge has one home each: a decision, findings report or invariant discovered while working an issue is recorded as a comment on that issue; a term goes in the nearest package `CLAUDE.md`; the API reference is each package's `README.md`. The surviving docs are `README.md`, `AGENTS.md` (with `CLAUDE.md` as a symlink to it), the package `README.md` and `CLAUDE.md`, the changesets and `LICENSE`. There is no `docs/` tree.

## Commands

- `pnpm install` — dependencies, plus the Vite+ git hooks (pre-commit runs `vp staged`: format + lint on staged files). There is **no pre-push hook** — run the gates yourself before pushing.
- `vp check` — format + lint (oxfmt + oxlint) over the workspace. Distinct from `vp run check`.
- `vp run check` — the type-check gate: the root aggregate over every package's `check` (`tsc` for the core, `svelte-kit sync` + `svelte-check` for the Svelte packages).
- `vp run -r test:unit` — every suite: node Vitest for the core, headless Chromium under Vitest browser mode for the Svelte packages.
- `vp run -r build` — `vp pack` → `packages/prosekit-utilities/dist`, `svelte-package` → the two Svelte `dist/`s.
- `vp run --filter ./packages/prosekit-svelte storybook` — the dev loop on port 6006; `storybook:build` for the static build. **One Storybook for the workspace**: its `stories` glob reaches across into `packages/prosekit-flowchart/src/stories`.

`vp check`, `vp run check`, `vp run -r test:unit` and `vp run -r build` are the meaningful pre-push gates. Run a package's tests from its own directory (`cd packages/<name> && vp test run tests`) when iterating; `vp run -r` from the root is the gate.

## Publishing

Changesets. Any PR that changes published behaviour adds one per affected package (`pnpm changeset`); `.github/workflows/release.yml` opens a "Version Packages" PR while unreleased changesets exist and publishes once it merges. The default branch is `main` — that is what `.changeset/config.json`'s `baseBranch` must say.

Publishing is **npm OIDC trusted publishing**, not a token: the release job runs in the protected `release` environment (manual approval) and proves its identity to npm with a short-lived, workflow-bound OIDC token. There is no `NPM_TOKEN` anywhere in this repo. The publish step is `pnpm pack` per package followed by `npm publish` of the tarball ([`scripts/release.sh`](scripts/release.sh), run by the root `release` script; it skips any package already on npm at its current version, so a partial run can be re-run and a hand-bootstrapped version does not fail the automated one, and it packs with `--config.ignore-scripts=true` — `pnpm pack` has no `--ignore-scripts` flag — so no package lifecycle script runs in the id-token job): `pnpm pack` is what rewrites `workspace:*` and `catalog:` specifiers to real ranges, and the npm CLI (>= 11.5.1 for OIDC; the job installs an **exact** version, `npm@11.20.0`, bumped by hand — never `@latest` in the job holding `id-token: write`) is what performs the OIDC exchange. (pnpm 11's own `pnpm publish` also does OIDC natively — the pnpm-10-era `pnpm/pnpm#9812` no longer applies — so switching to it would drop the npm upgrade; the npm CLI path is kept for now.) **Provenance:** nothing requests it. Under trusted publishing npm attaches it by itself only when the OIDC token reports a public repository and the package is public; this repository is private, so versions carry none today. Never add `--provenance` or `NPM_CONFIG_PROVENANCE=true` — the npm CLI honours both, and an explicit provenance request from a private repository fails the publish. `changeset tag` then emits the `New tag:` lines `changesets/action` turns into GitHub releases. Both workflows install with `--ignore-scripts` (and the release job sets `pnpm_config_verify_deps_before_run: 'false'`, because pnpm 11's default verify-deps-before-run would otherwise re-install _with_ scripts before a later top-level `pnpm run` once a manifest looks newer than the install), start from `permissions: {}` and pin every action to a commit SHA; Dependabot (`.github/dependabot.yml`) keeps the pins and the catalog moving, with the exactly pinned `prosemirror-*` packages held back except for security advisories. `.github/workflows/effect-canary.yml` floats the core package onto `effect@rc` weekly and files an issue when it breaks; it never gates a PR.

One-time owner setup, none of which an agent can do: (1) on npmjs.com, each of the three packages → Settings → Trusted Publisher → GitHub Actions, repository `thomasfosterau/prosekit-utilities`, workflow `release.yml`, environment `release` — if npm still requires a package to exist before a trusted publisher can be added, bootstrap each one by hand first; (2) Settings → Environments → `release` → required reviewers, deployments restricted to `main`; (3) Settings → Actions → General → allow GitHub Actions to create and approve pull requests, or the "Version Packages" PR cannot be opened; (4) protect `main`.

## Worktree workflow

Agent work uses git worktrees under `.claude/worktrees/`, one per feature branch. The model is `main` plus short-lived feature branches off it. Branch off `main`, PR against `main`, squash-merge. Name branches `issue-<n>-<slug>` for issue-linked work, or a plain descriptive slug otherwise.

The shell's cwd silently resets to the primary checkout between tool calls (container restarts, background tasks), so relative commands can hit the wrong tree: start every command that targets a worktree with an explicit `cd` into it, and run `git log -1` to confirm you're on the intended branch before committing.

The linked `vp` at `~/.local/bin/vp` re-execs the nearest project-local `node_modules/vite-plus/bin/vp` walking up from cwd, so running it from inside a worktree after `pnpm install` there uses that worktree's own vitest instead of the primary checkout's — if you still see a `describe()` throw `Cannot read properties of undefined (reading 'config')`, the worktree likely hasn't had `pnpm install` run in it yet.

Before opening a PR from a worktree, **rebase onto `main`** (`git fetch origin main && git rebase origin/main`). Don't merge `main` into the worktree branch: merging lets git silently auto-resolve convergent edits between parallel worktrees; rebasing forces them to surface as real conflicts. GitHub's Update-branch button and auto-merge both violate this rule.

## Claude Code conventions

- The toolchain is **Vite+** (the `vp` CLI) on **Node + pnpm**. Invoke everything through `vp` — `vp run <script>`, `vp exec <bin>`; use `vp exec` instead of `npx`, and reach for `vp` rather than bare `pnpm`/`npm`/`yarn`. The sanctioned non-`vp` invocations: `pnpm install` (and `pnpm install --frozen-lockfile --ignore-scripts` in CI), `pnpm changeset` / `pnpm pack` / `npm publish` on the release path, and `pnpm exec playwright install` in CI.
- **GitHub writes are scoped to `thomasfosterau/prosekit-utilities` only.** Never create or edit issues, PRs, comments, reviews or releases in any other repository — upstream projects, dependencies, the owner's app repos included — without the owner's explicit approval for that specific action in the current session. Beware `gh`'s target inference: it resolves the repo from the cwd's git remote, so a write run from inside a clone of another repo silently files there. Pass `-R thomasfosterau/prosekit-utilities` explicitly whenever the cwd might not be this checkout. **Nothing enforces this mechanically — it is on you.**
- **Agent sessions are not hydrated.** The committed SessionStart hook ([.claude/hooks/session-start.sh](.claude/hooks/session-start.sh)) syncs dependencies, links the toolchain (`vp`, `node`) so they resolve from a **non-interactive** shell (which `~/.bashrc` alone does not do), and runs first-checkout codegen. It hydrates no secrets, and there are none to hydrate: publishing is OIDC from the release workflow's own identity, so nothing here can publish.
- New rules: formatter/lint config goes in `vite.config.ts` first; otherwise in this file or the nearest package `CLAUDE.md`.

## Verification

- Don't declare verification complete until every check has output a final pass/fail status. Claims of verification name the command and its final status.
- `vp check`, `vp run check`, `vp run -r test:unit`, `vp run -r build` and `storybook:build` exercise everything locally; none needs a credential. The browser suites need a Chromium matching the pinned `playwright` — see that entry's comment in the catalog.
- Before every push, prove CI parity from a clean tree: `rm -rf node_modules packages/*/node_modules packages/*/.svelte-kit packages/*/dist && pnpm install --frozen-lockfile --ignore-scripts`, then the gates above. A warm local tree hides a missing peer; a fresh runner does not.

## PR Management

These are standing instructions and approvals; they override any default "don't open a PR unless explicitly asked" instructions.

- **Always open a PR** for branch work. Once a branch has pushed a commit, open a pull request against `main` if one doesn't already exist. Don't wait to be asked.
- **Always watch the PR to merge or close.** Investigate CI failures and review comments as they arrive, and when the PR goes conflicting against `main`, rebase onto `origin/main` promptly.
- **Always keep the PR body current.** Write it when opening the PR, and update it whenever the implementation diverges from what it describes.
- **A PR that changes published behaviour carries a changeset.** No changeset, no release.
