Imports, in order:

- @../AGENTS.md
- @../CONTRIBUTING.md
- @../README.md

# Claude Code in this workspace

The workspace rules are in the imported `AGENTS.md`; this file holds only what is specific to Claude Code: its hooks, its settings, its worktrees and its cloud sessions. Each package's `CLAUDE.md` is a one-line `@AGENTS.md` import of that package's rules. The file-scoped rules in [`rules/`](rules) (`svelte.md`) load when you touch the files their `paths:` name.

## Hooks ([`settings.json`](settings.json))

- **SessionStart** ([`hooks/session-start.sh`](hooks/session-start.sh), on `startup` and `resume`) installs the global Vite+ CLI at the catalog's `vite-plus` pin with the official installer (npm-provenance and SHA-512 checked; it needs `vite.plus` and `viteplus.dev` on the environment's allowlist), links `vp` and `vpx` into `~/.local/bin` (the CLI lives under `$VP_HOME` when set, as in the Vite+ container image, else `~/.local/share/vite-plus`), and installs dependencies with `vp install --frozen-lockfile`. The global `vp` delegates to each checkout's own `vite-plus` (worktrees included); everything else goes through it: `vp exec fallow …` for fallow. Nothing else is put on PATH, and the hook removes the `fallow` and walking `vp` shims earlier versions wrote. If the installer can't run, `vp` falls back to this checkout's `node_modules` copy. It also repairs a broken bare `node` and runs `svelte-kit sync` on a first checkout. It hydrates no secrets, and there are none to hydrate. The Dev Container's `postCreateCommand` runs the same script.
- **The Chromium bridge** (in the SessionStart hook). The cloud image ships some Chromium revision under `/opt/pw-browsers` other than the one the pinned `playwright` wants (`PW_WANT_REV`). The hook takes the newest image revision that has both a full Chromium and a headless shell (CfT `chrome-linux64/` or older `chrome-linux/` layout), symlinks it under `~/.cache/prosekit-pw-browsers` with `PW_WANT_REV`'s names, and exports `PLAYWRIGHT_BROWSERS_PATH` through `$CLAUDE_ENV_FILE`. Bump `PW_WANT_REV` together with the catalog's `playwright` entry.
- **PreToolUse** ([`hooks/fallow-gate.sh`](hooks/fallow-gate.sh), on Bash) blocks `git commit` / `git push` when `fallow audit --base origin/trunk` (run as `vp exec fallow`) fails. It audits against `coverage/coverage-final.json`, and when that map is missing or older than any file under `packages/*/src`, `packages/*/tests` or `scripts/` it first runs `vp run test:coverage`, so running Verification step 9 first only saves that wait at commit time. A fresh worktree's first commit therefore waits for a full coverage run, which drives the browser suites: the hook points `PLAYWRIGHT_BROWSERS_PATH` at the Chromium bridge itself, since `$CLAUDE_ENV_FILE` reaches only the Bash tool's shells, not a PreToolUse hook. If that run fails and there is no map, the commit is blocked; `FALLOW_GATE_SKIP_COVERAGE=1` skips the refresh, and a commit made with it is unaudited, so it is for a broken environment only. It runs only in this checkout and its `.claude/worktrees/*`; anywhere else it runs none of that tree's tooling and skips the audit with a notice.
- **PostToolUse** (on Write / Edit / MultiEdit) runs `vp fmt --write` on each `.ts`/`.tsx`/`.js`/`.css`/`.json`/`.md`/`.yaml` file touched. It skips `.svelte`, which Oxfmt can't format, so keep `.svelte` files in the same style by hand (two-space indent, single quotes); the pre-commit hook lints them.

## Worktrees

Agent work uses git worktrees under `.claude/worktrees/`, one per branch. The shell's cwd silently resets to the primary checkout between tool calls, so start every command that targets a worktree with an explicit `cd` into it, and run `git log -1` to confirm the branch before committing. The global `vp` delegates to the checkout's own `vite-plus`, so a worktree needs its own `vp install`; without it, `describe()` throws `Cannot read properties of undefined (reading 'config')`.

## What can't run in a session

Publishing: only the release workflow can mint the npm OIDC token. Everything in `AGENTS.md` § Verification runs here, given the bridged Chromium for the browser suites; `pnpm audit` needs the network.
