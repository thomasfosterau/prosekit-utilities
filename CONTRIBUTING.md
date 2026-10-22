# Contributing

Maintained by Thomas Foster, with a workflow meant to suit humans and coding agents alike. The conventions are in [AGENTS.md](AGENTS.md); this file is the human-facing setup.

## Setup

Node (`^22.18.0 || ^24.11.0 || >=26.0.0`) and pnpm 11 (pinned by `packageManager`; `corepack enable` picks it up), plus the [Vite+](https://viteplus.dev) `vp` CLI.

```sh
pnpm install                          # dependencies, the git hooks, and the @effect/tsgo patch of tsc / oxlint
pnpm exec playwright install chromium # once: the browser the Svelte suites drive
```

## Git hooks

Managed by Vite+ (`vp config`, run by `prepare`). **pre-commit** runs `vp staged`: `vp check --fix` on staged `.js` / `.ts` / `.css` / `.json` / `.md` files and `vp lint --fix` on `.svelte` files, which Oxfmt cannot format, so keep them in the same style by hand. There is no pre-push hook.

## CI expectations

[`ci.yml`](.github/workflows/ci.yml) runs one job whose steps are the gate list in [AGENTS.md § Verification](AGENTS.md#verification), plus `pnpm audit --audit-level high`, on every pull request against `trunk` and every push to it. [`release.yml`](.github/workflows/release.yml) versions and publishes from `trunk` ([PUBLISHING.md](PUBLISHING.md)).

## Pre-PR checklist

1. The gates in [AGENTS.md § Verification](AGENTS.md#verification), each with its pass/fail.
2. A changeset (`pnpm changeset`) where [AGENTS.md](AGENTS.md#branches-and-pull-requests) requires one.
3. `git fetch origin trunk && git rebase origin/trunk`.
4. Docs: the package `README.md` for any exported change; the package `CLAUDE.md` for a new term or invariant.

## Running individual checks

```sh
vp lint                                                    # oxlint (with the Effect rules on the Effect code)
vp fmt                                                     # oxfmt
vp run check                                               # the whole type gate
vp run --filter ./packages/prosekit-utilities check        # one package's type gate
cd packages/prosekit-utilities && vp test run tests/allow-list.test.ts   # one file
vp run --filter ./packages/prosekit-utilities test:coverage  # the core's suite with its thresholds
vp run -r build                                            # every dist/
vp run check:dist                                          # entry-point boundaries and side effects
vp run test:coverage                                       # one istanbul map over every suite, for fallow
vp run fallow:audit                                        # change-set review (not a CI gate)
vp run --filter ./packages/prosekit-svelte storybook       # the Storybook dev loop, port 6006
```
