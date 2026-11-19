# Claude Code

Read README.md, docs/CONTRIBUTING.md and AGENTS.md (imported below). This file covers only Claude Code specifics.

- **Hooks** ([settings.json](settings.json)): a PostToolUse hook runs `vp fmt --write` on edited files (not `.svelte`). The fallow gate is the git pre-commit hook, not a Claude hook.
- **Worktrees** go under `.claude/worktrees/`, one per branch; run `vp install` in each.

@../README.md

@../docs/CONTRIBUTING.md

@../AGENTS.md
