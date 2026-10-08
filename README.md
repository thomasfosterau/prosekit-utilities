# prosekit-utilities

ProseKit document grammars as Effect Schemas, Drizzle document columns, and Svelte 5 editor components — in a [Vite+](https://viteplus.dev) workspace. Three publishable packages, consolidated out of the owner's SvelteKit + Effect apps.

| Package | Description |
| --- | --- |
| [`@thomasfosterau/prosekit-utilities`](./packages/prosekit-utilities) | The non-UI core: browser-cheap document shapes and allow-lists (`.`), an Effect Schema derived from a compiled ProseMirror schema (`./derive`), the ProseKit runtime, presets, derived document schema and HTML renderer (`./prosekit`), and Drizzle jsonb document columns (`./drizzle`) |
| [`@thomasfosterau/prosekit-svelte`](./packages/prosekit-svelte) | The Svelte 5 editor components: `Editor`, `BlockEditor`, `InlineEditor`, a declarative `BlockToolbar` with an insert menu and link/image dialogs on bits-ui |
| [`@thomasfosterau/prosekit-flowchart`](./packages/prosekit-flowchart) | A flowchart block — node spec, payload schema and server SVG under `./node`; the `@xyflow/svelte` canvas, edit dialog and node view at the root |

This is a publishable-library workspace, not an application: the build artifacts are `packages/*/dist`. Each package's `README.md` is its API reference; this file covers the workspace itself.

## Development

The toolchain is **Vite+** (the `vp` CLI) on **Node + pnpm**. Everything goes through `vp` rather than bare `pnpm`/`npm`.

```sh
pnpm install                                            # dependencies + the Vite+ git hooks
vp check                                                # format + lint (oxfmt + oxlint)
vp run check                                            # the type-check gate (tsc + svelte-check)
vp run -r test:unit                                     # node Vitest for the core, headless Chromium for the Svelte packages
vp run --filter ./packages/prosekit-utilities test:coverage  # the core's suite with its coverage thresholds, as CI runs it
vp run -r build                                         # vp pack / svelte-package -> packages/*/dist
vp run --filter ./packages/prosekit-svelte storybook    # the dev loop, port 6006 — one Storybook, both Svelte packages' stories
vp run --filter ./packages/prosekit-svelte storybook:build
```

The pre-commit hook runs `vp staged` (format + lint on staged files); there is no pre-push hook. The gates to run before pushing, in CI's order, are in [AGENTS.md § Verification](AGENTS.md#verification); the contributor rules are in [AGENTS.md](AGENTS.md).

The Svelte suites drive a real browser: Vitest browser mode over Playwright Chromium, headless everywhere. Locally that needs a Chromium matching the pinned `playwright` (`pnpm exec playwright install chromium`, or an image that pre-installs one under `PLAYWRIGHT_BROWSERS_PATH`); CI installs it in a step of its own.

## Versioning

[Changesets](https://github.com/changesets/changesets). Add one per affected package with `pnpm changeset` in any pull request that changes published behaviour. The release workflow opens the "Version Packages" PR (`chore: version packages`) and, once the owner merges it, publishes each package with npm trusted publishing (OIDC) from the protected `release` environment; there is no `NPM_TOKEN`. Nothing requests provenance: npm attaches it by itself only once the repository and the package are both public.

## Releasing

The pipeline is `.github/workflows/release.yml` plus [`scripts/release.sh`](scripts/release.sh); their comments carry the reason for each step. One-time owner setup, none of which an agent can do:

1. On npmjs.com, each of the three packages → Settings → Trusted Publisher → GitHub Actions: repository `thomasfosterau/prosekit-utilities`, workflow `release.yml`, environment `release`. If npm still requires a package to exist before a trusted publisher can be added, bootstrap each one by hand first.
2. GitHub Settings → Environments → `release` → required reviewers, deployments restricted to `main`.
3. GitHub Settings → Actions → General → allow GitHub Actions to create and approve pull requests, or the "Version Packages" PR cannot be opened.
4. Protect `main`, and allow squash merging only (#30).

## License

MIT © Thomas Foster
