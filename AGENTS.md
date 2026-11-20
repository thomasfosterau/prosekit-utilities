# AGENTS.md

Read [README.md](README.md) and [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) first; this file adds only what is specific to agents. Each package's `AGENTS.md` holds its boundary and invariants: read it before changing that package.

## Process

- You may open PRs in this repository. Out-of-scope work you notice: file an issue and move on.
- Use the GitHub MCP tools or `gh`, whichever is available. GitHub writes go to `thomasfosterau/prosekit-utilities` only.
- Run the gates in docs/CONTRIBUTING.md before pushing and say in the PR body which couldn't run.

## Pitfalls

- **Effect idioms.** Prefer Effect v4's own modules over hand-rolled utilities; read `node_modules/effect/` rather than guessing an API. Svelte components and measured hot paths are the exceptions.
- **Wire compatibility.** The consuming apps have stored documents. A change to the derivation, a node or mark spec, or the attribute overlay changes what they decode as; the golden fixtures in `packages/prosekit-utilities/tests/prosekit/document-models.test.ts` catch it, and it takes a major changeset.
- **Bundle boundaries.** The core's `.`, `./derive` and `./drizzle` must not reach ProseKit, and the flowchart's `./node` must not reach Svelte or xyflow. Type checks don't catch this; `vp run check:dist` does, on the built `dist/`.
- **Browser suites** need Chromium, and the pre-commit fallow audit runs them: in a session, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`. On a fresh checkout run `vp run -r sync` before `vp check`.

## Fallow

- `vp install` links the `fallow` skill into `.claude/skills/fallow` from the installed package (approved under `permissions` in `pnpm-workspace.yaml`); the repository's own fallow rules are in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).
