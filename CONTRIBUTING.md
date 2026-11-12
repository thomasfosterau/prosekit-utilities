# Contributing

Maintained by Thomas Foster, with a workflow meant to suit humans and coding agents alike. The conventions are in [AGENTS.md](AGENTS.md); this file is the human-facing setup.

## Setup

Node (`^22.18.0 || ^24.11.0 || >=26.0.0`) and pnpm 11 (pinned by `packageManager`; `corepack enable` picks it up), plus the [Vite+](https://viteplus.dev) `vp` CLI.

```sh
pnpm install                          # dependencies, the git hooks, and the @effect/tsgo patch of tsc / oxlint
pnpm exec playwright install chromium # once: the browser the Svelte suites drive
```

Open in a Codespace or Dev Container: `.devcontainer/` provisions it with the same hook as agent sessions. The `Dev Container` workflow (`.github/workflows/devcontainer.yml`) builds it in CI whenever its inputs change; to try a change locally, `pnpm dlx @devcontainers/cli@0.89.0 up --workspace-folder .` (needs Docker).

## Git hooks

Managed by Vite+ (`vp config`, run by `prepare`). **pre-commit** runs `vp staged`: `vp check --fix --no-lint` then `vp check --no-fmt` on staged `.js` / `.ts` / `.css` / `.json` / `.md` files (formatting with fixes, linting without, so no type-aware autofix lands unverified) and `vp lint` on `.svelte` files, which Oxfmt cannot format, so keep them in the same style by hand. There is no pre-push hook.

## CI expectations

[`ci.yml`](.github/workflows/ci.yml) runs one job whose steps are the gate list in [AGENTS.md § Verification](AGENTS.md#verification), plus `pnpm audit --audit-level high`, on every pull request against `trunk` and every push to it. [`release.yml`](.github/workflows/release.yml) versions and publishes from `trunk` ([PUBLISHING.md](PUBLISHING.md)). Both are hardened for Dependabot pull requests: `permissions: {}` at the top with per-job grants, every action pinned to a commit SHA except `voidzero-dev/setup-vp` (an exact `@vX.Y.Z` tag), `persist-credentials: false` except where a step pushes, and no secret or OIDC in CI. `voidzero-dev/setup-vp` installs Vite+, the Node that `engines.node` selects and the pnpm that `packageManager` pins, restores the pnpm store cache, and runs a frozen-lockfile `vp install`. `uvx zizmor --offline .github` audits the workflows.

## Pre-PR checklist

1. The gates in [AGENTS.md § Verification](AGENTS.md#verification), each with its pass/fail.
2. A changeset (`pnpm changeset`) where [AGENTS.md](AGENTS.md#branches-and-pull-requests) requires one.
3. `git fetch origin trunk && git rebase origin/trunk`.
4. Docs: the package `README.md` for any exported change; the package `AGENTS.md` for a new term or invariant.

## Running individual checks

The gate commands are in [AGENTS.md § Commands](AGENTS.md#commands); these are the narrower ones:

```sh
vp lint                                                  # oxlint, type-aware (with the Effect rules on the Effect code)
vp fmt                                                   # oxfmt
vp run --filter ./packages/prosekit-utilities check      # one package's type gate
cd packages/prosekit-utilities && vp test run tests/allow-list.test.ts   # one file
```
