# Claude Code

Read README.md, docs/CONTRIBUTING.md and AGENTS.md (imported below). This file covers only Claude Code specifics.

- **Hooks** ([settings.json](settings.json)): a PreToolUse hook runs `fallow audit --base origin/trunk` on `git commit` / `git push` and blocks on a `fail` verdict (run `vp run test:coverage` first so it reads a fresh coverage map); a PostToolUse hook runs `vp fmt --write` on edited files (not `.svelte`).
- **Rules**: [`rules/svelte.md`](rules/svelte.md) loads when you touch either Svelte package.
- **Worktrees** go under `.claude/worktrees/`, one per branch; run `vp install` in each.

@../README.md

@../docs/CONTRIBUTING.md

@../AGENTS.md
